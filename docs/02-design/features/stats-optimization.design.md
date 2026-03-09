# Design: stats-optimization (통계 시스템 최적화)

> Created: 2026-03-09
> Feature: stats-optimization
> Status: Design
> Plan: docs/01-plan/features/stats-optimization.plan.md

## 1. Architecture Overview

```
Before:
  Stats 페이지 → GET battle_results?limit=500 → 2.5MB 응답 → JS forEach 집계 → 렌더링

After:
  Stats 페이지 → countStats({winner:"saju"}) × ~30 병렬
               → GET battle_stats?limit=1&andFilters=... → 200B 응답 (pagination.total만 사용)
               → 결과 조합 → 렌더링

  배틀 완료 → saveStat({winner, gender, birth_year, r1~r3_vote}) → 100B POST
```

### 데이터 흐름

```
[배틀 완료]
    ├─→ ShareManager.getShareUrl() → battle_results에 풀 데이터 저장 (공유용, 기존)
    └─→ BkendClient.saveStat()     → battle_stats에 카테고리 값만 저장 (통계용, 신규)

[통계 조회]
    └─→ StatsManager.loadAndRender()
          ├─→ fetchAllCounts()     → ~30 병렬 countStats() 호출
          │     ├─ 종합: total, saju승, tarot승
          │     ├─ 라운드: r1~r3 × saju/tarot
          │     ├─ 성별: male/female × total/saju/tarot
          │     └─ 연령대: 10대~80대 × total/saju/tarot (birth_year 범위 필터)
          └─→ render(counts)       → 기존 UI 렌더링 (변경 없음)
```

## 2. DB Schema

### battle_stats 테이블 (이미 생성됨)

| 필드 | 타입 | 필수 | 설명 | 예시 값 |
|------|------|------|------|---------|
| `id` | string | auto | 레코드 ID | `data_xxxx...` |
| `winner` | string | Y | 최종 승자 | `"saju"` / `"tarot"` |
| `gender` | string | N | 성별 | `"male"` / `"female"` |
| `birth_year` | number | N | 출생연도 | `1995` |
| `r1_vote` | string | N | 라운드1(연애운) 투표 | `"saju"` / `"tarot"` |
| `r2_vote` | string | N | 라운드2(재물운) 투표 | `"saju"` / `"tarot"` |
| `r3_vote` | string | N | 라운드3(종합운세) 투표 | `"saju"` / `"tarot"` |
| `createdAt` | date | auto | 생성시각 | |

### 인덱스 설계

| 인덱스 이름 | 필드 | 타입 | 근거 |
|-------------|------|------|------|
| `idx_winner` | `winner: 1` | single | 종합 전적 `andFilters={winner:"saju"}` |
| `idx_gender` | `gender: 1` | single | 성별 필터 `andFilters={gender:"male"}` |
| `idx_birth_year` | `birth_year: 1` | single | 연령대 범위 `andFilters={birth_year:{$gte:1997,$lte:2006}}` |
| `idx_r1_vote` | `r1_vote: 1` | single | R1 투표 카운팅 |
| `idx_r2_vote` | `r2_vote: 1` | single | R2 투표 카운팅 |
| `idx_r3_vote` | `r3_vote: 1` | single | R3 투표 카운팅 |

복합 인덱스(compound index) 고려사항:
- `{gender: 1, winner: 1}` — 성별+승자 동시 필터에 최적
- `{birth_year: 1, winner: 1}` — 연령대+승자 동시 필터에 최적
- 하지만 현재 데이터 규모에서는 단일 인덱스로 충분, 추후 데이터 증가 시 추가

## 3. API 계층 설계 (bkend-client.js)

### 3.1 countStats(filters) — 핵심 함수

```javascript
/**
 * 서버 측 카운트 쿼리
 * @param {Object} filters - andFilters 조건 (빈 객체면 전체 카운트)
 * @returns {number} pagination.total 값
 *
 * 내부 동작:
 *   GET /v1/data/battle_stats?limit=1&andFilters=JSON.stringify(filters)
 *   → response.data.pagination.total 반환
 */
async function countStats(filters = {}) → number
```

구현 포인트:
- `limit=1` 로 데이터 전송 최소화 (items 배열에 최대 1건만 포함)
- `andFilters`가 빈 객체이면 쿼리스트링에서 생략
- 응답 파싱: `result.data.pagination.total` (bkend 응답 래퍼)
- 에러 시 `0` 반환 (통계가 0으로 표시되는 것이 에러 표시보다 나음)

### 3.2 saveStat(data) — 수정

```javascript
/**
 * 통계 전용 경량 레코드 저장
 * @param {Object} data - { winner, gender, birth_year, r1_vote, r2_vote, r3_vote }
 * @returns {string|null} 생성된 레코드 ID
 */
async function saveStat(data) → string|null
```

기존 saveStat에서 변경:
- `age_decade` 제거 → `birth_year` (number) 추가
- `gender`, `r1~r3_vote`는 동일

### 3.3 제거 대상

- `listStats()` — 전체 레코드 fetch → 완전 제거
- `listResults()` — 통계에서 사용하지 않음 (유지하되 stats에서 호출 안 함)

### 3.4 최종 export

```javascript
return { saveResult, getResult, listResults, saveStat, countStats };
```

## 4. 통계 계층 설계 (stats.js)

### 4.1 fetchAllCounts() — 병렬 카운트 수집

```javascript
/**
 * 모든 통계 수치를 병렬 카운트 쿼리로 수집
 * @returns {Object} { total, overall, roundVotes, gender, age }
 *
 * 쿼리 구성:
 *   Wave 1 (15건 병렬): 종합 + 라운드 + 성별
 *   Wave 2 (N×3 병렬): 연령대 (데이터 있는 범위만)
 */
```

**Wave 1: 고정 쿼리 (15건 동시)**

| # | 쿼리 | 결과 매핑 |
|---|------|-----------|
| 1 | `countStats({})` | `total` |
| 2 | `countStats({winner:"saju"})` | `overall.saju` |
| 3 | `countStats({winner:"tarot"})` | `overall.tarot` |
| 4 | `countStats({r1_vote:"saju"})` | `roundVotes.연애운.saju` |
| 5 | `countStats({r1_vote:"tarot"})` | `roundVotes.연애운.tarot` |
| 6 | `countStats({r2_vote:"saju"})` | `roundVotes.재물운.saju` |
| 7 | `countStats({r2_vote:"tarot"})` | `roundVotes.재물운.tarot` |
| 8 | `countStats({r3_vote:"saju"})` | `roundVotes.종합운세.saju` |
| 9 | `countStats({r3_vote:"tarot"})` | `roundVotes.종합운세.tarot` |
| 10 | `countStats({gender:"male"})` | `gender.male.total` |
| 11 | `countStats({gender:"male",winner:"saju"})` | `gender.male.saju` |
| 12 | `countStats({gender:"male",winner:"tarot"})` | `gender.male.tarot` |
| 13 | `countStats({gender:"female"})` | `gender.female.total` |
| 14 | `countStats({gender:"female",winner:"saju"})` | `gender.female.saju` |
| 15 | `countStats({gender:"female",winner:"tarot"})` | `gender.female.tarot` |

**Wave 2: 연령대 쿼리 (최대 24건)**

```javascript
const now = new Date().getFullYear();
const DECADES = [10, 20, 30, 40, 50, 60, 70, 80];

// 각 연령대의 birth_year 범위 계산
// 20대 (2026년 기준) = 20~29세 = birth_year 1997~2006
// minYear = now - decadeEnd = now - (decade + 9)
// maxYear = now - decadeStart = now - decade

DECADES.forEach(decade => {
  const maxYear = now - decade;       // 2006 (20세)
  const minYear = now - decade - 9;   // 1997 (29세)

  queries.push(
    countStats({ birth_year: { $gte: minYear, $lte: maxYear } }),               // total
    countStats({ birth_year: { $gte: minYear, $lte: maxYear }, winner: 'saju' }),  // saju
    countStats({ birth_year: { $gte: minYear, $lte: maxYear }, winner: 'tarot' })  // tarot
  );
});
```

총 최대 39건, 모두 `Promise.all`로 병렬 실행.

### 4.2 render(container, stats) — 변경 없음

기존 렌더링 로직은 그대로 유지. `stats` 객체의 구조가 동일하므로:

```javascript
{
  total: number,
  overall: { saju: number, tarot: number },
  roundVotes: {
    '연애운': { saju: number, tarot: number },
    '재물운': { saju: number, tarot: number },
    '종합운세': { saju: number, tarot: number }
  },
  gender: {
    male: { saju: number, tarot: number, total: number },
    female: { saju: number, tarot: number, total: number }
  },
  age: {
    '20대': { saju: number, tarot: number, total: number },
    '30대': { saju: number, tarot: number, total: number },
    ...
  }
}
```

`compute()` 함수 제거 → `fetchAllCounts()`가 이 구조를 직접 반환.

### 4.3 최종 구조

```javascript
const StatsManager = (() => {
  // 헬퍼 (유지)
  function createEl(tag, className, text) { ... }
  function pct(val, total) { ... }

  // 변경: 서버 측 카운팅으로 교체
  async function fetchAllCounts() { ... }

  // 유지
  async function loadAndRender(container) {
    // loading 표시
    // fetchAllCounts() 호출
    // render() 호출
  }

  // 유지
  function renderBar(valA, valB) { ... }
  function render(container, stats) { ... }

  // 제거: compute() — 클라이언트 집계 불필요

  return { loadAndRender };
})();
```

## 5. 저장 계층 설계 (app.js)

### showFinalResult() 수정

```javascript
// 기존: ShareManager.getShareUrl() — 공유용 풀 데이터 저장 (유지)
// 추가: BkendClient.saveStat() — 통계용 경량 데이터 저장

BkendClient.saveStat({
  winner: result.winner,
  gender: currentUserData?.gender || '',
  birth_year: currentUserData?.year || 0,  // 출생연도 그대로
  r1_vote: result.rounds[0]?.vote || '',
  r2_vote: result.rounds[1]?.vote || '',
  r3_vote: result.rounds[2]?.vote || ''
}).catch(e => console.warn('통계 저장 실패:', e));
```

`birth_year`는 `currentUserData.year` (입력 폼의 생년)을 그대로 사용.
음력→양력 변환 후의 `year` 값이므로 양력 기준 출생연도.

## 6. Implementation Order

```
Step 1: 인덱스 추가 (MCP)
  → mcp__bkend__backend_index_manage로 6개 인덱스 생성
  → 이후 모든 andFilters가 인덱스를 탐

Step 2: bkend-client.js 수정
  → countStats() 추가
  → saveStat()에서 age_decade → birth_year 변경
  → listStats() 제거

Step 3: stats.js 전면 재작성
  → compute() 제거
  → fetchAllCounts() 구현 (병렬 카운트 쿼리)
  → loadAndRender()에서 fetchAllCounts() 호출
  → render()는 기존 유지 (stats 객체 구조 동일)

Step 4: app.js 수정
  → showFinalResult()의 통계 저장을 birth_year 기반으로 수정
  → 기존 age_decade 관련 코드 제거
```

## 7. Error Handling

| 상황 | 처리 |
|------|------|
| countStats 개별 실패 | 해당 카운트를 0으로 처리, 나머지 통계는 정상 표시 |
| 전체 네트워크 실패 | "통계를 불러오지 못했습니다" 에러 메시지 (기존 동일) |
| saveStat 실패 | console.warn, 배틀 플로우에 영향 없음 (fire-and-forget) |
| birth_year 미입력 | 0 저장, 연령대 통계에서 자동 제외 (범위 밖) |

## 8. File Changes Summary

| 파일 | 변경 유형 | 변경 내용 |
|------|-----------|-----------|
| `js/bkend-client.js` | 수정 | `countStats()` 추가, `saveStat()` birth_year로 변경, `listStats()` 제거 |
| `js/stats.js` | 전면 재작성 | `compute()` → `fetchAllCounts()`, 병렬 카운트 기반 |
| `js/app.js` | 수정 | 통계 저장에서 `birth_year: currentUserData.year` 사용 |
| DB | MCP | battle_stats 테이블에 인덱스 6개 추가 |
