# 로딩 멘트 개선 + 결과 공유(bkend) 구현 계획

## Feature 1: 로딩 중 캐릭터 멘트

### 개요
"운세를 읽는 중..." 대신 사주명인/타로전문가 캐릭터가 번갈아 한마디씩 던지는 방식

### 구현

**1. `js/loading-messages.js` 신규 생성**
- `SAJU_MESSAGES[100]` — 한자어 섞은 전문가 톤
  - 예: "命(명)의 흐름이 보이기 시작합니다..."
  - 예: "天干(천간)과 地支(지지)의 기운을 읽고 있습니다"
- `TAROT_MESSAGES[100]` — 신비로운 말투
  - 예: "카드가 당신의 이름을 속삭이고 있어요..."
  - 예: "운명의 실이 엮이고 있습니다..."
- `getRandomMessage()` 함수: 사주/타로 번갈아 반환

**2. `js/app.js` 수정 — runRound()**
- 로딩 시작 시 `setInterval(3500ms)`로 메시지 교체
- 메시지 앞에 캐릭터 아이콘 표시 (🏮 사주명인 / 🔮 타로전문가)
- 로딩 완료 시 interval 정리

**3. `index.html` 수정**
- `.loading-text` 영역에 캐릭터 이름 + 멘트 구조 추가
- `loading-messages.js` script 태그 추가

**4. `css/style.css` 수정**
- 메시지 fade-in/fade-out 전환 애니메이션
- 캐릭터 이름 스타일 (사주=주황, 타로=보라)

---

## Feature 2: 결과 공유 (bkend.ai)

### 개요
배틀 결과를 bkend DB에 저장하고, 고유 ID로 공유 URL 생성

### 데이터 모델 (bkend 테이블: `battle_results`)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | auto | PK (bkend 자동생성) |
| winner | string | "saju" / "tarot" |
| scores | string | "60-40" |
| rounds | json | [{topic, vote, sajuReading(요약), tarotReading(요약)}] |
| birth_info | string | "1990-03-15-male" |
| question | string | 사용자 질문 |
| judgment | string | AI 심판 한마디 |
| created_at | datetime | 생성 시각 |

### 구현

**1. bkend 프로젝트 설정**
- bkend.ai에서 프로젝트 생성 + API 키 발급
- `battle_results` 테이블 생성

**2. `js/bkend-client.js` 신규 생성**
- bkend REST API wrapper
- `saveResult(data)` → POST → 반환된 ID로 공유 URL 생성
- `getResult(id)` → GET → 공유 페이지에서 결과 조회

**3. `js/share.js` 수정**
- `getShareUrl()` → bkend 저장 후 `?id=xxx` 형식 URL 반환
- 공유 시 먼저 bkend에 저장 → ID 받기 → URL 생성

**4. `js/app.js` 수정**
- 페이지 로드 시 URL에 `?id=xxx`가 있으면 bkend에서 조회
- 조회된 결과를 결과 화면에 표시 (읽기 전용 모드)

**5. `config.js` 수정**
- `BKEND_PROJECT_ID` 설정 추가

---

## 구현 순서

1. **Batch 1** (독립): `loading-messages.js` 생성 (100+100 멘트)
2. **Batch 2** (독립): CSS 애니메이션 추가
3. **Batch 3** (의존): `app.js` 로딩 멘트 연동
4. **Batch 4** (독립): bkend 프로젝트 설정 + `bkend-client.js`
5. **Batch 5** (의존): `share.js` + `app.js` bkend 연동
6. **Batch 6**: `index.html` 업데이트 + 테스트
