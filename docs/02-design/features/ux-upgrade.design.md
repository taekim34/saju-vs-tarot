# Design: ux-upgrade (입력 UX + 타로 스프레드 업그레이드)

> Created: 2026-03-07
> Feature: ux-upgrade
> Status: Design
> Plan: docs/01-plan/features/ux-upgrade.plan.md

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  index.html                      │
│  [양력/음력 토글] [생년월일] [성별] [시간] [질문] │
└─────────┬───────────────────────────────────────┘
          │ userData (확장)
          ▼
┌─────────────────┐     ┌──────────────────────┐
│     app.js       │────►│    lunar.js (신규)    │
│ 폼 관리/검증     │     │ 음력→양력 변환        │
└────────┬────────┘     └──────────────────────┘
         │ userData { calendarType, question, ... }
         ▼
┌─────────────────┐
│   battle.js      │
│ 배틀 오케스트라   │──── question을 AI에 전달
└───┬─────────┬───┘
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│saju.js │ │  tarot.js     │
│(변경없음)│ │ +시그니피케이터│
│        │ │ +호스슈7장    │
└────────┘ └──────────────┘
    │         │
    ▼         ▼
┌─────────────────────────────┐
│     ai-interpreter.js        │
│ +질문 삽입 +시그니피케이터    │
│ +함수별 토큰 분리            │
└─────────────────────────────┘
```

## 2. File Changes

| 파일 | 변경 유형 | 관련 요구사항 |
|------|-----------|---------------|
| `index.html` | 수정 | U1 (양력/음력 토글), U2 (질문 필드) |
| `js/app.js` | 수정 | U1 (폼 상태), U2 (질문 전달) |
| `js/lunar.js` | **신규** | U1 (음력→양력 변환) |
| `data/lunar-calendar.json` | **신규** | U1 (음력 데이터) |
| `js/tarot.js` | 수정 | U3 (시그니피케이터), U4 (호스슈 7장) |
| `js/battle.js` | 수정 | U2 (질문 전달), U3 (시그니피케이터 연결) |
| `js/ai-interpreter.js` | 수정 | U2 (질문 프롬프트), U3 (시그니피케이터), U5 (토큰 최적화) |
| `config.js` | 수정 | U5 (토큰 설정 구조) |

## 3. Detailed Design

### 3.1 U1: 양력/음력 토글

#### 3.1.1 HTML 변경 (index.html)

생년월일 `form-group` 앞에 캘린더 타입 토글 삽입:

```html
<div class="form-group">
  <label class="form-label">달력 구분</label>
  <div class="calendar-toggle">
    <button class="btn-calendar selected" data-calendar="solar">양력</button>
    <button class="btn-calendar" data-calendar="lunar">음력</button>
  </div>
  <div id="leap-month-wrap" class="leap-month-wrap" style="display:none;">
    <label><input type="checkbox" id="input-leap-month"> 윤달</label>
  </div>
</div>
```

삽입 위치: `<div class="form-group">` (생년월일 그룹) **직전**

#### 3.1.2 app.js 변경

**새 상태 변수**:
```javascript
let calendarType = 'solar';  // 'solar' | 'lunar'
let isLeapMonth = false;
```

**이벤트 바인딩 추가** (`bindEvents` 함수 내):
```javascript
$$('.btn-calendar').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.btn-calendar').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    calendarType = btn.dataset.calendar;
    $('#leap-month-wrap').style.display = calendarType === 'lunar' ? 'block' : 'none';
    if (calendarType === 'solar') {
      isLeapMonth = false;
      $('#input-leap-month').checked = false;
    }
  });
});

$('#input-leap-month').addEventListener('change', (e) => {
  isLeapMonth = e.target.checked;
});
```

**startBattle 함수 — 음력 변환**:
```javascript
async function startBattle() {
  if (!validateForm()) return;

  let year = parseInt(inputYear.value);
  let month = parseInt(inputMonth.value);
  let day = parseInt(inputDay.value);

  // 음력이면 양력으로 변환
  if (calendarType === 'lunar') {
    const converted = LunarConverter.toSolar(year, month, day, isLeapMonth);
    if (!converted) {
      inputError.textContent = '음력 날짜 변환에 실패했습니다. 날짜를 확인해주세요.';
      return;
    }
    year = converted.year;
    month = converted.month;
    day = converted.day;
  }

  const userData = {
    year, month, day,
    gender: selectedGender,
    hour: noTimeSelected ? null : (inputHour.value ? parseInt(inputHour.value) : null),
    minute: noTimeSelected ? null : (inputMinute.value ? parseInt(inputMinute.value) : null),
    calendarType,
    question: ($('#input-question')?.value || '').trim().substring(0, 100)
  };
  // ... 기존 로직
}
```

**resetState 확장**:
```javascript
calendarType = 'solar';
isLeapMonth = false;
$$('.btn-calendar').forEach(b => b.classList.toggle('selected', b.dataset.calendar === 'solar'));
$('#leap-month-wrap').style.display = 'none';
$('#input-leap-month').checked = false;
$('#input-question').value = '';
```

#### 3.1.3 lunar.js (신규 파일)

```javascript
const LunarConverter = (() => {
  let lunarData = null;

  async function loadData() {
    try {
      const res = await fetch('data/lunar-calendar.json');
      lunarData = await res.json();
    } catch (e) {
      console.error('음력 데이터 로드 실패:', e);
    }
  }

  /**
   * 음력 → 양력 변환
   * @param {number} lunarYear
   * @param {number} lunarMonth (1~12)
   * @param {number} lunarDay (1~30)
   * @param {boolean} isLeapMonth
   * @returns {{ year, month, day } | null}
   */
  function toSolar(lunarYear, lunarMonth, lunarDay, isLeapMonth = false) {
    if (!lunarData || !lunarData[lunarYear]) return null;

    const yearInfo = lunarData[lunarYear];
    const baseDate = new Date(yearInfo.solarBase); // 음력 1/1의 양력

    // 음력 1/1부터 목표 날짜까지의 일수 계산
    let dayCount = 0;

    for (let m = 1; m < lunarMonth; m++) {
      dayCount += yearInfo.months[m - 1]; // 해당 월의 일수
      // 윤달이 이 월 뒤에 오는 경우
      if (yearInfo.leapMonth === m && !isLeapMonth) {
        dayCount += yearInfo.leapDays;
      }
    }

    // 윤달인 경우: 해당 월의 정상 일수를 더한 뒤 윤달 일수
    if (isLeapMonth && yearInfo.leapMonth === lunarMonth) {
      dayCount += yearInfo.months[lunarMonth - 1]; // 정상 월 일수
    }

    dayCount += (lunarDay - 1);

    const result = new Date(baseDate);
    result.setDate(result.getDate() + dayCount);

    return {
      year: result.getFullYear(),
      month: result.getMonth() + 1,
      day: result.getDate()
    };
  }

  return { loadData, toSolar };
})();
```

#### 3.1.4 data/lunar-calendar.json 구조

```json
{
  "1990": {
    "solarBase": "1990-01-27",
    "months": [29,30,29,30,29,30,29,29,30,29,30,30],
    "leapMonth": 5,
    "leapDays": 29
  },
  "1991": { ... },
  ...
}
```

각 연도별:
- `solarBase`: 해당 음력년 1월 1일의 양력 날짜
- `months`: 12개월의 각 일수 (29 또는 30)
- `leapMonth`: 윤달이 있는 월 (0이면 윤달 없음)
- `leapDays`: 윤달 일수 (29 또는 30)

범위: 1940~2025 (86년)

### 3.2 U2: 자유 질문 입력

#### 3.2.1 HTML (index.html)

출생시간 `form-group` 뒤, `input-error` 앞에 삽입:

```html
<div class="form-group">
  <label class="form-label">궁금한 것이 있나요? <span class="optional">선택</span></label>
  <input type="text" id="input-question" class="form-input"
    placeholder="예: 이직을 고민 중이에요 / 올해 결혼 운은?" maxlength="100">
  <div class="form-hint">비워두면 기본 주제로 진행됩니다</div>
</div>
```

#### 3.2.2 battle.js 변경

**init 함수** — question 저장:
```javascript
let userQuestion = '';

function init(userData) {
  // ... 기존 초기화
  userQuestion = userData.question || '';
}
```

**nextRound 함수** — question을 AI에 전달:
```javascript
const sajuReading = await AIInterpreter.getSajuReading(
  sajuResult, topic, sajuResult.gender, userQuestion  // question 추가
);
await new Promise(r => setTimeout(r, 2000));
const tarotReading = await AIInterpreter.getTarotReading(
  tarotDraw, topic, userQuestion  // question 추가
);
```

**roundData에 question 포함**:
```javascript
const roundData = {
  round: currentRound,
  topic,
  question: userQuestion,  // 추가
  // ... 기존
};
```

#### 3.2.3 ai-interpreter.js 변경

**getSajuReading** — 4번째 파라미터 `question` 추가:
```javascript
async function getSajuReading(sajuResult, topic, gender, question = '') {
  // ... 기존 systemPrompt

  let userPrompt = `아래 사주팔자의 전문 분석 데이터를 활용하여 ${topicMap[topic]}에 대해 해석해주세요.
...
${sajuResult.summary}
성별: ${gender === 'male' ? '남성' : '여성'}`;

  // 자유 질문 추가
  if (question) {
    userPrompt += `\n\n【사용자의 추가 질문】\n${question}\n→ 이 질문의 맥락을 ${topic} 해석에 자연스럽게 반영해주세요.`;
  }

  userPrompt += `\n\n【현재 연도】: ${currentYear}년\n【해석 주제】: ${topic}`;
  // ...
}
```

**getTarotReading** — 3번째 파라미터 `question` 추가:
```javascript
async function getTarotReading(tarotDrawResult, topic, question = '') {
  // ... 기존 systemPrompt

  let userPrompt = `아래 타로 카드 스프레드와 패턴 분석 데이터를 활용하여 ${topic}에 대해 알려주세요.
...
${tarotSummary}`;

  // 자유 질문 추가
  if (question) {
    userPrompt += `\n\n【질문자가 특히 궁금해하는 것】\n${question}\n→ 카드 해석 시 이 질문에 대한 답을 자연스럽게 녹여주세요.`;
  }

  userPrompt += `\n\n위 데이터에 포함된 패턴 정보를 모두 활용하여 깊이 있는 해석을 해주세요.`;
  // ...
}
```

### 3.3 U3: 코트 카드 자동 배정 (시그니피케이터)

#### 3.3.1 tarot.js — getSignificator 함수 추가

```javascript
// 시그니피케이터 배정 규칙
const SIGNIFICATOR_RULES = {
  age: {
    teen: 'page',      // ~19세
    young: null,        // 20~39세 → 성별로 분기
    senior: null        // 40세~ → 성별로 분기
  }
};

function getSignificator(birthYear, gender, topic, dayMasterElement) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear + 1; // 한국 나이

  // 랭크 결정
  let rank;
  if (age <= 19) {
    rank = 'page';
  } else if (age <= 39) {
    rank = gender === 'male' ? 'knight' : 'queen';
  } else {
    rank = gender === 'male' ? 'king' : 'queen';
  }

  // 수트 결정 (주제 기반)
  let suit;
  if (topic === '연애운') {
    suit = 'cups';
  } else if (topic === '재물운') {
    suit = 'pentacles';
  } else {
    // 종합운세: 일간 오행 기반
    const elementToSuit = {
      '목': 'wands', '화': 'wands',
      '수': 'cups',
      '금': 'swords',
      '토': 'pentacles'
    };
    suit = elementToSuit[dayMasterElement] || 'wands';
  }

  const SUIT_KOREAN = { wands: '완드', cups: '컵', swords: '소드', pentacles: '펜타클' };
  const RANK_KOREAN = { page: '시종', knight: '기사', queen: '여왕', king: '왕' };

  return {
    rank,
    suit,
    korean: `${SUIT_KOREAN[suit]}의 ${RANK_KOREAN[rank]}`,
    meaning: `${RANK_KOREAN[rank]}의 에너지를 가진 질문자 (${age}세 ${gender === 'male' ? '남성' : '여성'})`,
    reason: `${age}세 ${gender === 'male' ? '남성' : '여성'} + ${topic}`
  };
}
```

#### 3.3.2 tarot.js — drawForRound 수정

`drawForRound`에 시그니피케이터 정보 추가:

```javascript
function drawForRound(round, significator = null) {
  // ... 기존 로직 (cards, reading, patterns)

  return {
    round,
    topic: spread.topic,
    spreadName: spread.name,
    reading,
    patterns,
    significator   // 추가
  };
}
```

#### 3.3.3 return 객체에 getSignificator 추가

```javascript
return {
  loadData, initDeck, drawForRound, buildSummary,
  getRemainingCount, getSignificator, SPREADS  // getSignificator 추가
};
```

### 3.4 U4: 호스슈 7장 스프레드

#### 3.4.1 tarot.js — SPREADS[3] 변경

```javascript
3: {
  name: '호스슈 스프레드',
  topic: '종합운세',
  count: 7,
  positions: [
    '과거 영향',     // 1. 현재에 영향을 미치는 과거 사건
    '현재 상황',     // 2. 지금 처한 상황의 핵심
    '숨겨진 영향',   // 3. 본인이 인식하지 못하는 요소
    '장애물',        // 4. 극복해야 할 도전
    '주변 환경',     // 5. 주변 사람들/상황의 영향
    '조언',          // 6. 이 시기에 필요한 행동
    '최종 결과'      // 7. 현재 흐름이 이어질 때의 결과
  ]
}
```

#### 3.4.2 analyzePatterns — 7장 기준 메시지 추가

`majorMinor` 분석에 7장 기준 추가:

```javascript
// 기존 3장/5장 조건에 추가
} else if (totalCount === 7 && majorCount >= 4) {
  majorMessage = '메이저 다수(4+/7) — 운명이 강력하게 개입, 인생의 중대한 전환점';
} else if (totalCount === 7 && majorCount >= 3) {
  majorMessage = '메이저 과반 — 영적 메시지가 강한 시기, 큰 흐름에 주목하세요';
```

### 3.5 U5: 토큰 최적화

#### 3.5.1 ai-interpreter.js — callAPI에 maxTokens 파라미터 추가

```javascript
async function callAPI(systemPrompt, userPrompt, retries = 2, attempt = 0, maxTokens = null) {
  const config = getConfig();
  // ...
  body: JSON.stringify({
    model: config.MODEL || 'openai/gpt-5-mini',
    max_completion_tokens: maxTokens || Math.max(config.MAX_TOKENS || 0, 4096),
    messages: [...]
  })
}
```

#### 3.5.2 함수별 토큰 설정

```javascript
// getSajuReading
return callAPI(systemPrompt, userPrompt, 2, 0, 3000);

// getTarotReading (7장은 더 긴 응답 필요)
const tokens = tarotDrawResult.reading.length >= 7 ? 4000 : 3000;
return callAPI(systemPrompt, userPrompt, 2, 0, tokens);

// getFinalJudgment (간결)
return callAPI(systemPrompt, userPrompt, 2, 0, 2000);
```

### 3.6 battle.js 통합 설계

**init 함수 확장**:
```javascript
function init(userData) {
  currentRound = 0;
  rounds = [];
  votes = [];
  isProcessing = false;
  userQuestion = userData.question || '';

  // 사주 분석
  const birthDateStr = `${userData.year}-${String(userData.month).padStart(2, '0')}-${String(userData.day).padStart(2, '0')}`;
  const birthTimeStr = userData.hour != null
    ? `${String(userData.hour).padStart(2, '0')}:${String(userData.minute || 0).padStart(2, '0')}`
    : null;
  sajuResult = SajuEngine.analyze(birthDateStr, userData.gender, birthTimeStr);

  // 시그니피케이터용 데이터 저장
  birthYear = userData.year;
  gender = userData.gender;
  dayMasterElement = sajuResult.dayMasterElement;

  TarotEngine.initDeck();
}
```

**nextRound 함수 확장**:
```javascript
async function nextRound() {
  // ... 기존 가드 + 쿨다운

  const topic = TOPICS[currentRound - 1];

  // 시그니피케이터 계산
  const significator = TarotEngine.getSignificator(birthYear, gender, topic, dayMasterElement);

  // 타로 드로우 (시그니피케이터 전달)
  const tarotDraw = TarotEngine.drawForRound(currentRound, significator);

  // AI 해석 (순차 + question + significator)
  const sajuReading = await AIInterpreter.getSajuReading(sajuResult, topic, sajuResult.gender, userQuestion);
  await new Promise(r => setTimeout(r, 2000));
  const tarotReading = await AIInterpreter.getTarotReading(tarotDraw, topic, userQuestion);

  // ... roundData 구성
}
```

### 3.7 index.html 스크립트 로드 순서

```html
<script src="config.js?v=4"></script>
<script src="js/lunar.js?v=1"></script>     <!-- 신규 -->
<script src="js/saju.js?v=2"></script>
<script src="js/tarot.js?v=3"></script>     <!-- v2 → v3 -->
<script src="js/ai-interpreter.js?v=7"></script>  <!-- v6 → v7 -->
<script src="js/battle.js?v=5"></script>    <!-- v4 → v5 -->
<script src="js/share.js?v=2"></script>
<script src="js/app.js?v=4"></script>       <!-- v3 → v4 -->
```

## 4. Implementation Checklist

- [ ] **Phase 1: HTML + CSS**
  - [ ] index.html: 양력/음력 토글 버튼 추가
  - [ ] index.html: 윤달 체크박스 추가
  - [ ] index.html: 자유 질문 input 필드 추가
  - [ ] index.html: lunar.js 스크립트 태그 추가
  - [ ] css/style.css: .calendar-toggle, .leap-month-wrap, .form-input 스타일

- [ ] **Phase 2: lunar.js + data**
  - [ ] data/lunar-calendar.json: 1940~2025 음력 데이터
  - [ ] js/lunar.js: LunarConverter 모듈 (loadData, toSolar)
  - [ ] app.js: LunarConverter.loadData() 추가 (initialize)

- [ ] **Phase 3: app.js 폼 로직**
  - [ ] calendarType 상태 + 이벤트 바인딩
  - [ ] isLeapMonth 상태 + 이벤트 바인딩
  - [ ] startBattle: 음력→양력 변환 + question 수집
  - [ ] resetState: 새 필드 초기화

- [ ] **Phase 4: tarot.js 업그레이드**
  - [ ] SPREADS[3]: 호스슈 7장으로 변경
  - [ ] getSignificator() 함수 추가
  - [ ] analyzePatterns: 7장 기준 메이저/마이너 메시지 추가
  - [ ] drawForRound: significator 파라미터 추가
  - [ ] buildSummary: 시그니피케이터 정보 출력
  - [ ] return 객체에 getSignificator 추가

- [ ] **Phase 5: battle.js 통합**
  - [ ] init: userQuestion, birthYear, gender, dayMasterElement 저장
  - [ ] nextRound: 시그니피케이터 계산 + AI 호출에 question 전달

- [ ] **Phase 6: ai-interpreter.js 업그레이드**
  - [ ] callAPI: maxTokens 파라미터 추가
  - [ ] getSajuReading: question 파라미터 + 프롬프트 삽입
  - [ ] getTarotReading: question + significator 프롬프트 삽입
  - [ ] 함수별 토큰 제한 적용 (3000/4000/2000)

- [ ] **Phase 7: 캐시 버스팅 + 테스트**
  - [ ] index.html: 스크립트 버전 업데이트
  - [ ] 양력 3라운드 배틀 테스트
  - [ ] 음력 변환 검증 (1990-08-15 음력 → 양력 10-03)
  - [ ] 호스슈 7장 카드 + 패턴 분석 확인

## 5. Error Handling

| 시나리오 | 처리 |
|----------|------|
| 음력 데이터 로드 실패 | 토글 비활성화, 양력만 사용 가능 |
| 음력→양력 변환 실패 | inputError에 메시지 표시, 배틀 진행 차단 |
| 유효하지 않은 음력 날짜 | "해당 음력 날짜가 존재하지 않습니다" 표시 |
| 질문이 100자 초과 | maxlength=100으로 자동 제한 |
| 질문에 특수문자/스크립트 | escapeHtml 처리 (기존 함수 활용) |
| 7장 드로우 시 덱 부족 | R1(3)+R2(3)+R3(7)=13장, 78장 덱에서 충분 |
