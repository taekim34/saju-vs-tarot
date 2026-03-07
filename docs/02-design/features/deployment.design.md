# Design: deployment (Cloudflare Pages + Workers 배포)

> Created: 2026-03-08
> Feature: deployment
> Status: Design
> Plan: docs/01-plan/features/deployment.plan.md

## 1. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GitHub Repository                  │
│  main push → GitHub Actions → Cloudflare Pages 배포   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              Cloudflare Pages (정적 호스팅)            │
│  index.html, css/, js/, data/, images/               │
│  _headers (보안 헤더)                                 │
├─────────────────────────────────────────────────────┤
│         Cloudflare Pages Functions (Workers)          │
│  functions/api/interpret.js → OpenRouter API 프록시   │
│                 ↑ OPENROUTER_API_KEY (환경변수)        │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌──────────────────┐  ┌──────────────────┐
│  OpenRouter API  │  │   bkend.ai BaaS  │
│  (서버 측 호출)    │  │ (클라이언트 직접)  │
│  키: Workers 환경변수│ │ 키: 클라이언트 공개키│
│                  │  │ CORS: 도메인 제한  │
└──────────────────┘  └──────────────────┘
```

## 2. File Changes

### 신규 파일 (4개)

| 파일 | 목적 |
|------|------|
| `functions/api/interpret.js` | Workers API 프록시 |
| `_headers` | 보안 헤더 설정 |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD |
| `.env.example` | 환경변수 템플릿 |

### 수정 파일 (4개)

| 파일 | 변경 내용 |
|------|-----------|
| `config.js` | .env fetch 제거, API 키 제거, 프록시 경로 설정 |
| `js/ai-interpreter.js` | 프록시 엔드포인트 호출로 변경 |
| `js/app.js` | 에러 UI 추가, 날짜 검증 추가 |
| `js/share.js` | html2canvas SRI 추가 |
| `index.html` | SEO 메타태그 + 에러 UI 엘리먼트 추가 |

## 3. Implementation Details

### D1: functions/api/interpret.js (신규)

```javascript
/**
 * Cloudflare Pages Function — OpenRouter API 프록시
 * 경로: POST /api/interpret
 * 환경변수: OPENROUTER_API_KEY, MODEL (Cloudflare 대시보드에서 설정)
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {
    const { systemPrompt, userPrompt, maxTokens } = await request.json();

    // 입력 검증
    if (!systemPrompt || !userPrompt) {
      return Response.json({ error: 'systemPrompt and userPrompt are required' }, { status: 400 });
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const model = env.MODEL || 'deepseek/deepseek-v3.2:floor';
    const tokenLimit = maxTokens || 4096;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': request.headers.get('Origin') || 'https://saju-vs-tarot.pages.dev',
        'X-Title': 'Saju-vs-Tarot'
      },
      body: JSON.stringify({
        model,
        max_tokens: tokenLimit,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    // OpenRouter 응답을 그대로 프록시
    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return Response.json(
      { error: 'Proxy error', message: err.message },
      { status: 502 }
    );
  }
}
```

**핵심 설계 결정:**
- `onRequestPost` — Cloudflare Pages Functions 규약 (파일 경로 = URL 경로)
- 요청 본문에서 `systemPrompt`, `userPrompt`, `maxTokens`만 받음
- `model`은 Workers 환경변수에서 가져옴 (클라이언트가 모델 선택 불가)
- OpenRouter 응답 status를 그대로 전달 (429 등 클라이언트에서 기존 retry 로직 재활용)

### D2: config.js (수정)

```javascript
/**
 * 환경 설정 (config.js)
 *
 * 프로덕션: API 프록시 사용, .env 불필요
 * 로컬 개발: .env에서 BKEND 키 로드
 */
window.__CONFIG_READY__ = (async () => {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // 로컬 개발 시에만 .env에서 bkend 키 로드
  let bkendKey = '';
  if (isLocal) {
    try {
      const res = await fetch('.env');
      if (res.ok) {
        const text = await res.text();
        text.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            if (key === 'BKEND_API_KEY') bkendKey = val;
          }
        });
      }
    } catch { /* 로컬 .env 없으면 무시 */ }
  }

  window.__CONFIG__ = {
    API_PROXY_URL: '/api/interpret',
    BKEND_API_KEY: bkendKey || '',
    BKEND_API_URL: 'https://api-client.bkend.ai'
  };
})();
```

**변경 포인트:**
- `OPENROUTER_API_KEY` 완전 제거 — 클라이언트에 존재할 이유 없음
- `MODEL`, `MAX_TOKENS` 제거 — Workers 환경변수로 이동
- `fetch('.env')` 로컬 개발 시에만 실행 (bkend 키 로드용)
- `API_PROXY_URL` 추가 — AI 해석 호출 경로
- bkend 키 하드코딩 제거

**프로덕션 배포 시 bkend 키 주입:**
Cloudflare Pages 빌드 시 환경변수로 주입하는 방법은 사용 불가 (런타임 JS이므로).
대신 bkend.ai의 `pk_` 키는 클라이언트용 공개키이므로, CORS 도메인 제한으로 보호.
로컬 개발: `.env`에서 로드. 프로덕션: inline 또는 별도 config endpoint 사용.

**대안 설계 — bkend 키 처리:**
`pk_` 키는 클라이언트 노출을 전제로 설계된 공개키이므로, 프로덕션에서도 코드에 포함 가능.
다만 하드코딩 대신 `.env` → 빌드 시 주입 패턴이 관리상 좋음.
Cloudflare Pages는 빌드 시 JS 파일 내용을 치환할 수 없으므로 (빌드 도구 없음),
**현실적 방안: `_config.js` 파일을 .gitignore에 추가하고 배포 시 생성**, 또는
**그냥 config.js에 남기되 CORS로 보호** (현실적 선택).

→ **채택: bkend `pk_` 키는 config.js에 유지, CORS 도메인 제한으로 보호**

```javascript
// config.js 최종 — bkend 공개키는 유지
window.__CONFIG__ = {
  API_PROXY_URL: '/api/interpret',
  BKEND_API_KEY: 'pk_e8b0d45ac445aac5916e89561bb180a1b2ec5697a4b9ac8d43bdffbe21877a82',
  BKEND_API_URL: 'https://api-client.bkend.ai'
};
// .env fetch 완전 제거 — 프록시가 API 키 관리
window.__CONFIG_READY__ = Promise.resolve();
```

### D3: js/ai-interpreter.js (수정)

변경 범위: `callAPI()` 함수만 수정

```javascript
// 변경 전
const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// 변경 후
function getAPIEndpoint() {
  const config = window.__CONFIG__ || {};
  return config.API_PROXY_URL || '/api/interpret';
}
```

```javascript
// 변경 전 (callAPI 내부)
const response = await fetch(API_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': location.origin || 'https://saju-vs-tarot.app',
    'X-Title': 'Saju-vs-Tarot'
  },
  body: JSON.stringify({
    model: config.MODEL || 'deepseek/deepseek-v3.2:floor',
    max_tokens: tokenLimit,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
});

// 변경 후
const response = await fetch(getAPIEndpoint(), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ systemPrompt, userPrompt, maxTokens: tokenLimit })
});
```

**변경 포인트:**
- `API_ENDPOINT` 상수 → `getAPIEndpoint()` 함수 (config에서 읽기)
- `Authorization` 헤더 제거 (Workers가 처리)
- `HTTP-Referer`, `X-Title` 헤더 제거 (Workers가 처리)
- `model` 필드 제거 (Workers 환경변수)
- 요청 본문: `{ systemPrompt, userPrompt, maxTokens }` 단순화
- **API 키 체크 로직 제거** — 더 이상 클라이언트에 키 없음, 프록시 502 에러로 대체
- 기존 retry/backoff 로직 **유지** — 프록시가 OpenRouter status를 그대로 전달하므로

```javascript
// callAPI 시작부 변경
async function callAPI(systemPrompt, userPrompt, retries = 2, attempt = 0, maxTokens = null) {
  // apiKey 체크 제거 — 프록시 사용
  try {
    const tokenLimit = maxTokens || 4096;
    const response = await fetch(getAPIEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt, maxTokens: tokenLimit })
    });

    // 429 Rate Limit — 기존 백오프 로직 유지
    if (response.status === 429) {
      // ... (기존 코드 유지)
    }

    // 502 프록시 에러 처리 추가
    if (response.status === 502) {
      return { fallback: true, text: '서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' };
    }

    // ... (이하 기존 로직 유지)
  }
}
```

### D5: js/app.js — 에러 UI (수정)

**index.html 에 에러 엘리먼트 추가:**
```html
<!-- battle-loading 다음에 추가 -->
<div id="battle-error" class="battle-error" style="display:none;">
  <div class="error-icon">⚠️</div>
  <p id="error-message" class="error-message">오류가 발생했습니다</p>
  <button id="btn-retry" class="btn-primary">다시 시도</button>
</div>
```

**app.js `runRound()` 수정 — 400번째 줄 부근:**
```javascript
// 변경 전
const roundData = await BattleEngine.nextRound();
if (!roundData) return;

// 변경 후
let roundData;
try {
  roundData = await BattleEngine.nextRound();
} catch (err) {
  console.error('라운드 진행 실패:', err);
}

if (!roundData) {
  stopLoadingMessages();
  battleLoading.style.display = 'none';
  const battleError = $('#battle-error');
  const errorMessage = $('#error-message');
  battleError.style.display = 'flex';
  errorMessage.textContent = 'AI 해석 중 오류가 발생했습니다. 다시 시도해주세요.';
  return;
}
```

**재시도 버튼 이벤트 (initialize에 추가):**
```javascript
$('#btn-retry')?.addEventListener('click', () => {
  $('#battle-error').style.display = 'none';
  runRound();
});
```

### D6: index.html — SEO 메타태그 (수정)

`<head>` 섹션에 추가 (기존 `<meta name="description">` 다음):
```html
<!-- Open Graph -->
<meta property="og:title" content="사주 vs 타로 — 운명의 대결">
<meta property="og:description" content="동양의 사주와 서양의 타로가 당신의 운세를 두고 벌이는 최후의 대결!">
<meta property="og:image" content="/images/og-thumbnail.jpg">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="사주 vs 타로 — 운명의 대결">
<meta name="twitter:description" content="동양의 사주와 서양의 타로가 당신의 운세를 두고 벌이는 최후의 대결!">
<meta name="twitter:image" content="/images/og-thumbnail.jpg">

<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
```

OG 이미지: 1200x630px, 인트로 화면 캡처 또는 사주🏮 vs 타로🔮 그래픽

### D7: .github/workflows/deploy.yml (신규)

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy . --project-name=saju-vs-tarot
```

**GitHub Secrets 필요:**
| Secret | 설명 | 획득 경로 |
|--------|------|-----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 | Cloudflare 대시보드 → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID | Cloudflare 대시보드 → 우측 사이드바 → Account ID |

**Cloudflare 대시보드 환경변수 설정 (Workers):**
| 변수 | 값 | 설정 위치 |
|------|-----|-----------|
| `OPENROUTER_API_KEY` | OpenRouter API 키 | Pages 프로젝트 → Settings → Environment variables |
| `MODEL` | `deepseek/deepseek-v3.2:floor` | 동일 |

### D8: _headers (신규)

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://html2canvas.hertzen.com; img-src 'self' data: blob:; connect-src 'self' https://api-client.bkend.ai; style-src 'self' 'unsafe-inline'; font-src 'self'
```

Cloudflare Pages는 프로젝트 루트의 `_headers` 파일을 자동 인식.

### D9: js/share.js — SRI (수정)

```javascript
// 변경 전
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// 호출부
await loadScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js');

// 변경 후
function loadScript(src, integrity = null) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// 호출부 — 버전 고정 + SRI
await loadScript(
  'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
  'sha384-<실제 해시값은 구현 시 계산>'
);
```

**참고:** SRI 해시값은 구현 시 `openssl dgst -sha384 -binary html2canvas.min.js | openssl base64 -A`로 계산하거나, srihash.org에서 생성.

### D10: js/app.js — 날짜 유효성 검증 (수정)

`startBattle()` 함수의 날짜 파싱 직후 (297번째 줄 부근):

```javascript
let year = parseInt(inputYear.value);
let month = parseInt(inputMonth.value);
let day = parseInt(inputDay.value);

// D10: 날짜 유효성 검증 추가
const testDate = new Date(year, month - 1, day);
if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
  inputError.textContent = `${year}년 ${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
  return;
}
```

### D11: bkend.ai CORS 설정

배포 완료 후 bkend.ai 콘솔에서 수동 설정:

```
프로젝트 사이드바 → CORS → Add Origin:
1. https://saju-vs-tarot.pages.dev   (Cloudflare Pages 기본 도메인)
2. 커스텀 도메인 (있을 경우)
```

### .env.example (신규)

```env
# 로컬 개발용 환경변수
# 이 파일을 .env로 복사하여 사용

# bkend.ai Public Key (클라이언트용)
BKEND_API_KEY=pk_your_bkend_api_key_here

# OpenRouter API Key (로컬 직접 호출 테스트 시에만 필요)
# 프로덕션에서는 Cloudflare Workers 환경변수로 관리
# OPENROUTER_API_KEY=your_openrouter_key_here
```

## 4. Implementation Order (구현 순서)

```
Phase 1: 보안 핵심 — API 프록시 전환
───────────────────────────────────
  ① functions/api/interpret.js 생성        (D1)
  ② config.js 리팩토링                     (D2)
  ③ ai-interpreter.js 프록시 호출 전환     (D3)
  ④ .env.example 생성                     (D4)

Phase 2: UX/품질 개선
───────────────────────────────────
  ⑤ index.html 에러 UI 엘리먼트 추가      (D5)
  ⑥ app.js 에러 핸들링 + 재시도 버튼       (D5)
  ⑦ app.js 날짜 유효성 검증               (D10)
  ⑧ index.html SEO 메타태그 추가          (D6)

Phase 3: 배포 파이프라인 + 보안
───────────────────────────────────
  ⑨  _headers 보안 헤더 파일 생성         (D8)
  ⑩  share.js SRI 적용                   (D9)
  ⑪  .github/workflows/deploy.yml 생성   (D7)

Phase 4: 외부 설정 (배포 후)
───────────────────────────────────
  ⑫  Cloudflare 대시보드 환경변수 설정
      - OPENROUTER_API_KEY
      - MODEL
  ⑬  bkend.ai CORS 도메인 등록            (D11)
```

## 5. Verification Checklist

| # | 검증 항목 | 확인 방법 |
|---|-----------|-----------|
| V1 | OpenRouter API 키가 클라이언트 JS에 없음 | `grep -r "OPENROUTER" js/ config.js` → 결과 없음 |
| V2 | `/api/interpret` 프록시 정상 동작 | 배틀 3라운드 완주 테스트 |
| V3 | bkend 키 하드코딩 아님 (또는 CORS 보호) | config.js 확인 + 다른 도메인에서 bkend 호출 시 CORS 차단 확인 |
| V4 | API 실패 시 에러 UI 표시 | Workers 환경변수 제거 후 배틀 시작 → 에러 메시지 + 재시도 버튼 확인 |
| V5 | OG 메타태그 동작 | Facebook/Twitter 디버거 도구로 확인 |
| V6 | GitHub Actions 자동 배포 | main push → Cloudflare Pages 배포 로그 확인 |
| V7 | 보안 헤더 적용 | `curl -I https://도메인` → 헤더 확인 |
| V8 | 잘못된 날짜 차단 | 2월 31일 입력 → 에러 메시지 확인 |
| V9 | html2canvas SRI | DevTools Network → script integrity 속성 확인 |
