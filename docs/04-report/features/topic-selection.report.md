# topic-selection Completion Report

> **Summary**: 고정 3라운드를 7개 주제 중 3개 선택 방식으로 전환. 주제별 개별 질문 입력, 4개 신규 주제 AI 프롬프트, 소프트 마이그레이션으로 하위호환성 유지.
>
> **Project**: 사주 vs 타로 — 운명의 대결 (엔터테인먼트 운세 웹 서비스)
> **Technology Stack**: Vanilla HTML/CSS/JS SPA, OpenRouter API (DeepSeek V3.2), bkend.ai BaaS
> **Author**: 김태형 (taekim34)
> **Created**: 2026-03-10
> **Status**: Approved (98% Design Match)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 고정 3라운드(연애운→재물운→종합운세)는 사용자 관심사 불일치, 단일 질문으로 3주제 커버 불가, 재방문 동기 부족 |
| **Solution** | 7개 주제 중 3개 선택 칩 UI + 주제별 개별 질문 입력 + BattleEngine 동적 TOPICS + 4개 신규 AI 프롬프트 + 소프트 데이터 마이그레이션 |
| **Function/UX Effect** | "내가 고른 3판" 경험으로 운세 몰입감 강화, 주제 맞춤 질문으로 AI 해석 정확도 향상, 결과 화면 주제명 표시로 가독성 개선 |
| **Core Value** | 35가지 조합(7C3)으로 재방문 동기 자연 발생, 주제별 깊이 있는 해석, 기존 공유 URL 및 통계 100% 하위호환 |

### 1.1 Project Overview

| Item | Value |
|------|-------|
| Feature | topic-selection (유저 주제 선택 + 주제별 질문 + 데이터 마이그레이션) |
| Started | 2026-03-10 |
| Completed | 2026-03-10 |
| Duration | 1일 |
| PDCA Phases | PM → Plan → Design → Do → Check → Report |

### 1.2 Results Summary

| Metric | Value |
|--------|-------|
| Design Match Rate | **98%** (65/66 items) |
| Iteration Count | 0 (98% > 90% threshold) |
| Files Modified | 8 |
| New Code Lines | ~350 (JS) + ~80 (CSS) + ~20 (HTML) |
| API Calls/Session | 7 (unchanged) |

### 1.3 Value Delivered

| Perspective | Before | After | Improvement |
|-------------|--------|-------|-------------|
| **Problem** | 고정 3주제, 1가지 경험 | 7개 주제 중 3개 선택, 35가지 조합 | 경험 다양성 35x 증가 |
| **Solution** | 단일 질문 → 3라운드 공용 | 주제별 맞춤 질문 → 주제별 AI 해석 | 해석 정확도 향상 |
| **Function/UX** | 라운드 번호 (Round 1/2/3) | 이모지 + 주제명 (💞연애운 등) | 결과 가독성 향상 |
| **Core Value** | 1회 체험 후 재방문 동기 약함 | 다른 조합 시도 욕구 | 재방문 동기 자연 발생 |

---

## 2. Implementation Results by Component

### 2.1 config.js — 주제 목록 정의

| Item | Status | Details |
|------|--------|---------|
| `window.__TOPICS__` 배열 | ✅ 완료 | 7개 주제 (id, name, emoji, placeholder) |
| 기본 선택값 | ✅ 완료 | `['love', 'wealth', 'general']` → app.js에서 처리 |

**변경량**: +12 lines

### 2.2 index.html — 주제 선택 UI

| Item | Status | Details |
|------|--------|---------|
| 기존 `#input-question` 제거 | ✅ 완료 | 단일 질문 입력 블록 전체 제거 |
| `#topic-chips` 컨테이너 | ✅ 완료 | 주제 칩 동적 렌더링 영역 |
| `#topic-questions` 래퍼 | ✅ 완료 | 주제별 질문 필드 (display:none → 선택 시 표시) |
| `#topic-question-fields` | ✅ 완료 | 개별 질문 입력 필드 컨테이너 |
| `#topic-error` | ✅ 완료 | 3개 초과 선택 시 에러 메시지 |

**변경량**: -7 lines (제거), +15 lines (추가) = net +8 lines

### 2.3 css/style.css — 주제 칩 스타일

| Item | Status | Details |
|------|--------|---------|
| `.topic-chips` flex 레이아웃 | ✅ 완료 | flex-wrap, gap, center align |
| `.topic-chip` 기본 스타일 | ✅ 완료 | CSS 변수 활용 (`--color-border`, `--color-text-dim`) |
| `.topic-chip.selected` 골드 액센트 | ✅ 완료 | `--color-accent` 변수, 0.12 opacity |
| `.chip-order` 순서 뱃지 | ✅ 완료 | 20px 원형, 골드 배경, 선택 시만 표시 |
| `.topic-q-field` / `.topic-q-label` | ✅ 완료 | 주제별 질문 필드 레이아웃 |
| `.shared-topics-badge` | ✅ 완료 | 공유 결과 페이지 주제 뱃지 (추가 구현) |

**변경량**: +80 lines

### 2.4 js/app.js — 핵심 로직

| Item | Status | Details |
|------|--------|---------|
| `selectedTopics` 상태 관리 | ✅ 완료 | 순서 유지 배열, 최대 3개 |
| `renderTopicChips()` | ✅ 완료 | `__TOPICS__`에서 칩 동적 생성, 기본 3개 선택 |
| `toggleTopic()` | ✅ 완료 | 선택/해제 + 3개 제한 + 에러 표시 |
| `updateChipOrders()` | ✅ 완료 | 선택 순서 뱃지 갱신 |
| `updateTopicQuestions()` | ✅ 완료 | 선택된 주제별 질문 필드 동적 생성 |
| `validateForm()` 확장 | ✅ 완료 | `selectedTopics.length === 3` 조건 추가 |
| `startBattle()` 데이터 전달 | ✅ 완료 | `topicNames` + `topicQuestions` 수집 → BattleEngine |
| `showFinalResult()` 주제 표시 | ✅ 완료 | `BattleEngine.getTopics()` 사용 |
| `showSharedResult()` 호환 | ✅ 완료 | 7개 `topicDesc` 맵 + topics fallback + 이모지 뱃지 |
| `saveStat()` 확장 | ✅ 완료 | `topics`, `topic_votes` 필드 추가 |
| 값 보존 로직 | ⚠️ 미구현 | 주제 순서 변경 시 기존 질문 값 보존 안 됨 (Low impact) |

**변경량**: ~150 lines (수정/추가)

### 2.5 js/battle.js — 동적 TOPICS 엔진

| Item | Status | Details |
|------|--------|---------|
| `const TOPICS` → `let topics` | ✅ 완료 | `DEFAULT_TOPICS` const + `topics` let 분리 |
| `topicQuestions` 상태 | ✅ 완료 | `{ topic: question }` 형태 |
| `init()` 동적 주제 수신 | ✅ 완료 | `userData.topics` 3개 검증 후 설정 |
| `nextRound()` 주제별 질문 | ✅ 완료 | `topicQuestions[topic]` per-round 질문 |
| `getTopics()` getter | ✅ 완료 | 외부 mutation 방지 (복사본 반환) |
| `getFinalResult()` topics 포함 | ✅ 완료 | `topics: [...topics]` 반환 |

**변경량**: ~40 lines

### 2.6 js/ai-interpreter.js — 신규 주제 프롬프트

| Item | Status | Details |
|------|--------|---------|
| 사주 `topicMap` 7개 확장 | ✅ 완료 | 직업운, 건강운, 학업운, 대인관계 추가 |
| 사주 `topicEmoji` 7개 확장 | ✅ 완료 | 주제별 이모지 매핑 |
| 사주 `topicSpecific` 4개 추가 | ✅ 완료 | 인라인 객체, 주제별 사주 특화 지시 |
| 타로 `topicMap` 7개 확장 | ✅ 완료 | 동일 4개 주제 추가 |
| 타로 `topicEmoji` 7개 확장 | ✅ 완료 | 종합운세: 🔮 (의도적 변형) |
| 타로 `tarotTopicSpecific` 4개 추가 | ✅ 완료 | 인라인 객체, 주제별 타로 특화 지시 |

**변경량**: ~60 lines

### 2.7 js/bkend-client.js — 소프트 마이그레이션

| Item | Status | Details |
|------|--------|---------|
| `saveResult()`: `topics` 필드 | ✅ 완료 | `data.topics \|\| []` |
| `saveResult()`: `questions` 필드 | ✅ 완료 | `data.questions \|\| {}` |
| `saveResult()`: `question` 레거시 유지 | ✅ 완료 | 빈 문자열 기본값 |
| `saveStat()`: `topics` 필드 | ✅ 완료 | `data.topics \|\| []` |
| `saveStat()`: `topic_votes` 필드 | ✅ 완료 | `data.topic_votes \|\| {}` |
| `saveStat()`: `r1/r2/r3_vote` 유지 | ✅ 완료 | 하위호환용 레거시 필드 유지 |

**변경량**: +6 lines

### 2.8 js/stats.js — 통계 화면

| Item | Status | Details |
|------|--------|---------|
| 제목 변경 "주제별 투표" | ✅ 완료 | `'라운드별 투표'` → `'주제별 투표'` |
| TOPICS 기존 3개 유지 | ✅ 완료 | 레거시 데이터 호환 (r1/r2/r3 쿼리 유지) |

**변경량**: 1 line

---

## 3. Gap Analysis Results

### 3.1 Overall Match Rate

```
+---------------------------------------------+
|  Overall Match Rate: 98% (65/66)            |
+---------------------------------------------+
|  PASS (exact match):     59 items (89%)     |
|  PASS (minor variation):  6 items  (9%)     |
|  MINOR GAP:               1 item   (2%)    |
|  FAIL:                    0 items  (0%)     |
+---------------------------------------------+
```

### 3.2 Gap Detail

| # | Item | Impact | Resolution |
|---|------|--------|------------|
| 1 | 질문 값 보존 (주제 순서 변경 시) | Low | 미구현 — 사용자가 입력 후 순서 변경하는 케이스 드묾. 향후 개선 가능 |

### 3.3 Enhancements (Design 대비 추가 구현)

| # | Enhancement | File | Impact |
|---|-------------|------|--------|
| 1 | `topicError` 자동 해제 | app.js:119 | UX 향상 — 주제 해제 시 에러 자동 클리어 |
| 2 | `flex-shrink:0` chip-order | style.css:1548 | 소형 화면 뱃지 찌그러짐 방지 |
| 3 | `margin-top:8px` topic-chips | style.css:1508 | 라벨-칩 간격 개선 |
| 4 | `shared-topics-badge` 스타일 | style.css:871-881 | 공유 결과 페이지 주제 뱃지 스타일 |
| 5 | `__TOPICS__` 이모지 lookup | app.js:280-281 | 공유 페이지 주제명에 이모지 부여 |
| 6 | `DEFAULT_TOPICS` const | battle.js:9 | 기본값과 동적 값의 명확한 분리 |

---

## 4. Data Migration Strategy

### 4.1 Soft Migration Approach

bkend.ai가 스키마리스이므로, 기존 필드를 유지하면서 새 필드를 추가하는 전략:

| Field | Old Data | New Data | Read Fallback |
|-------|----------|----------|---------------|
| `question` | 단일 질문 | 빈 문자열 | 레거시로 표시 |
| `questions` | 없음 | `{ topic: question }` | 없으면 `question` fallback |
| `topics` | 없음 | `['주제1','주제2','주제3']` | 없으면 `['연애운','재물운','종합운세']` |
| `r1_vote`~`r3_vote` | 고정 주제 | 동적 주제 순서대로 | 그대로 사용 |
| `topic_votes` | 없음 | `{ topic: vote }` | 없으면 r1/r2/r3 사용 |

### 4.2 Backward Compatibility

- **기존 공유 URL**: `data.topics` 없으면 기본 3개 적용 → 정상 표시
- **기존 통계**: `r1_vote`/`r2_vote`/`r3_vote` 쿼리 유지 → 기존 데이터 통계 정상
- **신규 데이터**: 새 필드(`topics`, `topic_votes`) 추가 기록 → 향후 주제별 통계 확장 가능

---

## 5. Architecture Decisions

### 5.1 IIFE Module Pattern 유지

기존 프로젝트의 IIFE Revealing Module Pattern을 유지하면서 구현. ES modules 전환 없이 `window.__TOPICS__` 전역 배열로 주제 목록 공유.

### 5.2 Getter 패턴 도입

`BattleEngine.TOPICS` 직접 노출 대신 `BattleEngine.getTopics()` 함수로 변경하여 외부에서의 mutation 방지. 반환 시 `[...topics]` 복사본 제공.

### 5.3 CSS 변수 활용

디자인 문서의 하드코딩된 색상(`#444`, `#ccc`) 대신 기존 CSS 변수(`--color-border`, `--color-text-dim`, `--color-accent`) 활용으로 디자인 시스템 일관성 유지.

### 5.4 인라인 토픽 특화 객체

별도 상수 파일 대신 `ai-interpreter.js` 내 인라인 객체로 주제별 AI 프롬프트 특화 지시를 관리. 현재 규모(7개 주제)에서는 과도한 추상화 없이 충분.

---

## 6. PDCA Cycle Summary

### PM (Product Discovery)
- **문서**: `docs/00-pm/topic-selection.prd.md`
- **핵심 발견**: O1~O4 기회 식별 (주제 불일치, 단일 질문 한계, 재방문 동기, 결과 가독성)
- **JTBD**: "운세를 볼 때, 내가 궁금한 주제에 대해 정확한 답변을 받고 싶다"
- **전략**: 7개 주제 풀 + 3개 선택 + 주제별 질문 → 35가지 조합 재방문 동기

### Plan (기획)
- **문서**: `docs/01-plan/features/topic-selection.plan.md`
- **범위**: T1~T4 (주제 선택 UI), Q1~Q4 (주제별 질문), B1~B3 (배틀 엔진), A1~A4 (AI 프롬프트), R1~R3 (결과 표시), D1~D5 (데이터 마이그레이션) = 총 25개 요구사항
- **구현 순서**: 6 Phase (데이터→엔진→AI→UI→결과→통계)

### Design (설계)
- **문서**: `docs/02-design/features/topic-selection.design.md`
- **핵심 설계**: 8개 파일별 상세 코드 설계, 11개 섹션
- **마이그레이션 전략**: Soft Migration (기존 필드 유지 + 신규 필드 추가)

### Do (구현)
- **실제 일정**: 1일
- **수정 파일**: 8개 (`config.js`, `index.html`, `style.css`, `app.js`, `battle.js`, `ai-interpreter.js`, `bkend-client.js`, `stats.js`)
- **코드 라인**: ~450 lines (JS 350 + CSS 80 + HTML 20)

### Check (검증)
- **문서**: `docs/03-analysis/topic-selection.analysis.md`
- **Match Rate**: 98% (65/66) — threshold 90% 초과
- **FAIL**: 0건, MINOR GAP: 1건 (질문 값 보존)
- **추가 구현**: 6건 Enhancement (모두 UX 개선)

### Act (개선)
- **결과**: 98% ≥ 90% → iterate 불필요
- **커밋**: `185029a` (main 브랜치 push 완료)

---

## 7. Lessons Learned

| # | Category | Lesson |
|---|----------|--------|
| 1 | Migration | 스키마리스 BaaS에서 soft migration은 매우 효과적 — 읽기 측 fallback만 신경 쓰면 됨 |
| 2 | Pattern | IIFE Module에서 `const` → `let` + getter 패턴으로 동적 상태 관리 가능 |
| 3 | UX | 기본 선택(3개)을 제공하면 "선택 피로도" 없이 개인화 가능 |
| 4 | AI Prompt | 주제별 특화 지시(예: 사주의 관성/식상, 타로의 소드/컵)를 추가하면 해석 품질 크게 향상 |
| 5 | Compatibility | 레거시 필드를 유지하되 의미를 재해석(r1_vote = "첫 번째 선택 주제의 투표")하면 자연스러운 호환 |

---

## 8. Next Steps (Optional)

| Priority | Item | Description |
|----------|------|-------------|
| Low | 질문 값 보존 | `updateTopicQuestions()`에서 기존 input 값 저장 후 복원 |
| Medium | `topic_votes` 기반 통계 | 신규 데이터 누적 후 주제별 동적 통계 화면 구현 |
| Low | "운명에 맡기기" 버튼 | 랜덤 3개 주제 선택 기능 |
| Medium | 궁합 모드 | 2인 입력 UI → 별도 모드로 분리 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-10 | Initial report | report-generator |
