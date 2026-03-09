# Plan: stats-optimization (통계 시스템 최적화)

> Created: 2026-03-09
> Feature: stats-optimization
> Status: Plan
> Depends on: ux-upgrade (완료)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 통계 조회 시 전체 레코드를 클라이언트로 가져와 JS에서 집계 — 데이터 증가 시 전송량 폭증, limit 초과 시 통계 누락 |
| **Solution** | 경량 `battle_stats` 테이블 + `andFilters` + `pagination.total`로 서버 측 카운팅, MongoDB 인덱스로 필터 성능 보장 |
| **Function UX Effect** | 통계 로딩 속도 향상 (수 MB → 수 KB), 데이터 규모 무관하게 정확한 통계, 배틀 직후 즉시 반영 |
| **Core Value** | O(N) 데이터 전송 → O(1) 카운트 쿼리로 전환, 확장성 있는 통계 아키텍처 |

## 1. 현황 분석

### 현재 문제점

```
현재 흐름:
  Stats 페이지 → listResults(500) → 500건 × ~5KB = ~2.5MB 전송
                                   → JS에서 forEach로 집계
                                   → 500건 초과 데이터는 누락
```

| 문제 | 심각도 | 설명 |
|------|--------|------|
| **전체 데이터 전송** | CRITICAL | rounds 필드에 saju/tarot reading 텍스트 포함, 건당 ~5KB |
| **클라이언트 집계** | HIGH | 모든 레코드를 JS forEach로 순회하며 카운팅 — O(N) |
| **limit 한계** | HIGH | 500건 이상이면 통계가 부정확해짐, bkend limit 최대 100 |
| **인덱스 미활용** | MEDIUM | winner, gender 등 필터링 시 인덱스 없이 full scan |

### bkend.ai API 활용 가능 기능

| 기능 | 설명 | 활용 방안 |
|------|------|-----------|
| `select` | 필요한 필드만 응답 | 무거운 rounds 필드 제외 |
| `andFilters` | 서버 측 MongoDB 필터링 | `{winner: "saju"}` 등 조건별 카운팅 |
| `pagination.total` | 필터 조건에 맞는 전체 건수 | **limit=1로 요청, total만 사용** |
| `limit` | 응답 건수 제한 (1~100) | 1로 설정하여 데이터 전송 최소화 |

## 2. Scope

### In Scope

| # | 작업 | 영향 파일 | 우선순위 |
|---|------|-----------|----------|
| S1 | **battle_stats 테이블 활용** — 경량 통계 전용 테이블 (이미 생성됨) | DB | DONE |
| S2 | **인덱스 추가** — winner, gender, age_decade, r1/r2/r3_vote에 인덱스 | DB | CRITICAL |
| S3 | **서버 측 카운팅 API** — andFilters + pagination.total로 통계 집계 | `js/bkend-client.js` | CRITICAL |
| S4 | **stats.js 리팩토링** — 카운트 쿼리 결과로 통계 렌더링 | `js/stats.js` | CRITICAL |
| S5 | **배틀 완료 시 stats 저장** — 경량 레코드 자동 저장 | `js/app.js` | HIGH |
| S6 | **기존 코드 롤백** — 이전 잘못된 변경 제거 | `js/bkend-client.js`, `js/stats.js`, `js/app.js` | HIGH |

### Out of Scope

- battle_results 테이블 구조 변경 (공유 기능은 기존대로)
- 시계열 통계 (일별/주별 추이 등)
- 실시간 WebSocket 통계 업데이트

## 3. Requirements

### S2: 인덱스 추가 (battle_stats 테이블)

MongoDB 기반이므로 andFilters 성능을 위해 필터링 대상 필드에 인덱스 필요.

| 인덱스 이름 | 필드 | 용도 |
|-------------|------|------|
| `idx_winner` | `winner: 1` | 종합 전적 카운팅 |
| `idx_gender` | `gender: 1` | 성별 분석 필터 |
| `idx_birth_year` | `birth_year: 1` | 연령대 범위 필터 ($gte/$lte) |
| `idx_r1_vote` | `r1_vote: 1` | 라운드1 투표 카운팅 |
| `idx_r2_vote` | `r2_vote: 1` | 라운드2 투표 카운팅 |
| `idx_r3_vote` | `r3_vote: 1` | 라운드3 투표 카운팅 |

### S3: 서버 측 카운팅 API 설계

**핵심 전략**: `limit=1` + `andFilters` → `pagination.total`만 사용

```
// 종합 전적
GET /v1/data/battle_stats?limit=1                          → total = 전체 배틀 수
GET /v1/data/battle_stats?limit=1&andFilters={"winner":"saju"}   → total = 사주 승리 수
GET /v1/data/battle_stats?limit=1&andFilters={"winner":"tarot"}  → total = 타로 승리 수

// 라운드별 투표
GET /v1/data/battle_stats?limit=1&andFilters={"r1_vote":"saju"}  → total = R1 사주 투표 수
GET /v1/data/battle_stats?limit=1&andFilters={"r1_vote":"tarot"} → total = R1 타로 투표 수
... (r2, r3 동일 패턴)

// 성별 분석
GET /v1/data/battle_stats?limit=1&andFilters={"gender":"male"}                     → total = 남성 수
GET /v1/data/battle_stats?limit=1&andFilters={"gender":"male","winner":"saju"}      → total = 남성 사주 승
GET /v1/data/battle_stats?limit=1&andFilters={"gender":"male","winner":"tarot"}     → total = 남성 타로 승
... (female 동일 패턴)

// 연령대 분석 — birth_year 범위 필터 (조회 시점 기준 나이 계산)
// 예: 2026년 기준 20대 = 1997~2006년생
GET /v1/data/battle_stats?limit=1&andFilters={"birth_year":{"$gte":1997,"$lte":2006}}                    → total = 20대 수
GET /v1/data/battle_stats?limit=1&andFilters={"birth_year":{"$gte":1997,"$lte":2006},"winner":"saju"}    → total = 20대 사주 승
... (30대, 40대... 동일 패턴, 연도 범위만 변경)
```

**데이터 전송량 비교:**

| 방식 | 요청 수 | 응답 크기 | 총 전송량 |
|------|---------|-----------|-----------|
| 현재 (전체 fetch) | 1 | ~2.5MB (500건 × 5KB) | ~2.5MB |
| 개선 (카운트 쿼리) | ~30 병렬 | ~200B × 30 | ~6KB |

### S3-1: bkend-client.js 변경

```javascript
// 새 함수: 카운트 전용 (limit=1, total만 반환)
async function countStats(filters = {}) → number

// 새 함수: 존재하는 연령대 목록 조회
async function getAgeDecades() → string[]

// 통계 저장 (S5)
async function saveStat(data) → id

// 기존 listResults, listStats 함수는 제거하거나 사용하지 않음
```

### S4: stats.js 리팩토링

```javascript
// Before: 500건 fetch → JS forEach 집계
// After: 병렬 카운트 쿼리 → 결과 조합

async function loadAndRender(container) {
  // 1. 전체/사주승/타로승 카운트 (3 병렬)
  // 2. 라운드별 투표 카운트 (6 병렬: 3라운드 × 2선택)
  // 3. 성별 카운트 (6 병렬: 2성별 × 3(total/saju/tarot))
  // 4. 연령대: 먼저 존재하는 decade 목록 조회 → 각 decade별 카운트
  //    (select=age_decade로 고유값 가져오기 또는 알려진 범위 순회)
}
```

**연령대 처리 전략:**
- `birth_year` (number) 저장 → 조회 시점의 현재 연도 기준으로 $gte/$lte 범위 계산
- 예: 2026년 기준 20대 = birth_year 1997~2006
- 10대~80대 고정 범위로 각각 카운트 쿼리
- total=0인 decade는 렌더링에서 제외
- 최대 추가 쿼리 수: 8 (decade) × 3 (total/saju/tarot) = 24

**총 API 호출 수**: ~39건 (모두 병렬, 각 ~200B 응답)
- 종합: 3건
- 라운드: 6건
- 성별: 6건
- 연령대: ~24건 (빈 decade는 빠르게 반환)

### S5: 배틀 완료 시 stats 저장

app.js `showFinalResult()`에서 경량 레코드 저장:

```javascript
BkendClient.saveStat({
  winner: result.winner,
  gender: userData.gender,
  birth_year: 1995,    // 출생연도 그대로 저장
  r1_vote: rounds[0].vote,
  r2_vote: rounds[1].vote,
  r3_vote: rounds[2].vote
});
```

### S6: 롤백 대상

현재 작업 디렉토리에 커밋되지 않은 변경사항 제거:
- `bkend-client.js`: listStats, saveStat의 잘못된 구현 → 올바른 구현으로 교체
- `stats.js`: listStats 기반 코드 → 카운트 기반으로 전면 재작성
- `app.js`: 통계 저장 부분 → saveStat 호출로 교체 (구조는 유지)

## 4. Implementation Order

```
Phase 1: DB 준비 (S2)
  battle_stats 테이블에 6개 인덱스 추가
  → 인덱스 없으면 andFilters가 full scan → 성능 무의미

Phase 2: API 계층 (S3 + S6)
  bkend-client.js에 countStats(), saveStat() 구현
  기존 잘못된 listStats 제거

Phase 3: UI 계층 (S4)
  stats.js를 카운트 기반으로 전면 재작성
  병렬 쿼리 → 결과 조합 → 렌더링

Phase 4: 데이터 저장 (S5)
  app.js에서 배틀 완료 시 saveStat() 호출
```

## 5. Risk & Mitigation

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 병렬 API 호출 수 (~39건) | Rate limit 가능성 | Promise.all로 동시 실행, bkend pk_ 키는 CORS로 보호되어 일반적으로 제한 없음 |
| 연령대 빈 범위 쿼리 | 불필요한 API 호출 | total=0 결과는 즉시 반환, 성능 영향 미미 |
| 기존 battle_results 데이터 | 통계에 미반영 | 이전 데이터는 소량이므로 무시 가능, 필요 시 마이그레이션 스크립트 |

## 6. Definition of Done

- [ ] battle_stats 테이블에 6개 인덱스 생성 완료
- [ ] 통계 조회 시 전체 레코드를 가져오지 않음 (limit=1 카운트 쿼리만 사용)
- [ ] 통계 페이지 API 응답 총량 < 10KB
- [ ] 배틀 완료 시 battle_stats에 경량 레코드 자동 저장
- [ ] 1000건 이상 데이터에서도 정확한 통계 표시
- [ ] 통계 페이지 로딩 시간 < 2초 (네트워크 정상 시)
- [ ] 배틀 직후 통계 페이지에 즉시 반영 (캐싱 없음)
