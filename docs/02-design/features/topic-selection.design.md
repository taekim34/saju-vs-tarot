# Design: topic-selection (유저 주제 선택 + 주제별 질문 + 데이터 마이그레이션)

> Created: 2026-03-10
> Feature: topic-selection
> Status: Design
> Plan: docs/01-plan/features/topic-selection.plan.md

## 1. 주제 목록 정의 (config.js)

### AVAILABLE_TOPICS 상수

```javascript
// config.js에 추가
window.__TOPICS__ = [
  { id: 'love',    name: '연애운',   emoji: '💞', placeholder: '예: 짝사랑 중인데 고백해도 될까요?' },
  { id: 'wealth',  name: '재물운',   emoji: '💰', placeholder: '예: 주식에 투자해도 괜찮을까요?' },
  { id: 'general', name: '종합운세', emoji: '🌏', placeholder: '예: 올해 전반적으로 어떤 해가 될까요?' },
  { id: 'career',  name: '직업운',   emoji: '🏆', placeholder: '예: 이직을 고민 중인데 어떨까요?' },
  { id: 'health',  name: '건강운',   emoji: '🏥', placeholder: '예: 요즘 피로가 심한데 괜찮을까요?' },
  { id: 'study',   name: '학업운',   emoji: '📚', placeholder: '예: 시험 준비가 잘 될까요?' },
  { id: 'social',  name: '대인관계', emoji: '🤝', placeholder: '예: 친구와 갈등이 있는데 어떻게 할까요?' }
];
```

기본 선택값: `['love', 'wealth', 'general']` (기존과 동일)

## 2. HTML 변경 (index.html)

### 2.1 기존 질문 입력 제거 → 주제 선택 + 주제별 질문으로 대체

기존 `<!-- U2: 자유 질문 입력 -->` 블록을 아래로 교체:

```html
<!-- 주제 선택 (3개 필수) -->
<div class="form-group">
  <label class="form-label">배틀 주제 선택 <span class="required">*3개 선택</span></label>
  <p class="form-hint">선택한 순서대로 배틀이 진행됩니다</p>
  <div id="topic-chips" class="topic-chips">
    <!-- JS에서 동적 생성 -->
  </div>
  <div id="topic-error" class="error-message" style="display:none;"></div>
</div>

<!-- 주제별 질문 입력 (선택) -->
<div id="topic-questions" class="topic-questions" style="display:none;">
  <label class="form-label">주제별 고민 <span class="optional">선택</span></label>
  <p class="form-hint">구체적인 질문을 남기면 AI가 맞춤 해석을 해드려요</p>
  <div id="topic-question-fields"></div>
</div>
```

### 2.2 라운드 헤더 변경

라운드 badge를 topic 이모지+이름으로 표시 (기존 `round-topic`을 동적 주제명으로):
- `ROUND 1` → `ROUND 1`은 유지
- `#round-topic` 내용을 동적 주제명으로 (이미 app.js에서 설정 중)

## 3. CSS 변경 (style.css)

### 3.1 주제 칩 스타일

```css
.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.topic-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 2px solid #444;
  border-radius: 24px;
  background: rgba(255,255,255,0.05);
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  user-select: none;
}

.topic-chip:hover {
  border-color: #888;
  background: rgba(255,255,255,0.1);
}

.topic-chip.selected {
  border-color: #ffd700;
  background: rgba(255,215,0,0.15);
  color: #fff;
}

.topic-chip .chip-order {
  display: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffd700;
  color: #000;
  font-size: 0.7rem;
  font-weight: bold;
  line-height: 20px;
  text-align: center;
}

.topic-chip.selected .chip-order {
  display: inline-block;
}
```

### 3.2 주제별 질문 필드 스타일

```css
.topic-questions {
  margin-top: 12px;
}

.topic-q-field {
  margin-bottom: 10px;
}

.topic-q-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #aaa;
  margin-bottom: 4px;
}

.topic-q-input {
  /* form-input 클래스 공유 (기존 스타일) */
}
```

## 4. app.js 변경

### 4.1 새 상태 변수

```javascript
let selectedTopics = [];  // [{id, name, emoji, placeholder}, ...] 순서 유지
```

### 4.2 주제 칩 렌더링 (initialize 또는 bindEvents 내)

```javascript
function renderTopicChips() {
  const container = $('#topic-chips');
  container.textContent = '';
  const topics = window.__TOPICS__ || [];
  const defaultIds = ['love', 'wealth', 'general'];

  topics.forEach(t => {
    const chip = createEl('div', 'topic-chip');
    chip.dataset.topicId = t.id;

    const order = createEl('span', 'chip-order', '');
    chip.appendChild(order);
    chip.appendChild(createEl('span', 'chip-emoji', t.emoji));
    chip.appendChild(createEl('span', 'chip-name', t.name));

    chip.addEventListener('click', () => toggleTopic(t, chip));
    container.appendChild(chip);

    // 기본 선택
    if (defaultIds.includes(t.id)) {
      toggleTopic(t, chip);
    }
  });
}
```

### 4.3 주제 토글 로직

```javascript
function toggleTopic(topic, chipEl) {
  const idx = selectedTopics.findIndex(t => t.id === topic.id);
  if (idx >= 0) {
    // 해제
    selectedTopics.splice(idx, 1);
    chipEl.classList.remove('selected');
  } else {
    // 추가 (3개 제한)
    if (selectedTopics.length >= 3) {
      showTopicError('3개까지만 선택할 수 있어요!');
      return;
    }
    selectedTopics.push(topic);
    chipEl.classList.add('selected');
  }
  updateChipOrders();
  updateTopicQuestions();
  validateForm();
}

function updateChipOrders() {
  $$('.topic-chip').forEach(chip => {
    const order = chip.querySelector('.chip-order');
    const idx = selectedTopics.findIndex(t => t.id === chip.dataset.topicId);
    if (idx >= 0) {
      order.textContent = idx + 1;
      chip.classList.add('selected');
    } else {
      order.textContent = '';
      chip.classList.remove('selected');
    }
  });
}
```

### 4.4 주제별 질문 필드 동적 생성

```javascript
function updateTopicQuestions() {
  const container = $('#topic-question-fields');
  const wrap = $('#topic-questions');
  container.textContent = '';

  if (selectedTopics.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  selectedTopics.forEach((t, i) => {
    const field = createEl('div', 'topic-q-field');
    const label = createEl('div', 'topic-q-label');
    label.appendChild(createEl('span', '', `${t.emoji} ${t.name}`));
    field.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input topic-q-input';
    input.placeholder = t.placeholder;
    input.maxLength = 100;
    input.dataset.topicId = t.id;
    // 기존 값 보존
    const existing = container.querySelector(`[data-topic-id="${t.id}"]`);
    if (existing) input.value = existing.value;
    field.appendChild(input);
    container.appendChild(field);
  });
}
```

### 4.5 배틀 시작 시 데이터 전달

```javascript
// btn-battle 클릭 핸들러 내부
const topicNames = selectedTopics.map(t => t.name);
const topicQuestions = {};
$$('.topic-q-input').forEach(input => {
  if (input.value.trim()) {
    const t = selectedTopics.find(s => s.id === input.dataset.topicId);
    if (t) topicQuestions[t.name] = input.value.trim();
  }
});

const userData = {
  year, month, day, gender: selectedGender,
  hour: hourVal, minute: minuteVal,
  topics: topicNames,           // NEW: ['연애운', '직업운', '건강운']
  questions: topicQuestions      // NEW: { '연애운': '질문1', '직업운': '질문2' }
};
```

### 4.6 결과 표시 변경

`showFinalResult()` 내 라운드 표시:
- 기존: `ROUND ${i+1}` + `r.topic`
- 변경: 동일 (topic은 이미 동적으로 설정됨, 추가 변경 불필요)

`showSharedResult()` 내:
- `topicDesc` 맵에 4개 신규 주제 추가
- `topics` 필드가 있으면 해당 주제명 사용, 없으면 기본 3개

### 4.7 폼 검증 변경

```javascript
function validateForm() {
  const valid = inputYear.value && inputMonth.value && inputDay.value
    && selectedGender && selectedTopics.length === 3;
  btnBattle.disabled = !valid;
}
```

기존 `inputQuestion` 관련 로직 제거 (단일 질문 → 주제별 질문으로 대체).

## 5. battle.js 변경

### 5.1 동적 TOPICS + 주제별 질문

```javascript
// 기존:
const TOPICS = ['연애운', '재물운', '종합운세'];
let userQuestion = '';

// 변경:
let TOPICS = ['연애운', '재물운', '종합운세'];  // const → let
let topicQuestions = {};  // { '연애운': '질문', ... }

function init(userData) {
  // ... 기존 코드 ...

  // 동적 주제 설정
  if (userData.topics && userData.topics.length === 3) {
    TOPICS = userData.topics;
  }

  // 주제별 질문 저장
  topicQuestions = userData.questions || {};
  userQuestion = '';  // 레거시 호환 (사용하지 않음)

  // ... 나머지 동일 ...
}
```

### 5.2 nextRound에서 주제별 질문 사용

```javascript
async function nextRound() {
  // ...
  const topic = TOPICS[currentRound - 1];

  // 주제별 개별 질문 사용
  const roundQuestion = topicQuestions[topic] || '';

  // AI 해석 요청
  const [sajuReading, tarotReading] = await Promise.all([
    AIInterpreter.getSajuReading(sajuResult, topic, sajuResult.gender, roundQuestion),
    AIInterpreter.getTarotReading(tarotDraw, topic, roundQuestion, tarotAdvanced)
  ]);
  // ...
}
```

### 5.3 return 객체에 TOPICS 노출 방식 변경

```javascript
return {
  init,
  nextRound,
  vote,
  getFinalResult,
  getStatus,
  getTopics: () => [...TOPICS],  // getter로 변경
  TOTAL_ROUNDS
};
```

## 6. ai-interpreter.js 변경

### 6.1 topicMap 확장 (getSajuReading)

```javascript
const topicMap = {
  '연애운': '연애운과 이성 관계',
  '재물운': '재물운과 금전 흐름',
  '종합운세': `${currentYear}년 종합운세`,
  '직업운': '직업운과 커리어 발전',
  '건강운': '건강운과 신체 밸런스',
  '학업운': '학업운과 시험/자격증',
  '대인관계': '대인관계와 사회생활'
};
```

### 6.2 topicEmoji 확장 (사주 + 타로 모두)

```javascript
const topicEmoji = {
  '연애운': '💞', '재물운': '💰', '종합운세': '🌏',
  '직업운': '🏆', '건강운': '🏥', '학업운': '📚', '대인관계': '🤝'
};
```

### 6.3 사주 프롬프트 구조 — 신규 주제 4개

기존 `hasQuestion` 분기와 주제별 분기 패턴을 유지하되, `${topic}에 영향을 주는 사주 요소` 섹션은 모든 주제에 공통이므로 주제명만 동적으로 들어가면 충분.

특별 처리가 필요한 부분:
- **직업운**: 관성(정관/편관), 식상(식신/상관), 역마살 강조 지시
- **건강운**: 오행 균형, 병부(病符), 체질 분석 강조 지시
- **학업운**: 인성(정인/편인), 식상, 문창귀인 강조 지시
- **대인관계**: 비겁(비견/겁재), 관성, 천을귀인 강조 지시

→ 시스템 프롬프트에 `【현재 주제 특화 지시】` 블록을 동적으로 추가:

```javascript
const topicSpecific = {
  '직업운': '특히 관성(정관/편관), 식상(식신/상관), 역마살에 주목하세요. 적성, 승진, 이직 타이밍을 사주로 분석하세요.',
  '건강운': '특히 오행의 균형/불균형, 용신의 건강 영향, 사주 체질론에 주목하세요. 약한 오행이 어떤 장기에 영향을 줄 수 있는지 분석하세요.',
  '학업운': '특히 인성(정인/편인), 식상(식신/상관), 문창귀인에 주목하세요. 집중력, 학습 성향, 시험운을 분석하세요.',
  '대인관계': '특히 비겁(비견/겁재), 관성, 천을귀인에 주목하세요. 대인 성향, 갈등 요인, 좋은 인연의 시기를 분석하세요.'
};
```

### 6.4 타로 프롬프트 구조 — 신규 주제 4개

동일한 패턴으로 타로 특화 지시 추가:

```javascript
const tarotTopicSpecific = {
  '직업운': '특히 펜타클과 완드 수트, 세계/황제/마법사 카드에 주목하세요. 커리어 방향성, 직장 내 에너지를 카드로 읽어주세요.',
  '건강운': '특히 검(소드) 수트, 탑/절제/별 카드에 주목하세요. 스트레스, 에너지 밸런스, 회복 신호를 카드로 읽어주세요.',
  '학업운': '특히 소드 수트, 은둔자/마법사/여사제 카드에 주목하세요. 집중력, 지적 에너지, 시험 결과를 카드로 읽어주세요.',
  '대인관계': '특히 컵 수트와 코트 카드에 주목하세요. 주변 사람들의 에너지, 관계 역학, 좋은 인연을 카드로 읽어주세요.'
};
```

## 7. bkend-client.js 변경

### 7.1 saveResult 확장

```javascript
async function saveResult(data) {
  // ...
  body: JSON.stringify({
    winner: data.winner,
    scores: data.scores,
    rounds: data.rounds || [],
    birth_info: data.birth_info,
    question: data.question || '',         // 레거시 호환 (빈 문자열)
    judgment: data.judgment || '',
    topics: data.topics || [],             // NEW: ['연애운', '직업운', '건강운']
    questions: data.questions || {},        // NEW: { '연애운': '질문1', ... }
    sajuResult: data.sajuResult || null     // 기존 유지
  })
}
```

### 7.2 saveStat 확장

```javascript
async function saveStat(data) {
  // ...
  body: JSON.stringify({
    winner: data.winner,
    gender: data.gender || '',
    birth_year: data.birth_year || 0,
    r1_vote: data.r1_vote || '',           // 레거시 호환 유지
    r2_vote: data.r2_vote || '',
    r3_vote: data.r3_vote || '',
    topics: data.topics || [],             // NEW: 선택된 3개 주제
    topic_votes: data.topic_votes || {}    // NEW: { '직업운': 'saju', ... }
  })
}
```

### 7.3 getResult 호환

`getResult()`는 변경 불필요 — 스키마리스이므로 새 필드는 자동으로 포함.
읽는 쪽(app.js)에서 `data.topics || ['연애운', '재물운', '종합운세']` 기본값 처리.

## 8. stats.js 변경

### 8.1 레거시 + 신규 쿼리 공존

기존 `r1_vote`/`r2_vote`/`r3_vote` 쿼리는 유지하되, 제목을 "주제별 투표"로 변경.

새 데이터(`topics` 필드가 있는 레코드)가 충분히 쌓이면, 향후 `topic_votes` 기반 쿼리로 전환 가능.

현재는 기존 쿼리로 충분 — `r1_vote`의 의미를 "첫 번째 선택 주제"로 재해석.

### 8.2 통계 제목 변경

```javascript
// 기존:
roundCard.appendChild(createEl('h3', 'stats-card-title', '라운드별 투표'));
TOPICS.forEach(topic => { ... });

// 변경:
roundCard.appendChild(createEl('h3', 'stats-card-title', '주제별 투표'));
// TOPICS는 기존 3개 고정 (레거시 데이터 호환)
// 향후 topic_votes 기반으로 동적 주제 통계 추가 가능
```

## 9. 데이터 마이그레이션 전략

### 원칙: Soft Migration (기존 필드 유지 + 새 필드 추가)

| 필드 | 기존 데이터 | 신규 데이터 | 읽기 시 처리 |
|------|------------|------------|-------------|
| `question` | 단일 질문 | 빈 문자열 | 레거시로 표시 |
| `questions` | 없음 | `{ topic: question }` | 없으면 `question`에서 fallback |
| `topics` | 없음 | `['주제1','주제2','주제3']` | 없으면 `['연애운','재물운','종합운세']` |
| `r1_vote`~`r3_vote` | 고정 주제 | 동적 주제의 순서대로 | 그대로 사용 |
| `topic_votes` | 없음 | `{ topic: vote }` | 없으면 r1/r2/r3에서 역추론 |

### 기존 공유 URL 호환

`showSharedResult(id)`:
1. `data.topics`가 없으면 기본 3개 주제 적용
2. `data.questions`가 없으면 `data.question`을 종합운세에 매핑
3. 라운드별 `r.topic`은 이미 존재하므로 그대로 사용

## 10. 구현 순서

```
Phase 1: config.js         → __TOPICS__ 정의
Phase 2: battle.js         → 동적 TOPICS + 주제별 질문
Phase 3: ai-interpreter.js → 4개 주제 프롬프트 추가
Phase 4: bkend-client.js   → 확장 필드 저장
Phase 5: index.html + CSS  → 주제 선택 UI + 질문 필드
Phase 6: app.js            → 칩 렌더/토글 + 폼 검증 + 결과 표시
Phase 7: stats.js          → 제목 변경 + 호환
Phase 8: app.js            → 공유 페이지 호환 (topics fallback)
```

## 11. 테스트 체크리스트

- [ ] 기본 선택(연애운/재물운/종합운세)으로 기존과 동일하게 동작
- [ ] 3개 주제 선택 → 선택 순서대로 배틀 진행
- [ ] 4개 이상 선택 시 에러 표시
- [ ] 주제별 질문 입력 → 해당 라운드에서 질문 반영
- [ ] 질문 미입력 시 주제에만 집중
- [ ] 기존 공유 URL (?id=xxx) 정상 표시
- [ ] 신규 결과 공유 → 주제명 포함
- [ ] 통계 화면 정상 표시
- [ ] 모바일에서 칩 선택 원활
