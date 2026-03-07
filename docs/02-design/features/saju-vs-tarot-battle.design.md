# saju-vs-tarot-battle Design Document

> **Summary**: 사주(동양) vs 타로(서양) 실시간 배틀 쇼 — Vanilla SPA
>
> **Project**: 사주 vs 타로 대결 서비스
> **Author**: taekim34
> **Date**: 2026-03-05
> **Status**: Draft
> **Planning Doc**: [saju-vs-tarot-battle.plan.md](../01-plan/features/saju-vs-tarot-battle.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **실제 이론 기반 해석** — 사주(만세력, 오행, 십성)와 타로(78장 전체, 스프레드)의 정확한 데이터 구조
2. **배틀 쇼 UX** — 라운드 전환 애니메이션, VS 연출, 투표 인터랙션
3. **제로 의존성** — 프레임워크 없이 Vanilla HTML/CSS/JS로 전체 구현
4. **공유 최적화** — SNS 공유용 결과 이미지 자동 생성

### 1.2 Design Principles

- **SPA via Section Toggle**: `index.html` 하나에 5개 `<section>`, CSS class로 화면 전환
- **데이터와 로직 분리**: JSON 데이터 파일 + JS 엔진 분리
- **지연 로딩 UX**: API 대기 시간을 애니메이션으로 자연스럽게 커버
- **모바일 우선**: 모바일에서 최적화된 세로 레이아웃

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────┐
│                  index.html (SPA)                │
│  ┌─────┐ ┌─────┐ ┌──────┐ ┌──────┐ ┌─────┐    │
│  │Intro│→│Input│→│Battle│→│Result│→│Share│    │
│  └─────┘ └─────┘ └──────┘ └──────┘ └─────┘    │
├─────────────────────────────────────────────────┤
│  css/style.css          css/animations.css       │
├─────────────────────────────────────────────────┤
│  js/app.js ─── 화면 전환 컨트롤러                 │
│    ├── js/saju.js ──── 사주 계산 엔진             │
│    ├── js/tarot.js ─── 타로 카드 드로우           │
│    ├── js/battle.js ── 배틀 진행 + 투표           │
│    ├── js/ai-interpreter.js ── Claude API        │
│    └── js/share.js ── 결과 이미지 + SNS           │
├─────────────────────────────────────────────────┤
│  data/                                           │
│    ├── cheongan.json    ── 천간 10개              │
│    ├── jiji.json        ── 지지 12개              │
│    ├── sipsung.json     ── 십성 10종              │
│    ├── manseryeok.json  ── 만세력 테이블           │
│    ├── tarot-major.json ── 메이저 아르카나 22장    │
│    └── tarot-minor.json ── 마이너 아르카나 56장    │
├─────────────────────────────────────────────────┤
│  External: Claude API (AI 해석), html2canvas      │
└─────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
[사용자 입력]
  생년월일(필수) + 성별(필수) + 출생시간(선택)
       │
       ▼
[병렬 초기화]
  saju.js: 만세력 변환 → 사주팔자 산출 (1회, 결정론적)
  tarot.js: 78장 덱 셔플 → 대기
       │
       ▼
[Round 1: 연애운]
  saju.js → 사주팔자 데이터 전달
  tarot.js → 3장 드로우 (과거-현재-미래)
  ai-interpreter.js → Claude API 2회 호출 (사주 해석 + 타로 해석)
  → 애니메이션 표시 → 유저 투표
       │
       ▼
[Round 2: 재물운] — 동일 패턴, 타로 3장 새 드로우
       │
       ▼
[Round 3: 종합운세] — 동일 패턴, 타로 5장 새 드로우
       │
       ▼
[최종 판정]
  투표 결과 집계 (60%) + AI 종합 판정 (40%, API 1회)
  → 최종 승자 선언 + 종합 해석
       │
       ▼
[결과 & 공유]
  html2canvas → 결과 카드 이미지
  → 카카오톡 / Twitter / URL 복사
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| app.js | 모든 모듈 | 초기화 + 화면 전환 오케스트레이션 |
| saju.js | data/cheongan.json, jiji.json, sipsung.json, manseryeok.json | 사주팔자 계산 |
| tarot.js | data/tarot-major.json, tarot-minor.json | 카드 덱 관리 + 드로우 |
| battle.js | saju.js, tarot.js, ai-interpreter.js | 라운드 진행 + 투표 |
| ai-interpreter.js | Claude API (외부) | AI 해석 생성 |
| share.js | html2canvas (CDN) | 결과 이미지 생성 |

---

## 3. Data Model

### 3.1 사주 데이터 구조

```javascript
// data/cheongan.json — 천간 (10 Heavenly Stems)
[
  { "name": "甲", "korean": "갑", "element": "목", "yin_yang": "양", "meaning": "큰 나무" },
  { "name": "乙", "korean": "을", "element": "목", "yin_yang": "음", "meaning": "풀, 꽃" },
  { "name": "丙", "korean": "병", "element": "화", "yin_yang": "양", "meaning": "태양" },
  { "name": "丁", "korean": "정", "element": "화", "yin_yang": "음", "meaning": "촛불" },
  { "name": "戊", "korean": "무", "element": "토", "yin_yang": "양", "meaning": "산, 큰 땅" },
  { "name": "己", "korean": "기", "element": "토", "yin_yang": "음", "meaning": "논밭" },
  { "name": "庚", "korean": "경", "element": "금", "yin_yang": "양", "meaning": "바위, 쇠" },
  { "name": "辛", "korean": "신", "element": "금", "yin_yang": "음", "meaning": "보석" },
  { "name": "壬", "korean": "임", "element": "수", "yin_yang": "양", "meaning": "바다, 큰 물" },
  { "name": "癸", "korean": "계", "element": "수", "yin_yang": "음", "meaning": "이슬, 비" }
]
```

```javascript
// data/jiji.json — 지지 (12 Earthly Branches)
[
  {
    "name": "子", "korean": "자", "animal": "쥐",
    "element": "수", "yin_yang": "양",
    "jijanggan": ["壬", "癸"],
    "month": 11, "time": "23:00-01:00"
  },
  // ... 12개 전체
]
```

```javascript
// data/sipsung.json — 십성 (Ten Gods)
[
  {
    "name": "비견", "hanja": "比肩",
    "relation": "같은 오행 같은 음양",
    "meaning": "자기 자신과 동등한 존재",
    "love": "라이벌 등장, 경쟁 구도",
    "wealth": "재물 분산, 동업 가능",
    "general": "독립심, 자존심, 경쟁"
  },
  // ... 10개 전체 (비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인)
]
```

```javascript
// data/manseryeok.json — 만세력 테이블 (1940-2050)
// 양력 날짜 → 사주 년주/월주/일주 매핑
{
  "yearPillars": {
    "1990": { "cheongan": "庚", "jiji": "午" },
    "1991": { "cheongan": "辛", "jiji": "未" },
    // ... 1940-2050
  },
  "monthPillars": {
    // 년간 + 월 → 월주 (년간에 따라 달라짐)
    "甲_1": { "cheongan": "丙", "jiji": "寅" },
    "甲_2": { "cheongan": "丁", "jiji": "卯" },
    // ...
  },
  "dayPillars": {
    // 날짜별 일주 (60갑자 순환)
    "1990-01-01": { "cheongan": "己", "jiji": "巳" },
    // ...
  }
}
```

### 3.2 타로 데이터 구조

```javascript
// data/tarot-major.json — 메이저 아르카나 22장
[
  {
    "id": 0,
    "name": "The Fool",
    "korean": "광대",
    "upright": ["새로운 시작", "모험", "순수함", "자유"],
    "reversed": ["무모함", "어리석음", "위험 무시"],
    "element": "공기",
    "love_upright": "새로운 만남의 시작, 운명적 인연",
    "love_reversed": "가벼운 관계, 무책임한 사랑",
    "wealth_upright": "새로운 투자 기회, 대담한 도전",
    "wealth_reversed": "무계획한 지출, 금전적 위험",
    "image_key": "major_00_fool"
  },
  // ... 22장 전체
]
```

```javascript
// data/tarot-minor.json — 마이너 아르카나 56장
[
  {
    "id": 22,
    "suit": "wands",
    "suit_korean": "완드",
    "rank": "ace",
    "name": "Ace of Wands",
    "korean": "완드 에이스",
    "upright": ["영감", "새로운 기회", "성장", "잠재력"],
    "reversed": ["지연", "의욕 상실", "창의성 부족"],
    "love_upright": "열정적 만남, 새로운 시작",
    "love_reversed": "권태, 열정 소진",
    "wealth_upright": "새로운 사업 기회",
    "wealth_reversed": "투자 실패 가능성",
    "image_key": "minor_wands_ace"
  },
  // ... 56장 전체 (완드/컵/소드/펜타클 x 14장)
]
```

### 3.3 앱 상태 (런타임)

```javascript
// battle.js 내부 상태 관리
const AppState = {
  // 사용자 입력
  user: {
    birthDate: null,    // "1990-05-15"
    birthTime: null,    // "14:30" or null
    gender: null        // "male" | "female"
  },

  // 사주 분석 결과 (1회 계산, 불변)
  saju: {
    pillars: {          // 사주팔자
      year: { cheongan: "庚", jiji: "午" },
      month: { cheongan: "辛", jiji: "巳" },
      day: { cheongan: "甲", jiji: "子" },
      hour: null        // 시간 미입력 시 null
    },
    dayMaster: "甲",    // 일간 (= 나)
    elements: { 목: 2, 화: 3, 토: 1, 금: 1, 수: 1 },  // 오행 분포
    tenGods: [],        // 십성 배치
    strength: "신강"     // "신강" | "신약"
  },

  // 타로 덱 상태 (라운드마다 변함)
  tarot: {
    deck: [],           // 남은 카드 (78장에서 시작, 드로우마다 감소)
    rounds: {
      1: [],            // R1 드로우 (3장)
      2: [],            // R2 드로우 (3장)
      3: []             // R3 드로우 (5장)
    }
  },

  // 배틀 진행
  battle: {
    currentRound: 0,    // 0=시작전, 1-3=진행중
    rounds: [
      { topic: "연애운", sajuReading: "", tarotReading: "", vote: null },
      { topic: "재물운", sajuReading: "", tarotReading: "", vote: null },
      { topic: "종합운세", sajuReading: "", tarotReading: "", vote: null }
    ],
    finalJudgment: "",
    winner: null        // "saju" | "tarot" | "draw"
  }
};
```

---

## 4. API Specification

### 4.1 Claude API 호출 스펙

이 프로젝트는 BaaS/REST API가 아닌 **Claude API를 AI 해석 엔진으로 사용**합니다.

| 호출 | Endpoint | 용도 | Timing |
|------|----------|------|--------|
| R1-사주 | `POST /messages` | 사주 연애운 해석 | 라운드1 시작 시 |
| R1-타로 | `POST /messages` | 타로 연애운 해석 | 라운드1 시작 시 |
| R2-사주 | `POST /messages` | 사주 재물운 해석 | 라운드2 시작 시 |
| R2-타로 | `POST /messages` | 타로 재물운 해석 | 라운드2 시작 시 |
| R3-사주 | `POST /messages` | 사주 종합운세 해석 | 라운드3 시작 시 |
| R3-타로 | `POST /messages` | 타로 종합운세 해석 | 라운드3 시작 시 |
| Final | `POST /messages` | 최종 종합 판정 | 3라운드 투표 완료 후 |

### 4.2 프롬프트 상세 설계

#### 사주 해석 프롬프트

```
시스템: 당신은 30년 경력의 사주 명리학 전문가입니다.
실제 사주 이론에 기반하여 정확하게 해석하되, 일반인이 이해하기 쉽고 재미있게 설명합니다.

사용자: 아래 사주팔자를 분석하여 {topic}에 대해 해석해주세요.

【사주팔자】
년주: {yearPillar.cheongan}{yearPillar.jiji}
월주: {monthPillar.cheongan}{monthPillar.jiji}
일주: {dayPillar.cheongan}{dayPillar.jiji}
{시주: {hourPillar.cheongan}{hourPillar.jiji} | 시주: 미상}

【분석 데이터】
일간(나): {dayMaster} ({element})
오행 분포: 목{n} 화{n} 토{n} 금{n} 수{n}
신강/신약: {strength}
성별: {gender}

【해석 주제】: {topic} (연애운/재물운/종합운세)

【응답 형식】
- 150~200자 이내
- 핵심 이론 용어 1-2개 포함 (예: "도화살", "식상생재")
- 구체적이고 흥미로운 해석
- 마지막에 한 줄 핵심 메시지
```

#### 타로 해석 프롬프트

```
시스템: 당신은 20년 경력의 타로 마스터입니다.
실제 타로 카드의 상징과 의미에 기반하여 정확하게 해석하되, 일반인이 이해하기 쉽고 재미있게 설명합니다.

사용자: 아래 타로 카드 스프레드를 해석하여 {topic}에 대해 알려주세요.

【스프레드: {spreadType}】
{position1}: {cardName} ({upright/reversed})
{position2}: {cardName} ({upright/reversed})
{position3}: {cardName} ({upright/reversed})
{position4}: {cardName} ({upright/reversed})  // R3만
{position5}: {cardName} ({upright/reversed})  // R3만

【해석 주제】: {topic}

【응답 형식】
- 150~200자 이내
- 카드 이름과 위치 의미 자연스럽게 포함
- 카드 간의 관계와 흐름 해석
- 마지막에 한 줄 핵심 메시지
```

#### 최종 판정 프롬프트

```
시스템: 당신은 동서양 점술 비교 전문가입니다.
사주와 타로의 해석을 종합적으로 비교하여 최종 판정을 내립니다.

사용자: 아래 3라운드 결과를 보고 최종 판정을 내려주세요.

【Round 1 - 연애운】
사주: {sajuReading1}
타로: {tarotReading1}
유저 투표: {vote1}

【Round 2 - 재물운】
사주: {sajuReading2}
타로: {tarotReading2}
유저 투표: {vote2}

【Round 3 - 종합운세】
사주: {sajuReading3}
타로: {tarotReading3}
유저 투표: {vote3}

【응답 형식】
- 승자 판정: "사주" 또는 "타로" (반드시 하나 선택)
- 판정 이유: 50자 이내
- 종합 한 줄 메시지: 재미있는 마무리
```

### 4.3 API 키 관리

```javascript
// MVP: 환경변수 또는 로컬 config (프론트엔드 노출 허용)
// .env 파일 (gitignore)
const API_KEY = window.__CONFIG__?.ANTHROPIC_API_KEY || '';

// config.js (gitignore 대상)
window.__CONFIG__ = {
  ANTHROPIC_API_KEY: 'sk-ant-...',
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 300
};
```

> **보안 참고**: MVP 한정. 프로덕션 배포 시 반드시 백엔드 프록시 필요.

---

## 5. UI/UX Design

### 5.1 Screen Layouts

#### Section 1: 인트로 화면

```
┌─────────────────────────────────┐
│                                 │
│      ⚡ VS ⚡                   │
│                                 │
│    ┌─────┐    ┌─────┐          │
│    │ 사주 │ VS │ 타로 │          │
│    │ 🏮  │    │ 🔮  │          │
│    └─────┘    └─────┘          │
│                                 │
│   동양의 운명 vs 서양의 직관     │
│   당신의 운세를 두고 벌이는      │
│        최후의 대결!              │
│                                 │
│     [ 대결 시작하기 ]            │
│                                 │
└─────────────────────────────────┘
```

#### Section 2: 입력 화면

```
┌─────────────────────────────────┐
│   🎯 당신의 정보를 입력하세요    │
├─────────────────────────────────┤
│                                 │
│  생년월일 (필수)                 │
│  ┌─────────────────────────┐   │
│  │ 1990년  05월  15일      │   │
│  └─────────────────────────┘   │
│                                 │
│  성별 (필수)                     │
│  [ 남성 ]  [ 여성 ]             │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│  출생시간 (선택 - 더 정확한 분석) │
│  ┌──────────┐                   │
│  │ 14시 30분 │  [ 모름 ]        │
│  └──────────┘                   │
│                                 │
│        [ 운명의 대결! ]          │
│                                 │
└─────────────────────────────────┘
```

#### Section 3: 배틀 화면

```
┌─────────────────────────────────┐
│  ═══ ROUND 1: 연애운 ═══       │
│  ▓▓▓░░░░░░░ (1/3)              │
├─────────────────────────────────┤
│                                 │
│ ┌──────────┐  VS  ┌──────────┐ │
│ │   사주    │      │   타로    │ │
│ │  🏮      │  ⚡  │      🔮  │ │
│ │          │      │          │ │
│ │ "갑목일간 │      │ "The     │ │
│ │  도화살이 │      │  Lovers  │ │
│ │  강하게   │      │  카드가   │ │
│ │  작용하여 │      │  정방향   │ │
│ │  ..."    │      │  으로..." │ │
│ │          │      │          │ │
│ └──────────┘      └──────────┘ │
│                                 │
│  어느 쪽이 더 공감되나요?        │
│  [ 🏮 사주 ]    [ 타로 🔮 ]    │
│                                 │
└─────────────────────────────────┘
```

#### Section 4: 결과 화면

```
┌─────────────────────────────────┐
│       🏆 최종 결과 🏆           │
├─────────────────────────────────┤
│                                 │
│      승자: 🏮 사주!             │
│      (투표 2:1 + AI 판정)       │
│                                 │
│  ┌─────────────────────────┐   │
│  │ R1 연애운:  사주 ✅      │   │
│  │ R2 재물운:  타로 ✅      │   │
│  │ R3 종합운세: 사주 ✅      │   │
│  └─────────────────────────┘   │
│                                 │
│  "운명의 사주팔자가 타로의       │
│   직관을 이겼습니다!             │
│   당신의 사주에 따르면..."       │
│                                 │
│   [ 🔗 결과 공유하기 ]          │
│   [ 🔄 다시 해보기 ]            │
│                                 │
└─────────────────────────────────┘
```

### 5.2 User Flow

```
[인트로] ──시작 버튼──▶ [입력] ──제출──▶ [로딩 애니메이션]
                                              │
  ┌───────────────────────────────────────────┘
  ▼
[R1 연애운] ──투표──▶ [R2 재물운] ──투표──▶ [R3 종합운세] ──투표──▶
                                                                │
  ┌─────────────────────────────────────────────────────────────┘
  ▼
[판정 애니메이션] ──▶ [최종 결과] ──공유/재시작──▶ [인트로]
```

### 5.3 Component List

| Section | HTML ID | JS 담당 모듈 | 역할 |
|---------|---------|-------------|------|
| 인트로 | `#section-intro` | app.js | 타이틀 + 시작 버튼 |
| 입력 | `#section-input` | app.js | 생년월일 + 성별 + 시간 폼 |
| 배틀 | `#section-battle` | battle.js | 라운드 진행 + VS 표시 + 투표 |
| 결과 | `#section-result` | battle.js | 최종 승패 + 종합 해석 |
| 공유 | `#section-share` | share.js | 이미지 생성 + SNS 공유 |

---

## 6. Error Handling

### 6.1 에러 시나리오

| 시나리오 | 원인 | 처리 |
|---------|------|------|
| 생년월일 미입력 | 필수값 누락 | 입력 폼 유효성 검사, 빨간 테두리 강조 |
| 만세력 범위 초과 | 1940 미만 또는 2050 초과 | "지원 범위: 1940~2050년" 메시지 표시 |
| Claude API 실패 | 네트워크/키 오류 | 재시도 버튼 표시 + 폴백 메시지("AI가 잠시 쉬는 중...") |
| API 키 미설정 | config 누락 | 설정 가이드 모달 표시 |
| 타로 덱 부족 | 11장 초과 드로우 | 발생 불가 (78장 > 11장), 방어 코드만 추가 |

### 6.2 API 에러 폴백

```javascript
// ai-interpreter.js
async function getInterpretation(prompt, retries = 2) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', { ... });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      await delay(1000);
      return getInterpretation(prompt, retries - 1);
    }
    return { fallback: true, text: "운세의 기운이 잠시 흐려졌습니다... 다시 시도해주세요." };
  }
}
```

---

## 7. Security Considerations

- [x] **입력 유효성 검사**: 생년월일 범위, 성별 값 검증 (XSS 방지 — textContent 사용)
- [x] **API 키 보호**: `.gitignore`에 config.js 추가, MVP 한정 프론트엔드 노출
- [ ] **프로덕션 시 백엔드 프록시 필수** (MVP 이후)
- [x] **innerHTML 미사용**: textContent 또는 createElement로 DOM 조작

---

## 8. Test Plan

### 8.1 수동 테스트 (Zero Script QA)

이 프로젝트는 Vanilla JS이므로 브라우저 수동 테스트 + 콘솔 로그 기반 검증.

| 테스트 | 입력 | 기대 결과 |
|--------|------|----------|
| 사주 계산 정확성 | 1990-05-15 남성 | 庚午년 辛巳월 甲子일 산출 확인 |
| 타로 드로우 중복 없음 | 3라운드 진행 | 11장 모두 서로 다른 카드 |
| 라운드 진행 흐름 | 전체 플로우 | 인트로→입력→R1→R2→R3→결과 순서 |
| 투표 기능 | 사주/타로 클릭 | 투표 결과 정확히 기록 |
| API 에러 폴백 | API 키 없이 실행 | 폴백 메시지 표시, 크래시 없음 |
| SNS 공유 | 공유 버튼 클릭 | 이미지 생성 + 공유 URL 복사 |
| 모바일 반응형 | 375px 뷰포트 | 레이아웃 깨짐 없음 |

---

## 9. 사주 엔진 상세 설계

### 9.1 만세력 변환 알고리즘

```
양력 날짜 → manseryeok.json에서 조회
  → yearPillars[year]: 년주 (천간+지지)
  → monthPillars[년간_month]: 월주
  → dayPillars[YYYY-MM-DD]: 일주
  → hourPillar(일간, hour): 시주 (시간표 기반)
```

### 9.2 십성 계산 로직

```
일간(Day Master)을 기준으로 나머지 글자의 십성을 결정:

같은 오행 + 같은 음양 = 비견
같은 오행 + 다른 음양 = 겁재
내가 생하는 오행 + 같은 음양 = 식신
내가 생하는 오행 + 다른 음양 = 상관
내가 극하는 오행 + 같은 음양 = 편재
내가 극하는 오행 + 다른 음양 = 정재
나를 극하는 오행 + 같은 음양 = 편관
나를 극하는 오행 + 다른 음양 = 정관
나를 생하는 오행 + 같은 음양 = 편인
나를 생하는 오행 + 다른 음양 = 정인
```

### 9.3 오행 상생/상극 테이블

```javascript
const SANG_SAENG = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" }; // 내가 생함
const SANG_GEUK = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" }; // 내가 극함
```

---

## 10. 타로 엔진 상세 설계

### 10.1 덱 셔플 + 드로우

```javascript
// Fisher-Yates 셔플
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 카드 드로우 (정/역방향 랜덤)
function drawCards(deck, count) {
  const drawn = deck.splice(0, count);
  return drawn.map(card => ({
    ...card,
    isReversed: Math.random() < 0.5
  }));
}
```

### 10.2 라운드별 스프레드

| Round | 주제 | 장수 | 위치 의미 |
|-------|------|------|----------|
| R1 | 연애운 | 3장 | 과거 / 현재 / 미래 |
| R2 | 재물운 | 3장 | 현재 상황 / 조언 / 결과 |
| R3 | 종합운세 | 5장 | 현재 / 도전 / 과거 / 미래 / 결과 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
saju-vs-tarot-battle/
├── index.html
├── config.js              ← API 키 (.gitignore)
├── css/
│   ├── style.css
│   └── animations.css
├── js/
│   ├── app.js             ← 진입점 + 화면 전환
│   ├── saju.js            ← 사주 계산 엔진
│   ├── tarot.js           ← 타로 카드 엔진
│   ├── battle.js          ← 배틀 진행 + 투표
│   ├── ai-interpreter.js  ← Claude API 호출
│   └── share.js           ← 결과 이미지 + SNS
├── data/
│   ├── cheongan.json
│   ├── jiji.json
│   ├── sipsung.json
│   ├── manseryeok.json
│   ├── tarot-major.json
│   └── tarot-minor.json
├── assets/
│   └── images/
├── .gitignore
└── docs/
    ├── 01-plan/
    └── 02-design/
```

### 11.2 Implementation Order

1. [ ] **데이터 파일 생성** — 사주 JSON (천간, 지지, 십성, 만세력) + 타로 JSON (메이저 22, 마이너 56)
2. [ ] **사주 엔진** — 만세력 변환 + 오행 분석 + 십성 계산
3. [ ] **타로 엔진** — 덱 셔플 + 드로우 + 스프레드 관리
4. [ ] **HTML 골격** — 5개 섹션 레이아웃 + 입력 폼
5. [ ] **CSS 스타일** — 기본 스타일 + 모바일 반응형
6. [ ] **AI 해석기** — Claude API 연동 + 프롬프트 구현
7. [ ] **배틀 엔진** — 라운드 진행 + 투표 + 최종 판정
8. [ ] **애니메이션** — VS 등장, 라운드 전환, 승리 연출
9. [ ] **공유 모듈** — html2canvas + SNS 공유
10. [ ] **통합 테스트** — 전체 플로우 확인

### 11.3 구현 시 핵심 결정 포인트

> 아래 항목들은 구현(Do) 단계에서 유저가 직접 코드를 작성하며 결정할 부분입니다:

1. **만세력 데이터 범위**: 전체 1940-2050 vs 축소 범위
2. **애니메이션 스타일**: CSS transition vs CSS @keyframes vs Web Animations API
3. **API 호출 전략**: 라운드별 순차 vs 전체 일괄 vs 사주/타로 병렬
4. **결과 이미지 디자인**: 카드형 vs 인포그래픽형

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-05 | Initial draft | taekim34 |
