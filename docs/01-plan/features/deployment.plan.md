# Plan: deployment (Cloudflare Pages + Workers 배포)

> Created: 2026-03-07
> Feature: deployment
> Status: Plan
> Depends on: ux-upgrade (완료)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | API 키가 클라이언트에 노출되고, 보안 헤더/SEO 메타태그가 없어 프로덕션 배포 불가 상태 |
| **Solution** | Cloudflare Pages + Workers API 프록시 + GitHub Actions CI/CD 파이프라인 구축 |
| **Function UX Effect** | API 키 서버 보호, HTTPS 강제, OG 메타태그로 SNS 공유 시 프리뷰 제공, 에러 UI로 사용자 안내 |
| **Core Value** | 무료~$5/월 비용으로 보안과 성능을 갖춘 프로덕션 서비스 운영 가능 |

## 1. Overview

사주 vs 타로 배틀 서비스를 Cloudflare Pages에 배포하고, OpenRouter API 키 보안을 위해 Cloudflare Workers(Pages Functions)를 API 프록시로 사용한다. GitHub Actions로 CI/CD를 구성하여 main 브랜치 push 시 자동 배포한다.

배포와 함께 종합 분석(코드 품질 72/100, 보안 35/100)에서 발견된 배포 차단 이슈와 주요 개선사항을 반영한다.

## 2. Scope

### In Scope

| # | 작업 | 영향 파일 | 우선순위 |
|---|------|-----------|----------|
| D1 | **Cloudflare Workers API 프록시** | `functions/api/interpret.js` (신규) | CRITICAL |
| D2 | **config.js 리팩토링** — API 키 제거, 프록시 경로로 전환 | `config.js` | CRITICAL |
| D3 | **ai-interpreter.js 수정** — 프록시 엔드포인트 호출로 변경 | `js/ai-interpreter.js` | CRITICAL |
| D4 | **bkend API 키 .env 이동** — 하드코딩 제거 | `config.js` | CRITICAL |
| D5 | **API 실패 에러 UI** — 무한 로딩 해소 | `js/app.js`, `index.html` | HIGH |
| D6 | **SEO 메타태그** — OG, Twitter Card, favicon | `index.html` | HIGH |
| D7 | **GitHub Actions 워크플로우** | `.github/workflows/deploy.yml` (신규) | HIGH |
| D8 | **보안 헤더** — CSP, HSTS, X-Frame-Options | `functions/_middleware.js` 또는 `_headers` (신규) | MEDIUM |
| D9 | **html2canvas SRI** — CDN 무결성 검증 | `js/share.js` | MEDIUM |
| D10 | **날짜 유효성 검증** — 존재하지 않는 날짜 차단 | `js/app.js` | MEDIUM |
| D11 | **bkend.ai CORS 설정** — 배포 도메인 등록 | bkend.ai 콘솔 (수동) | HIGH |

### Out of Scope
- 이미지 WebP 변환 및 lazy loading (별도 최적화 작업으로 분리)
- JS/CSS minification (빌드 도구 도입 필요, 별도 작업)
- WCAG 접근성 전면 개선 (별도 작업)
- 커스텀 도메인 설정 (배포 후 별도 진행)
- 결과 데이터 IDOR 대응 (bkend.ai 플랫폼 레벨 설정 필요)

## 3. Requirements

### D1: Cloudflare Workers API 프록시

**목적**: OpenRouter API 키를 서버 측에서만 관리하여 클라이언트 노출 차단

```
요청 흐름:
  브라우저 → POST /api/interpret → Workers 함수 → OpenRouter API
                                        ↑
                                 API_KEY는 환경변수에만 존재
```

- `functions/api/interpret.js` 생성 (Cloudflare Pages Functions 규약)
- 요청 본문: `{ systemPrompt, userPrompt, maxTokens }`
- Workers 환경변수: `OPENROUTER_API_KEY`, `MODEL`
- 응답: OpenRouter API 응답을 그대로 프록시
- Rate limit: 동일 IP에서 분당 20회 제한 (선택적)
- 에러 처리: 429/500 등 OpenRouter 에러를 적절히 변환

### D2: config.js 리팩토링

- `OPENROUTER_API_KEY` 제거 (더 이상 클라이언트에 불필요)
- `fetch('.env')` 제거 (API 키 로드 불필요)
- `BKEND_API_KEY`를 `.env`에서 로드하도록 변경, 하드코딩 제거
- `API_PROXY_URL` 추가 — 프록시 엔드포인트 경로 (`/api/interpret`)
- `MODEL`, `MAX_TOKENS`는 Workers 환경변수로 이동

### D3: ai-interpreter.js 수정

- `API_ENDPOINT`를 OpenRouter 직접 URL에서 프록시 경로로 변경
- `Authorization` 헤더 제거 (Workers가 처리)
- 요청 본문 구조 변경: `{ systemPrompt, userPrompt, maxTokens }`
- 기존 retry/backoff 로직 유지

### D4: bkend API 키 .env 이동

- `config.js`에서 `pk_e8b0d45...` 하드코딩 제거
- `.env`에서 `BKEND_API_KEY` 로드
- bkend.ai Public Key는 클라이언트 노출 허용이지만, 코드에 직접 넣지 않는 것이 관리상 바람직
- 배포 시 Cloudflare Pages 환경변수로 설정

### D5: API 실패 에러 UI

- `app.js`의 `runRound()` null 반환 시 에러 메시지 표시
- 로딩 스피너 숨기고 에러 패널 표시
- "다시 시도" 버튼 제공
- 네트워크 에러, 429 Rate Limit, 500 서버 에러 구분 메시지

### D6: SEO 메타태그

```html
<!-- OG Tags -->
<meta property="og:title" content="사주 vs 타로 — 운명의 대결">
<meta property="og:description" content="동양의 사주와 서양의 타로가 당신의 운세를 두고 벌이는 최후의 대결!">
<meta property="og:image" content="/images/og-thumbnail.jpg">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">

<!-- Favicon -->
<link rel="icon" href="/favicon.ico">
```

- OG 이미지 (`images/og-thumbnail.jpg`) 제작 필요 (1200x630px 권장)

### D7: GitHub Actions 워크플로우

```yaml
trigger: push to main branch
steps:
  1. Checkout
  2. Deploy to Cloudflare Pages (wrangler-action)
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- `wrangler.toml` 생성 — Pages 프로젝트 설정
- GitHub Secrets 필요: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Workers 환경변수(OPENROUTER_API_KEY)는 Cloudflare 대시보드에서 설정

### D8: 보안 헤더

`_headers` 파일 또는 `functions/_middleware.js`로 설정:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://html2canvas.hertzen.com; img-src 'self' data: blob:; connect-src 'self' https://api-client.bkend.ai; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### D9: html2canvas SRI

- `share.js`에서 CDN 스크립트 로드 시 `integrity` + `crossorigin` 속성 추가
- html2canvas 특정 버전 고정 (현재 latest 사용 중)

### D10: 날짜 유효성 검증

- `app.js` 폼 검증에 날짜 존재 여부 체크 추가
- `new Date(year, month-1, day)` 결과의 month/day가 입력과 일치하는지 확인
- 2월 31일, 4월 31일 등 입력 시 에러 메시지 표시

### D11: bkend.ai CORS 설정

배포 후 bkend.ai 콘솔에서 수동 설정:
1. 프로젝트 사이드바 → CORS
2. 배포 도메인 추가 (예: `https://saju-vs-tarot.pages.dev`)
3. 최대 3개 도메인 등록 가능

## 4. Implementation Order

```
Phase 1: 보안 핵심 (D1→D2→D3→D4)
  API 프록시 생성 → config.js 리팩토링 → AI 인터프리터 수정 → bkend 키 이동

Phase 2: UX/품질 (D5→D6→D10)
  에러 UI → SEO 메타태그 → 날짜 검증

Phase 3: 배포 파이프라인 (D7→D8→D9)
  GitHub Actions → 보안 헤더 → SRI

Phase 4: 외부 설정 (D11)
  bkend.ai CORS 도메인 등록 (배포 후)
```

## 5. Risk & Mitigation

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Workers 무료 한도 초과 (10만 요청/일) | 서비스 중단 | 일 14,000명까지 커버 가능, 초과 시 $5/월 유료 전환 |
| OpenRouter Rate Limit (429) | 배틀 중단 | 기존 지수 백오프 유지 + Workers에서 추가 재시도 |
| .env 파일 구조 변경 | 로컬 개발 영향 | .env.example 파일 제공 |
| OG 이미지 미제작 | SNS 공유 시 프리뷰 없음 | 기본 이미지 우선 사용, 이후 교체 |

## 6. Cost Estimate

| 항목 | 월 비용 |
|------|--------|
| Cloudflare Pages 호스팅 | $0 (무제한 대역폭) |
| Cloudflare Workers | $0 (일 10만 요청까지) |
| GitHub Actions | $0 (public repo) / 2,000분/월 (private) |
| 도메인 (선택) | ~$12/년 |
| OpenRouter API | 일 100명 기준 ~$9/월 |
| **합계** | **~$10/월 (소규모)** |

## 7. Definition of Done

- [ ] OpenRouter API 키가 클라이언트 코드에 존재하지 않음
- [ ] `/api/interpret` Workers 프록시로 AI 해석 정상 동작
- [ ] bkend.ai API 키가 소스 코드에 하드코딩되지 않음
- [ ] API 실패 시 사용자에게 에러 메시지 + 재시도 버튼 표시
- [ ] OG/Twitter 메타태그로 SNS 공유 시 프리뷰 노출
- [ ] GitHub Actions로 main push 시 자동 배포
- [ ] 보안 헤더(CSP, HSTS 등) 적용
- [ ] bkend.ai CORS에 배포 도메인 등록 완료
- [ ] 날짜 유효성 검증 동작
