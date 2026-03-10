# Plan: topic-selection (유저 주제 선택 + 주제별 질문 + 데이터 마이그레이션)

> Created: 2026-03-10
> Feature: topic-selection
> Status: Plan
> PRD: docs/00-pm/topic-selection.prd.md

## Executive Summary

| Perspective | Description |
|-------------|-------------|
| **Problem** | 고정 3라운드(연애운→재물운→종합운세)는 사용자 관심사 불일치, 단일 질문으로 3주제 커버 불가, 재방문 동기 부족 |
| **Solution** | 7개 주제 중 3개 선택 UI + 주제별 개별 질문 + 데이터 스키마 소프트 마이그레이션 |
| **Functional UX Effect** | "내가 고른 3판" 경험으로 운세 몰입감 강화, 주제 맞춤 질문으로 AI 해석 정확도 향상 |
| **Core Value** | 35가지 조합(7C3)으로 재방문 동기 자연 발생 + 주제별 깊이 있는 해석 |

## 1. Overview

사용자가 7개 운세 주제 중 3개를 직접 선택하여 배틀을 진행한다. 각 주제에 대해 개별 질문을 입력할 수 있고, 결과는 라운드 번호가 아닌 주제명으로 구분된다. 기존 데이터는 소프트 마이그레이션으로 하위호환성을 유지한다.

### 변경 범위 요약

| 영역 | 현재 | 변경 후 |
|------|------|---------|
| 주제 | 고정 3개 (연애운/재물운/종합운세) | 7개 중 3개 선택 |
| 질문 | 1개 (전체 공용) | 주제별 각 1개 (선택) |
| 결과 표시 | "라운드 1, 2, 3" | 주제명으로 표시 |
| 통계 | `r1_vote`/`r2_vote`/`r3_vote` | 주제 기반 + 기존 필드 유지 |
| API 콜 | 7회/세션 | 7회/세션 (변동 없음) |

## 2. Scope

### In Scope
- 7개 주제 목록 + 3개 선택 UI (입력 화면)
- 주제별 개별 질문 입력 필드
- BattleEngine 동적 TOPICS 변경
- AIInterpreter 4개 신규 주제 프롬프트 추가 (직업운, 건강운, 학업운, 대인관계)
- 결과 화면 + 공유 페이지 주제명 표시
- BkendClient 확장 필드 (topics, questions) + 기존 필드 호환
- 통계 화면 주제 기반 표시

### Out of Scope
- 궁합 (2인 입력 필요 — 별도 모드)
- 4개 이상 주제 프리미엄 모드
- 주제 커스텀 생성
- 랜덤 주제 추천 ("운명에 맡기기")

## 3. Requirements

### 3.1 주제 선택 UI

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| T1 | 주제 목록 정의 | 7개 주제 (ID, 이름, 이모지, placeholder) | config.js |
| T2 | 선택 UI | 카드/칩 형태, 정확히 3개 선택, 순서 = 배틀 순서 | index.html, style.css, app.js |
| T3 | 기본 선택 | 연애운, 재물운, 종합운세 사전 선택 | app.js |
| T4 | 선택 검증 | 3개 미만/초과 시 진행 불가, 에러 메시지 | app.js |

### 3.2 주제별 질문 입력

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| Q1 | 질문 입력 필드 | 선택된 3개 주제에 대해 각각 질문 입력 | index.html, app.js |
| Q2 | 플레이스홀더 | 주제별 맞춤 예시 질문 | config.js |
| Q3 | 선택 사항 | 비워두면 LLM이 주제에만 집중 | battle.js |
| Q4 | 글자 수 제한 | maxlength: 100 | index.html |

### 3.3 배틀 엔진 변경

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| B1 | 동적 TOPICS | `init()`에서 사용자 선택 3개를 TOPICS로 설정 | battle.js |
| B2 | 주제별 질문 전달 | `nextRound()`에서 현재 주제의 개별 질문 사용 | battle.js |
| B3 | roundData에 topic 명시 | 이미 있지만, 동적 주제가 반영되도록 보장 | battle.js |

### 3.4 AI 프롬프트 확장

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| A1 | 사주 topicMap 확장 | 직업운, 건강운, 학업운, 대인관계 추가 | ai-interpreter.js |
| A2 | 사주 프롬프트 구조 | 4개 신규 주제별 답변 구조 템플릿 | ai-interpreter.js |
| A3 | 타로 topicMap 확장 | 동일 4개 주제 추가 | ai-interpreter.js |
| A4 | 타로 프롬프트 구조 | 4개 신규 주제별 답변 구조 템플릿 | ai-interpreter.js |

### 3.5 결과 표시 변경

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| R1 | 라운드 표시 | "ROUND 1" → "💞 연애운" (이모지 + 주제명) | app.js |
| R2 | 최종 결과 | 주제명으로 라운드별 결과 표시 | app.js |
| R3 | 공유 페이지 | 주제명 반영 + 어떤 3개 주제인지 표시 | app.js (showSharedResult) |

### 3.6 데이터 스키마 + 마이그레이션

| # | 항목 | 설명 | 수정 파일 |
|---|------|------|-----------|
| D1 | saveResult 확장 | `topics: [...]`, `questions: { topic: question }` 추가 | bkend-client.js |
| D2 | saveStat 확장 | `topics: [...]` 추가, `r1_vote`~`r3_vote` 유지 (호환) | bkend-client.js |
| D3 | getResult 호환 | `topics` 없으면 기본값 `['연애운','재물운','종합운세']` | bkend-client.js, app.js |
| D4 | 통계 쿼리 호환 | 기존 `r1_vote` 필터 유지 + 주제별 신규 쿼리 추가 | stats.js |
| D5 | 통계 UI | "라운드별 투표" → "주제별 투표" (주제명 표시) | stats.js |

## 4. Implementation Order

```
Phase 1: 데이터 레이어 (하위호환 보장)
  D1 → D2 → D3 → D4

Phase 2: 엔진 레이어
  T1 → B1 → B2 → B3

Phase 3: AI 프롬프트
  A1 → A2 → A3 → A4

Phase 4: UI 레이어
  T2 → T3 → T4 → Q1 → Q2 → Q3 → Q4

Phase 5: 결과 + 공유
  R1 → R2 → R3

Phase 6: 통계
  D5
```

## 5. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 신규 주제 AI 해석 품질 | High | 프롬프트 사전 테스트, 기존 주제와 동일한 구조 |
| 기존 공유 URL 깨짐 | High | `topics` 없으면 기본 3개로 fallback |
| 주제 선택 추가로 UX 복잡 | Medium | 기본 3개 사전 선택, 원터치 변경 |
| 통계 호환성 | Low | 기존 필드 유지 + 신규 필드 추가 (soft migration) |

## 6. Affected Files

| File | Changes |
|------|---------|
| `config.js` | TOPICS 배열 (7개 주제 정의 + placeholder) |
| `index.html` | 주제 선택 UI + 주제별 질문 입력 필드 |
| `css/style.css` | 주제 칩 스타일, 질문 필드 스타일 |
| `js/battle.js` | 동적 TOPICS, 주제별 질문 전달 |
| `js/ai-interpreter.js` | 4개 신규 주제 프롬프트 (사주 + 타로) |
| `js/app.js` | 주제 선택 로직, 결과 표시, 공유 페이지 |
| `js/bkend-client.js` | topics/questions 필드 확장 |
| `js/stats.js` | 주제 기반 통계 표시 |
