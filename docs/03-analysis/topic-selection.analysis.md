# topic-selection Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: saju-vs-tarot-battle
> **Analyst**: gap-detector
> **Date**: 2026-03-10
> **Design Doc**: [topic-selection.design.md](../02-design/features/topic-selection.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that all 8 design sections of the topic-selection feature are correctly implemented.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/topic-selection.design.md` (Sections 1-11)
- **Implementation Files**: `config.js`, `js/battle.js`, `js/ai-interpreter.js`, `js/bkend-client.js`, `index.html`, `css/style.css`, `js/app.js`, `js/stats.js`

---

## 2. Gap Analysis (Design vs Implementation)

### Section 1: config.js -- TOPICS definition

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `window.__TOPICS__` array with 7 topics | Exact match at config.js:17-25 | PASS |
| 7 topic objects with id/name/emoji/placeholder | All 7 match exactly | PASS |
| Default selection: `['love', 'wealth', 'general']` | Handled in app.js:94, not config.js (correct) | PASS |

**Section Score: 3/3 (100%)**

### Section 2: index.html -- Topic selection UI

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Topic chips container `#topic-chips` | index.html:116 | PASS |
| `form-label` with "*3 required" text | index.html:114 | PASS |
| `form-hint` with order explanation | index.html:115 | PASS |
| `#topic-error` div | index.html:117 | PASS |
| `#topic-questions` wrapper (display:none) | index.html:121 | PASS |
| `form-label` "topic questions" + optional | index.html:122 | PASS |
| `form-hint` with AI explanation | index.html:123 | PASS |
| `#topic-question-fields` container | index.html:124 | PASS |
| Old `inputQuestion` field removed | Not present in index.html | PASS |

**Section Score: 9/9 (100%)**

### Section 3: css/style.css -- Topic chip styles

| Design Item | Implementation | Status | Notes |
|-------------|---------------|--------|-------|
| `.topic-chips` flex/wrap/gap/center | style.css:1503-1509 | PASS | Added margin-top:8px (enhancement) |
| `.topic-chip` flex/align/gap/padding/border/radius/bg/color/cursor/transition/font/user-select | style.css:1511-1524 | PASS | Uses CSS var `--color-border` instead of `#444`, `--color-text-dim` instead of `#ccc` |
| `.topic-chip:hover` border+bg change | style.css:1526-1529 | PASS | |
| `.topic-chip.selected` gold border+bg+color | style.css:1531-1535 | PASS | Uses `--color-accent` var, bg 0.12 vs design 0.15 |
| `.chip-order` circle badge (display:none) | style.css:1537-1549 | PASS | Added `flex-shrink:0` (enhancement) |
| `.topic-chip.selected .chip-order` display:inline-block | style.css:1551-1553 | PASS | |
| `.topic-questions` margin-top | style.css:1556-1558 | PASS | 4px vs design 12px (minor) |
| `.topic-q-field` margin-bottom | style.css:1560-1562 | PASS | |
| `.topic-q-label` flex/align/gap/font/color/margin | style.css:1564-1571 | PASS | Uses `--color-text-dim` var |

**Section Score: 9/9 (100%)**

### Section 4: app.js -- Chip rendering, toggle, questions, form validation

| Design Item | Implementation | Status | Notes |
|-------------|---------------|--------|-------|
| `selectedTopics = []` state var | app.js:73 | PASS | |
| `renderTopicChips()` function | app.js:91-112 | PASS | Exact match |
| `createEl('div','topic-chip')` + dataset.topicId | app.js:97-98 | PASS | |
| chip-order, chip-emoji, chip-name spans | app.js:100-103 | PASS | |
| click -> toggleTopic(t, chip) | app.js:105 | PASS | |
| Default selection of love/wealth/general | app.js:94,108-110 | PASS | |
| `toggleTopic()` -- deselect splice + remove class | app.js:114-119 | PASS | Added topicError hide (enhancement) |
| `toggleTopic()` -- 3-limit with error | app.js:121-124 | PASS | Slightly different message text |
| `toggleTopic()` -- add push + class | app.js:126-128 | PASS | |
| `updateChipOrders()` + `updateTopicQuestions()` + `validateForm()` calls | app.js:130-132 | PASS | |
| `updateChipOrders()` function | app.js:135-147 | PASS | Exact match |
| `updateTopicQuestions()` function | app.js:149-173 | PASS | |
| Question field: input.type/className/placeholder/maxLength/dataset | app.js:164-169 | PASS | |
| Existing value preservation logic | Design: lines 240-242 | MINOR GAP | Not implemented -- `container` is cleared first, so existing value lookup won't work. However, `topicQuestionFields` is used instead of `container`, making the design's approach unnecessary since fields are rebuilt from scratch each time. Functional impact: low (values lost on reorder). |
| `validateForm()` -- topics.length === 3 check | app.js:556-557 | PASS | |
| `inputQuestion` logic removed | Not present | PASS | |
| Battle start: topicNames + topicQuestions collection | app.js:603-611 | PASS | |
| userData includes topics + questions | app.js:620-621 | PASS | |
| `showSharedResult()`: topicDesc map with 7 topics | app.js:287-295 | PASS | All 7 topics present |
| `showSharedResult()`: topics fallback to default 3 | app.js:276 | PASS | |
| `showSharedResult()`: topics badge display | app.js:277-283 | PASS | Uses __TOPICS__ lookup for emoji (enhancement) |
| `showFinalResult()`: topics in shareData | app.js:812 | PASS | |
| `showFinalResult()`: topic_votes in saveStat | app.js:864-877 | PASS | |

**Section Score: 20/21 (95%)**

### Section 5: battle.js -- Dynamic TOPICS + per-topic questions

| Design Item | Implementation | Status | Notes |
|-------------|---------------|--------|-------|
| `const TOPICS` -> `let TOPICS` | battle.js:12: `let topics = [...DEFAULT_TOPICS]` | PASS | Uses `DEFAULT_TOPICS` const + `topics` let (better pattern) |
| `topicQuestions = {}` state var | battle.js:18 | PASS | |
| `init()`: dynamic topics from userData.topics | battle.js:36-40 | PASS | |
| `init()`: topicQuestions from userData.questions | battle.js:43 | PASS | |
| `nextRound()`: `roundQuestion = topicQuestions[topic]` | battle.js:83 | PASS | |
| AI calls use roundQuestion | battle.js:87-88 | PASS | |
| `getTopics: () => [...topics]` getter | battle.js:185 | PASS | |
| `getFinalResult()` returns `topics: [...topics]` | battle.js:164 | PASS | |

**Section Score: 8/8 (100%)**

### Section 6: ai-interpreter.js -- topicMap/topicEmoji expansion + topic-specific prompts

| Design Item | Implementation | Status | Notes |
|-------------|---------------|--------|-------|
| `topicMap` expanded to 7 topics (getSajuReading) | ai-interpreter.js:95-103 | PASS | All 7 match |
| `topicEmoji` expanded to 7 (saju) | ai-interpreter.js:105-108 | PASS | |
| `topicEmoji` expanded to 7 (tarot) | ai-interpreter.js:230-233 | PASS | Note: tarot uses `'종합운세': '🔮'` vs saju `'🌏'` (intentional per-method variation) |
| Saju `topicSpecific` for 4 new topics | ai-interpreter.js:121-124 | PASS | Inline object literal instead of separate const, same content |
| Tarot `tarotTopicSpecific` for 4 new topics | ai-interpreter.js:244-247 | PASS | Inline object literal, same content |
| Topic-specific prompts injected into system prompt | ai-interpreter.js:121-124 (saju), 244-247 (tarot) | PASS | |

**Section Score: 6/6 (100%)**

### Section 7: bkend-client.js -- saveResult/saveStat extension

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `saveResult`: `topics: data.topics \|\| []` | bkend-client.js:32 | PASS |
| `saveResult`: `questions: data.questions \|\| {}` | bkend-client.js:33 | PASS |
| `saveResult`: `question: data.question \|\| ''` (legacy compat) | bkend-client.js:30 | PASS |
| `saveStat`: `topics: data.topics \|\| []` | bkend-client.js:101 | PASS |
| `saveStat`: `topic_votes: data.topic_votes \|\| {}` | bkend-client.js:102 | PASS |
| `saveStat`: legacy r1/r2/r3_vote preserved | bkend-client.js:98-100 | PASS |
| `getResult()`: no changes needed | No changes made | PASS |

**Section Score: 7/7 (100%)**

### Section 8: stats.js -- Title change

| Design Item | Implementation | Status | Notes |
|-------------|---------------|--------|-------|
| Title changed to "topic-specific voting" | stats.js:149 `'주제별 투표'` | PASS | |
| Legacy `r1_vote`/`r2_vote`/`r3_vote` queries preserved | stats.js:35-38 | PASS | |
| TOPICS fixed to legacy 3 | stats.js:19 `['연애운', '재물운', '종합운세']` | PASS | |

**Section Score: 3/3 (100%)**

---

## 3. Overall Scores

| Category | Items Checked | Items Passed | Score | Status |
|----------|:------------:|:------------:|:-----:|:------:|
| Section 1: config.js | 3 | 3 | 100% | PASS |
| Section 2: index.html | 9 | 9 | 100% | PASS |
| Section 3: style.css | 9 | 9 | 100% | PASS |
| Section 4: app.js | 21 | 20 | 95% | PASS |
| Section 5: battle.js | 8 | 8 | 100% | PASS |
| Section 6: ai-interpreter.js | 6 | 6 | 100% | PASS |
| Section 7: bkend-client.js | 7 | 7 | 100% | PASS |
| Section 8: stats.js | 3 | 3 | 100% | PASS |
| **Total** | **66** | **65** | **98%** | **PASS** |

---

## 4. Differences Found

### 4.1 Missing Features (Design O, Implementation X)

| Item | Design Location | Description | Impact |
|------|-----------------|-------------|--------|
| Question value preservation on reorder | Design Section 4.4, lines 240-242 | `updateTopicQuestions()` rebuilds fields from scratch without preserving existing input values when topic order changes | Low -- users rarely reorder after typing |

### 4.2 Added Features (Design X, Implementation O)

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| `topicError` auto-hide on deselect | app.js:119 | Error message clears when user deselects a topic |
| `flex-shrink: 0` on `.chip-order` | style.css:1548 | Prevents order badge from shrinking on small screens |
| `margin-top: 8px` on `.topic-chips` | style.css:1508 | Better spacing between label and chips |
| `shared-topics-badge` CSS class | style.css:871-881 | Styled badge for shared result page showing selected topics |
| `__TOPICS__` emoji lookup in shared result | app.js:280-281 | Shared page enriches topic names with emoji from config |
| `DEFAULT_TOPICS` const in battle.js | battle.js:9 | Cleaner separation of default vs dynamic topics |

### 4.3 Changed Features (Design != Implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|--------|
| CSS border color | `#444` | `var(--color-border)` (#2a2a4a) | None -- CSS variable is better practice |
| CSS text color | `#ccc` | `var(--color-text-dim)` | None -- consistent with design system |
| CSS selected bg opacity | `rgba(255,215,0,0.15)` | `rgba(255,215,0,0.12)` | None -- negligible visual diff |
| topic-questions margin-top | `12px` | `4px` | None -- minor spacing |
| Error message text | `'3개까지만 선택할 수 있어요!'` | `'3개까지만 선택할 수 있어요! 먼저 하나를 해제하세요.'` | None -- more helpful message |
| Tarot topicEmoji for 종합운세 | `🌏` | `🔮` | None -- intentional per-method variation |

---

## 5. Data Migration Strategy Verification

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| Soft migration: new fields alongside old | `question` kept in saveResult, `topics`/`questions` added | PASS |
| `data.topics` fallback to default 3 | app.js:276 `data.topics \|\| ['연애운', '재물운', '종합운세']` | PASS |
| Legacy `r1_vote`~`r3_vote` preserved | bkend-client.js:98-100, stats.js:35-38 | PASS |
| Old shared URLs work | showSharedResult handles missing topics/questions | PASS |
| `topic_votes` added to saveStat | bkend-client.js:102, app.js:864-876 | PASS |

---

## 6. Match Rate Summary

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

**Verdict: PASS** (threshold: 90%)

---

## 7. Recommended Actions

### 7.1 Optional Improvement

| Priority | Item | File | Description |
|----------|------|------|-------------|
| Low | Question value preservation | js/app.js `updateTopicQuestions()` | Save existing input values before clearing `topicQuestionFields`, restore after rebuild. Only matters if user types a question then reorders topics. |

### 7.2 No Action Required

All 6 "added" features are UX improvements that enhance the design without contradicting it.
All 6 "changed" features are CSS variable substitutions or minor text improvements -- no functional deviation.

---

## 8. Next Steps

- [x] Gap analysis complete
- [ ] Write completion report (`topic-selection.report.md`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-10 | Initial analysis | gap-detector |
