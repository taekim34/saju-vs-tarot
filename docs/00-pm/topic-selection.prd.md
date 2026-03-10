# PRD: Topic Selection (주제 선택 기능)

**Feature**: topic-selection
**Product**: 사주 vs 타로 -- 운명의 대결
**Date**: 2026-03-10
**Status**: Draft

---

## Executive Summary

| Perspective | Description |
|-------------|-------------|
| **Problem** | 고정된 3라운드(연애운->재물운->종합운세)는 사용자의 실제 관심사를 반영하지 못해 재방문율이 낮음 |
| **Solution** | 7개 주제 중 3개를 사용자가 직접 선택하고, 주제별 맞춤 질문을 입력할 수 있게 함 |
| **Functional UX Effect** | 입력 화면에서 주제를 고르는 인터랙션이 추가되어 "내 운세" 라는 느낌이 강화됨 |
| **Core Value** | 선택권 부여로 재방문 동기 생성 (다른 주제 조합 시도) + 주제별 질문으로 해석 정확도 향상 |

---

## 1. Discovery: Opportunity Solution Tree

### Desired Outcome
사용자 참여도 및 재방문율 증가 (세션당 체류 시간 +30%, 재방문율 +50%)

### Customer Opportunities

| # | Opportunity | Evidence |
|---|------------|----------|
| O1 | 사용자가 자신에게 관련 없는 주제(예: 연애운)에 흥미를 잃음 | 현재 연애운이 1라운드 고정 -- 연애에 관심 없는 사용자에게 무의미 |
| O2 | 하나의 질문으로 3개 주제를 커버하기 어려움 | "이직 고민" 질문이 연애운 라운드에서 무시됨 (LLM relevance filter) |
| O3 | 3라운드가 항상 같아 재방문 동기 부족 | 한 번 해보면 결과 구조가 예측 가능해짐 |
| O4 | 결과 공유 시 받는 사람이 어떤 주제인지 혼동 | "라운드 1, 2, 3"이라는 표현은 주제를 전달하지 못함 |

### Solutions per Opportunity

| Opportunity | Solution | Experiment |
|------------|----------|------------|
| O1 | 7개 주제 풀에서 3개 선택 UI | A/B: 고정 vs 선택 -- 3라운드 완주율 비교 |
| O2 | 주제별 개별 질문 입력 | 주제별 질문 유무에 따른 AI 해석 만족도 비교 |
| O3 | 주제 조합에 따른 다양한 결과 | 재방문 사용자의 주제 변경 비율 추적 |
| O4 | 결과를 주제명으로 표시 (Round X -> 주제명) | 공유 URL 클릭률 비교 |

---

## 2. Strategy

### 2.1 JTBD (Jobs To Be Done) -- 6-Part Value Proposition

| Part | Content |
|------|---------|
| **When** | 고민이 있거나 궁금한 일이 생겼을 때 |
| **I want to** | 나에게 가장 관련 있는 운세 주제를 골라서 |
| **So I can** | 진짜 궁금한 것에 대한 깊이 있는 해석을 받고 |
| **Not** | 관심 없는 주제의 해석을 건너뛰며 지루해하는 대신 |
| **Job** | 내 상황에 맞는 맞춤형 운세 대결을 경험 |
| **Hiring Criteria** | 주제 선택의 자유도, 주제별 질문 맞춤 가능성, 결과의 구체성 |

### 2.2 Lean Canvas

| Section | Content |
|---------|---------|
| **Problem** | (1) 고정 주제가 사용자 관심사와 불일치 (2) 단일 질문으로 3라운드 커버 불가 (3) 재방문 동기 부족 |
| **Customer Segments** | 20-40대 운세에 흥미 있는 한국어 사용자, SNS 공유 성향 |
| **Unique Value Proposition** | "내가 고른 3판, 운명의 맞춤 대결" -- 동일 서비스에서 35가지 주제 조합(7C3) 가능 |
| **Solution** | 7개 주제 선택 UI + 주제별 질문 입력 + 주제 기반 결과 표시 |
| **Channels** | 기존 Cloudflare Pages 배포, SNS 공유 (주제명 포함 결과) |
| **Revenue Streams** | 무료 서비스 (향후 프리미엄 주제 추가 가능성) |
| **Cost Structure** | OpenRouter API 비용 (변동 없음 -- 여전히 7 API 콜/세션) |
| **Key Metrics** | 3라운드 완주율, 재방문율, 주제별 선택 분포, 공유율 |
| **Unfair Advantage** | 사주+타로 동시 비교라는 독특한 컨셉에 맞춤 주제까지 추가 |

---

## 3. Research

### 3.1 User Personas

#### Persona 1: 취준생 민지 (24세, 여성)
- **Context**: 취업 준비 중, 학업운과 직업운이 가장 궁금
- **Pain**: 연애운 라운드를 억지로 봐야 함, 관련 없는 해석에 시간 낭비
- **Goal**: 학업운 + 직업운 + 종합운세 조합으로 진로 고민 해소
- **Behavior**: 결과를 친구에게 공유하여 "나도 해봐" 유도

#### Persona 2: 직장인 현수 (32세, 남성)
- **Context**: 이직 고민 + 재테크 관심, 건강 관리 필요성 인지
- **Pain**: 연애운보다 재물운/직업운/건강운이 궁금하지만 선택 불가
- **Goal**: 재물운 + 직업운 + 건강운으로 현실적 조언
- **Behavior**: 점심시간에 빠르게 확인, 재미있으면 동료에게 공유

#### Persona 3: 대학생 수연 (21세, 여성)
- **Context**: 연애 시작, 대인관계 고민, SNS 활발
- **Pain**: 종합운세보다 연애운/대인관계에 집중하고 싶음
- **Goal**: 연애운 + 대인관계 + 종합운세 맞춤 조합
- **Behavior**: 결과 캡처하여 인스타 스토리 공유, 재방문하여 다른 조합 시도

### 3.2 Competitor Analysis

| # | Competitor | Topic Selection | Per-Topic Questions | Battle Format | Differentiator |
|---|-----------|----------------|--------------------|--------------|----|
| 1 | **점신** (1900만 유저) | 주제별 별도 서비스 (카테고리 분리) | 없음 (자동 해석) | 없음 (단일 해석) | 대규모 유저 기반, 다양한 콘텐츠 |
| 2 | **포스텔러** (46개 주제) | 46개 주제 개별 선택 | 없음 | 없음 | 점성술/타로/사주 통합 |
| 3 | **헬로우봇** | 채팅형 주제 선택 | 대화로 질문 입력 | 없음 | AI 챗봇 기반 |
| 4 | **Tarot Fortune AI** | 9개 주제 선택 | 주제별 질문 가능 | 없음 | AI 타로 전문 |
| 5 | **신한라이프 운세** | 카테고리별 메뉴 | 없음 | 없음 | 보험사 제공 무료 서비스 |

**Competitive Gap**: 어떤 경쟁사도 "사주 vs 타로 대결" 포맷에 주제 선택을 결합한 서비스는 없음. 주제 선택 + 대결 포맷 + 주제별 질문의 3중 차별화 가능.

### 3.3 Market Sizing

| Metric | Estimate | Basis |
|--------|----------|-------|
| **TAM** | 한국 20-40대 운세 관심 인구 ~800만명 | 점신 1900만 누적 (활성 유저 기준 추정) |
| **SAM** | 모바일 웹 운세 서비스 이용자 ~200만명 | 앱 설치 없이 웹에서 접근하는 세그먼트 |
| **SOM** | 주제 선택 기능으로 도달 가능 ~5만명/월 | SNS 공유 기반 바이럴 + 재방문 |

---

## 4. Beachhead Segment

### 4-Criteria Scoring

| Criteria | Segment: 20대 취준생/대학생 | Segment: 30대 직장인 | Segment: 전 연령 SNS 유저 |
|----------|:---:|:---:|:---:|
| **Urgency** (고민 절박성) | 4/5 | 3/5 | 2/5 |
| **Accessibility** (도달 가능성) | 5/5 | 3/5 | 4/5 |
| **Word of Mouth** (입소문) | 5/5 | 2/5 | 5/5 |
| **Willingness** (사용 의향) | 4/5 | 4/5 | 3/5 |
| **Total** | **18** | **12** | **14** |

**Selected Beachhead**: 20대 취준생/대학생
- SNS 공유 활발 (바이럴 효과 극대화)
- 학업운/직업운/대인관계 등 다양한 주제에 대한 수요
- 무료 서비스에 대한 접근 장벽 낮음

### GTM Strategy

| Channel | Action | Metric |
|---------|--------|--------|
| 기존 사용자 | 주제 선택 기능 런칭 알림 (결과 페이지 배너) | 재방문율 |
| SNS 공유 | 주제명 포함 결과 카드 -- "나의 학업운+직업운+건강운 대결 결과" | 공유 클릭률 |
| 커뮤니티 | 에브리타임/인스타 운세 해시태그 | 신규 유입 |

---

## 5. Product Requirements

### 5.1 Functional Requirements

#### FR-01: Topic Selection UI
- 입력 화면에 7개 주제 표시 (카드/칩 형태)
- 정확히 3개를 선택해야 다음 진행 가능
- 선택 순서 = 배틀 순서 (1st pick = Round 1)
- 기본 선택: 연애운, 재물운, 종합운세 (기존과 동일한 기본값)
- 선택된 주제는 시각적으로 강조 (활성 상태)

**Available Topics**:

| Topic | ID | Saju Basis | Tarot Basis |
|-------|-----|-----------|-------------|
| 연애운 | love | 십성/궁성 (정재/정관) | 컵 수트, 연인/여황제 |
| 재물운 | wealth | 편재/정재, 식상생재 | 펜타클 수트, 황제 |
| 종합운세 | general | 대운/세운 전체 | 메이저 아르카나 중심 |
| 직업운 | career | 관성/식상, 역마살 | 펜타클/완드, 세계 |
| 건강운 | health | 오행균형, 병부 | 검 수트, 탑/절제 |
| 학업운 | study | 인성/식상, 문창귀인 | 소드 수트, 은둔자 |
| 대인관계 | social | 비겁/관성, 천을귀인 | 컵/코트 카드 |

#### FR-02: Per-Topic Question Input
- 각 주제별로 개별 질문/고민 입력 가능 (선택 사항)
- 주제 선택 후 아코디언/인라인 형태로 질문 입력 필드 노출
- placeholder는 주제에 맞게 변경:
  - 연애운: "예: 짝사랑 중인데 고백해도 될까요?"
  - 재물운: "예: 주식에 투자해도 괜찮을까요?"
  - 직업운: "예: 이직을 고민 중인데 어떨까요?"
  - 건강운: "예: 요즘 피로가 심한데 괜찮을까요?"
  - 학업운: "예: 시험 준비가 잘 될까요?"
  - 대인관계: "예: 친구와 갈등이 있는데 어떻게 할까요?"
  - 종합운세: "예: 올해 전반적으로 어떤 해가 될까요?"
- maxlength: 100 (기존과 동일)

#### FR-03: Topic-Based Battle Flow
- `BattleEngine.TOPICS`를 사용자 선택 기반으로 동적 설정
- `nextRound()`에서 현재 라운드의 topic을 선택된 주제에서 가져옴
- 각 라운드의 질문을 해당 주제의 개별 질문으로 전달
- 라운드 헤더에 "ROUND 1" 대신 (또는 추가로) 주제명 표시

#### FR-04: AI Interpreter Topic Expansion
- `getSajuReading()`의 `topicMap`에 신규 4개 주제 추가
- `getTarotReading()`의 topic별 시스템 프롬프트 조정
- `getFinalJudgment()`에서 주제명 기반으로 비교 요청

#### FR-05: Topic-Based Result Display
- 결과 화면에서 "라운드 1, 2, 3" 대신 주제명으로 표시
- 공유 결과 페이지에도 주제명 반영

#### FR-06: Data Schema Migration
- `battle_results` 테이블:
  - `question` (단일) -> `questions` (주제별 객체) 또는 rounds 내부에 question 포함
  - `rounds[]` 내부에 `topic` 필드 추가 (이미 존재하지만 고정값)
- `battle_stats` 테이블:
  - `r1_vote`/`r2_vote`/`r3_vote` -> 주제 기반 vote 기록
  - 새 필드: `topics` (선택된 3개 주제 JSON 배열)
- 하위 호환성: 기존 데이터의 `r1_vote`는 연애운, `r2_vote`는 재물운, `r3_vote`는 종합운세로 매핑

### 5.2 Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| **Performance** | 주제 선택 UI 추가로 인한 LCP 증가 100ms 이내 |
| **API Cost** | 여전히 7 API 콜/세션 (변동 없음) |
| **Backward Compat** | 기존 공유 URL (?id=xxx)은 계속 작동해야 함 |
| **Mobile First** | 주제 선택 UI는 모바일에서 원터치 선택 가능해야 함 |
| **Accessibility** | 주제 칩에 role="checkbox" + aria-checked 속성 |

### 5.3 UI Flow

```
[Intro] -> [Input]
              |
              v
         생년월일/성별 입력
              |
              v
         주제 선택 (3개 필수)     <-- NEW
         [ 연애운 ] [ 재물운 ] [ 종합운세 ]
         [ 직업운 ] [ 건강운 ] [ 학업운 ]
         [ 대인관계 ]
              |
              v
         주제별 질문 입력 (선택)   <-- NEW
         [선택1: ____________]
         [선택2: ____________]
         [선택3: ____________]
              |
              v
         [운명의 대결!] 버튼
              |
              v
         [Battle] 3라운드 (선택된 주제 순서대로)
              |
              v
         [Result] 주제명으로 결과 표시
```

### 5.4 Data Migration Strategy

**Approach**: Soft migration (새 필드 추가, 기존 필드 유지)

1. **Phase 1 -- Code Update (no DB migration needed)**
   - bkend.ai는 schemaless이므로 새 필드를 바로 추가 가능
   - `saveResult()`: `questions` 객체 추가 (주제별 질문)
   - `saveStat()`: `topics` 배열 추가, `r1_vote`/`r2_vote`/`r3_vote` 유지 (호환성)
   - 새 레코드는 `topics` + `questions` + 기존 `r1_vote`~`r3_vote` 모두 저장

2. **Phase 2 -- Read Compatibility**
   - `getResult()`: `topics` 필드가 없으면 기본값 `['연애운', '재물운', '종합운세']` 적용
   - `countStats()`: 기존 `r1_vote`/`r2_vote`/`r3_vote` 필터 유지
   - 새 통계 쿼리: `topics` 필드 기반 주제별 인기도 집계

3. **Phase 3 -- Stats Enhancement (선택적)**
   - 주제별 사주/타로 승률 통계 추가
   - 인기 주제 조합 TOP 5 표시

**No breaking changes**: 기존 데이터는 읽기 시 기본값으로 처리, 새 데이터만 확장 필드 포함.

---

## 6. Implementation Scope

### Must Have (MVP)
- [ ] 7개 주제 목록 + 3개 선택 UI (입력 화면)
- [ ] 선택 순서 = 배틀 순서
- [ ] 주제별 질문 입력 필드
- [ ] `BattleEngine` 동적 TOPICS
- [ ] `AIInterpreter` 4개 주제 추가 (직업운, 건강운, 학업운, 대인관계)
- [ ] 결과 화면 주제명 표시
- [ ] `BkendClient` 확장 필드 저장
- [ ] 기존 데이터 읽기 호환성

### Should Have
- [ ] 주제 선택 애니메이션 (칩 활성화 효과)
- [ ] 공유 결과 페이지에 주제명 반영
- [ ] 주제별 인기도 통계

### Could Have
- [ ] 랜덤 주제 선택 버튼 ("운명에 맡기기")
- [ ] 주제 추천 (생년월일 기반)
- [ ] 4개 이상 주제 프리미엄 모드

### Won't Have (this release)
- [ ] 주제 커스텀 생성
- [ ] 1:1 단일 주제 모드 (항상 3개)
- [ ] 실시간 멀티플레이어

---

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| AI 해석 품질 저하 (새 주제) | High | Medium | 주제별 프롬프트 사전 테스트, fallback 메시지 |
| 주제 선택 UI로 이탈률 증가 | Medium | Low | 기본 3개 사전 선택, 원터치 변경 UX |
| 사주 데이터가 특정 주제에 부족 | Medium | Low | 사주 엔진은 전체 분석 수행, 주제 관련 요소만 강조하도록 프롬프트 조정 |
| 기존 통계 데이터와 호환성 문제 | Low | Low | Soft migration: 기존 필드 유지 + 새 필드 추가 |

---

## 8. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| 3라운드 완주율 | baseline TBD | +15% | battle_stats 완료 레코드 비율 |
| 재방문율 (7일 내) | baseline TBD | +50% | 동일 IP/fingerprint 재방문 |
| 주제 다양성 | 1 조합 (고정) | 평균 2.5+ 고유 조합/유저 | topics 필드 분석 |
| 결과 공유율 | baseline TBD | +20% | 공유 버튼 클릭 이벤트 |
| 평균 체류 시간 | baseline TBD | +30% | 세션 시작~결과 도달 시간 |

---

## Attribution

This PRD integrates frameworks from:
- Opportunity Solution Tree (Teresa Torres)
- JTBD 6-Part Value Proposition (Pawel Huryn)
- Lean Canvas (Ash Maurya)
- Beachhead Segment (Geoffrey Moore)

PM Agent Team analysis by bkit PDCA methodology.
Competitor research conducted 2026-03-10.

---

*Next step: `/pdca plan topic-selection`*
