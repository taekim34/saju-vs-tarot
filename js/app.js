/**
 * 앱 컨트롤러 (app.js)
 *
 * 초기화 + 폼 관리 + 섹션 전환 + 이벤트 바인딩
 */

(async function App() {
  // ===== DOM 참조 =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sections = {
    intro: $('#section-intro'),
    input: $('#section-input'),
    battle: $('#section-battle'),
    result: $('#section-result')
  };

  // 입력 폼
  const inputYear = $('#input-year');
  const inputMonth = $('#input-month');
  const inputDay = $('#input-day');
  const inputHour = $('#input-hour');
  const inputMinute = $('#input-minute');
  const btnNoTime = $('#btn-no-time');
  const btnBattle = $('#btn-battle');
  const inputError = $('#input-error');

  // 배틀
  const roundBadge = $('#round-badge');
  const roundTopic = $('#round-topic');
  const battleLoading = $('#battle-loading');
  const battlePanels = $('#battle-panels');
  const battleVote = $('#battle-vote');
  const sajuReading = $('#saju-reading');
  const sajuChart = $('#saju-chart');
  const tarotCards = $('#tarot-cards');
  const tarotReading = $('#tarot-reading');
  const loadingCharName = $('#loading-char-name');
  const loadingCharMsg = $('#loading-char-msg');
  let loadingMsgInterval = null;

  // 결과
  const resultWinner = $('#result-winner');
  const resultScore = $('#result-score');
  const resultRounds = $('#result-rounds');
  const resultMessage = $('#result-message');

  // 공유
  const shareOverlay = $('#share-overlay');

  // U1: 양력/음력 토글
  const btnCalSolar = $('#btn-cal-solar');
  const btnCalLunar = $('#btn-cal-lunar');
  const leapMonthWrap = $('#leap-month-wrap');
  const inputLeapMonth = $('#input-leap-month');

  // U2: 자유 질문
  const inputQuestion = $('#input-question');

  // 상태
  let selectedGender = null;
  let noTimeSelected = false;
  let calendarType = 'solar';    // U1: 'solar' | 'lunar'
  let isLeapMonth = false;       // U1: 윤달 여부
  let currentUserData = null;    // 공유용 사용자 데이터 보존

  // ===== HTML 이스케이프 =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== 안전한 DOM 생성 헬퍼 =====
  function createEl(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

  // ===== 초기화 =====
  async function initialize() {
    populateSelects();
    bindEvents();

    // .env → config 로드 대기 + 사주/타로/음력 데이터 병렬 로드
    await Promise.all([
      window.__CONFIG_READY__,
      SajuEngine.loadData(),
      TarotEngine.loadData(),
      LunarConverter.loadData()
    ]);

    // URL에 ?id=xxx가 있으면 공유된 결과 표시
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');
    if (sharedId) {
      await showSharedResult(sharedId);
    }
  }

  // ===== 공유 결과 조회 표시 =====
  async function showSharedResult(id) {
    try {
      const data = await BkendClient.getResult(id);
      if (!data) {
        console.error('공유 결과를 찾을 수 없습니다:', id);
        return;
      }

      showSection('result');

      // 승자
      const winnerIcon = data.winner === 'saju' ? '\u{1F3EE}' : '\u{1F52E}';
      const winnerName = data.winner === 'saju' ? '사주' : '타로';

      resultWinner.textContent = '';
      resultWinner.appendChild(createEl('div', 'winner-icon crown-bounce', winnerIcon));
      resultWinner.appendChild(createEl('div', 'winner-name winner-reveal', `${winnerName} 승리!`));

      // 점수
      const [sajuScore, tarotScore] = (data.scores || '0-0').split('-');
      resultScore.textContent = '';
      const scoreRow = createEl('div', 'score-display');
      scoreRow.appendChild(createEl('span', 'score-saju score-count', `\u{1F3EE} ${sajuScore}`));
      scoreRow.appendChild(createEl('span', 'score-vs', ':'));
      scoreRow.appendChild(createEl('span', 'score-tarot score-count', `${tarotScore} \u{1F52E}`));
      resultScore.appendChild(scoreRow);

      // 라운드별 해석 포함 표시
      resultRounds.textContent = '';
      const rounds = data.rounds || [];
      rounds.forEach((r, i) => {
        const voteIcon = r.vote === 'saju' ? '\u{1F3EE}' : '\u{1F52E}';
        const item = createEl('div', 'result-round-item result-item-enter');
        item.style.animationDelay = `${i * 0.15}s`;
        item.appendChild(createEl('div', 'round-label', `R${i + 1}. ${r.topic || ''}`));
        if (r.vote) item.appendChild(createEl('div', 'round-vote', `내 선택: ${voteIcon}`));

        // 사주 해석
        if (r.sajuReading) {
          const sajuBox = createEl('div', 'shared-reading shared-reading-saju');
          sajuBox.appendChild(createEl('div', 'shared-reading-title', '\u{1F3EE} 사주명인'));
          r.sajuReading.split('\n').filter(l => l.trim()).forEach(line => {
            sajuBox.appendChild(createEl('p', 'shared-reading-text', line));
          });
          item.appendChild(sajuBox);
        }

        // 타로 해석
        if (r.tarotReading) {
          const tarotBox = createEl('div', 'shared-reading shared-reading-tarot');
          tarotBox.appendChild(createEl('div', 'shared-reading-title', '\u{1F52E} 타로전문가'));
          r.tarotReading.split('\n').filter(l => l.trim()).forEach(line => {
            tarotBox.appendChild(createEl('p', 'shared-reading-text', line));
          });
          item.appendChild(tarotBox);
        }

        resultRounds.appendChild(item);
      });

      // AI 메시지
      resultMessage.textContent = '';
      if (data.judgment) {
        const msgBox = createEl('div', 'message-box text-reveal');
        msgBox.appendChild(createEl('p', 'message-title', 'AI 심판의 한마디'));
        msgBox.appendChild(createEl('p', 'message-text', data.judgment));
        resultMessage.appendChild(msgBox);
      }

      // 공유 결과 안내
      const notice = createEl('p', 'shared-notice', '공유된 결과를 보고 있습니다. 나도 해보려면 아래 버튼을 눌러주세요!');
      notice.style.cssText = 'text-align:center; color:var(--color-text-dim); font-size:0.85rem; margin-top:12px;';
      resultMessage.appendChild(notice);
    } catch (e) {
      console.error('공유 결과 로드 실패:', e);
    }
  }

  // ===== 셀렉트 박스 채우기 =====
  function populateSelects() {
    for (let y = 2026; y >= 1940; y--) {
      inputYear.add(new Option(`${y}년`, y));
    }
    for (let m = 1; m <= 12; m++) {
      inputMonth.add(new Option(`${m}월`, m));
    }
    for (let d = 1; d <= 31; d++) {
      inputDay.add(new Option(`${d}일`, d));
    }
    for (let h = 0; h <= 23; h++) {
      inputHour.add(new Option(`${h}시`, h));
    }
    for (let min = 0; min <= 50; min += 10) {
      inputMinute.add(new Option(`${min}분`, min));
    }
  }

  // ===== 이벤트 바인딩 =====
  function bindEvents() {
    $('#btn-start').addEventListener('click', () => showSection('input'));

    // U1: 양력/음력 토글
    if (btnCalSolar) {
      btnCalSolar.addEventListener('click', () => {
        calendarType = 'solar';
        btnCalSolar.classList.add('selected');
        btnCalLunar.classList.remove('selected');
        if (leapMonthWrap) leapMonthWrap.style.display = 'none';
        isLeapMonth = false;
        if (inputLeapMonth) inputLeapMonth.checked = false;
      });
    }
    if (btnCalLunar) {
      btnCalLunar.addEventListener('click', () => {
        calendarType = 'lunar';
        btnCalLunar.classList.add('selected');
        btnCalSolar.classList.remove('selected');
        if (leapMonthWrap) leapMonthWrap.style.display = 'flex';
      });
    }
    if (inputLeapMonth) {
      inputLeapMonth.addEventListener('change', () => {
        isLeapMonth = inputLeapMonth.checked;
      });
    }

    $$('.btn-gender').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.btn-gender').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedGender = btn.dataset.gender;
        validateForm();
      });
    });

    btnNoTime.addEventListener('click', () => {
      noTimeSelected = !noTimeSelected;
      btnNoTime.classList.toggle('selected', noTimeSelected);
      inputHour.disabled = noTimeSelected;
      inputMinute.disabled = noTimeSelected;
      if (noTimeSelected) {
        inputHour.value = '';
        inputMinute.value = '';
      }
      validateForm();
    });

    [inputYear, inputMonth, inputDay].forEach(el => {
      el.addEventListener('change', validateForm);
    });

    btnBattle.addEventListener('click', startBattle);

    $$('.btn-vote').forEach(btn => {
      btn.addEventListener('click', () => handleVote(btn.dataset.vote));
    });

    $('#btn-share').addEventListener('click', openShareOverlay);
    $('#btn-retry').addEventListener('click', () => {
      showSection('intro');
      resetState();
    });

    // D5: 배틀 에러 재시도 버튼
    $('#btn-retry-battle')?.addEventListener('click', () => {
      $('#battle-error').style.display = 'none';
      runRound();
    });

    $('#share-close').addEventListener('click', closeShareOverlay);
    shareOverlay.addEventListener('click', (e) => {
      if (e.target === shareOverlay) closeShareOverlay();
    });

    $$('.btn-share-option').forEach(btn => {
      btn.addEventListener('click', () => ShareManager.share(btn.dataset.platform));
    });
  }

  // ===== 폼 유효성 검사 =====
  function validateForm() {
    const isValid = inputYear.value && inputMonth.value && inputDay.value && selectedGender;
    btnBattle.disabled = !isValid;
    inputError.textContent = '';
    return isValid;
  }

  // ===== 섹션 전환 =====
  function showSection(name) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    sections[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  // ===== 배틀 시작 =====
  async function startBattle() {
    if (!validateForm()) return;

    let year = parseInt(inputYear.value);
    let month = parseInt(inputMonth.value);
    let day = parseInt(inputDay.value);

    // D10: 날짜 유효성 검증 — 존재하지 않는 날짜 차단
    const testDate = new Date(year, month - 1, day);
    if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
      inputError.textContent = `${year}년 ${month}월 ${day}일은 존재하지 않는 날짜입니다.`;
      return;
    }

    // U1: 음력→양력 변환
    if (calendarType === 'lunar') {
      if (!LunarConverter.isAvailable()) {
        inputError.textContent = '음력 변환 데이터를 불러오지 못했습니다.';
        return;
      }
      const solar = LunarConverter.toSolar(year, month, day, isLeapMonth);
      if (!solar) {
        inputError.textContent = '유효하지 않은 음력 날짜입니다. 윤달 여부를 확인해주세요.';
        return;
      }
      console.log(`📅 음력 ${year}-${month}-${day}${isLeapMonth ? '(윤)' : ''} → 양력 ${solar.year}-${solar.month}-${solar.day}`);
      year = solar.year;
      month = solar.month;
      day = solar.day;
    }

    // U2: 자유 질문 수집
    const question = inputQuestion ? inputQuestion.value.trim() : '';

    const userData = {
      year,
      month,
      day,
      gender: selectedGender,
      hour: noTimeSelected ? null : (inputHour.value ? parseInt(inputHour.value) : null),
      minute: noTimeSelected ? null : (inputMinute.value ? parseInt(inputMinute.value) : null),
      question  // U2: 자유 질문 전달
    };

    currentUserData = userData;
    BattleEngine.init(userData);
    showSection('battle');
    await runRound();
  }

  // ===== 로딩 멘트 로테이션 =====
  function showNextLoadingMsg() {
    const data = LoadingMessages.getNext();
    loadingCharName.textContent = `${data.icon} ${data.name}`;
    loadingCharName.className = `loading-char-name ${data.type}`;
    loadingCharMsg.textContent = data.message;
    loadingCharMsg.classList.remove('fade-in');
    void loadingCharMsg.offsetWidth;  // reflow 트리거
    loadingCharMsg.classList.add('fade-in');
  }

  function startLoadingMessages() {
    LoadingMessages.reset();
    showNextLoadingMsg();
    loadingMsgInterval = setInterval(() => {
      loadingCharMsg.classList.remove('fade-in');
      loadingCharMsg.classList.add('fade-out');
      setTimeout(() => {
        showNextLoadingMsg();
      }, 500);  // fade-out 완료 후 교체
    }, 3500);
  }

  function stopLoadingMessages() {
    if (loadingMsgInterval) {
      clearInterval(loadingMsgInterval);
      loadingMsgInterval = null;
    }
    loadingCharMsg.classList.remove('fade-in', 'fade-out');
    loadingCharName.textContent = '';
    loadingCharMsg.textContent = '';
  }

  // ===== 라운드 실행 =====
  async function runRound() {
    const status = BattleEngine.getStatus();
    if (status.currentRound >= BattleEngine.TOTAL_ROUNDS) {
      await showFinalResult();
      return;
    }

    const nextRound = status.currentRound + 1;
    roundBadge.textContent = `ROUND ${nextRound}`;
    roundBadge.className = 'round-badge round-enter';
    roundTopic.textContent = BattleEngine.TOPICS[nextRound - 1];

    $$('.progress-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === nextRound - 1);
      dot.classList.toggle('done', i < status.currentRound);
    });

    battleLoading.style.display = 'flex';
    battlePanels.style.display = 'none';
    battleVote.style.display = 'none';

    // 로딩 캐릭터 멘트 시작
    startLoadingMessages();

    let roundData;
    try {
      roundData = await BattleEngine.nextRound();
    } catch (err) {
      console.error('라운드 진행 실패:', err);
    }

    if (!roundData) {
      stopLoadingMessages();
      battleLoading.style.display = 'none';
      const battleError = $('#battle-error');
      const battleErrorMessage = $('#battle-error-message');
      battleError.style.display = 'flex';
      battleErrorMessage.textContent = 'AI 해석 중 오류가 발생했습니다. 다시 시도해주세요.';
      return;
    }

    // 로딩 캐릭터 멘트 정지
    stopLoadingMessages();
    battleLoading.style.display = 'none';
    battlePanels.className = 'battle-panels';
    battlePanels.style.display = 'flex';

    // 사주 패널 — 명식표 + AI 해석
    renderSajuChart(sajuChart, roundData.saju.result);
    renderReading(sajuReading, roundData.saju.reading.text);
    sajuReading.closest('.battle-panel').className = 'battle-panel panel-saju panel-slide-left';

    // 타로 패널 — safe DOM build
    renderTarotCards(tarotCards, roundData.tarot.draw);
    renderReading(tarotReading, roundData.tarot.reading.text);
    tarotReading.closest('.battle-panel').className = 'battle-panel panel-tarot panel-slide-right';

    setTimeout(() => {
      battleVote.style.display = 'block';
      battleVote.className = 'battle-vote vote-enter';
      $$('.btn-vote').forEach(b => b.classList.remove('selected'));
    }, 800);
  }

  // ===== 투표 처리 =====
  function handleVote(choice) {
    BattleEngine.vote(choice);

    $$('.btn-vote').forEach(b => {
      b.classList.toggle('selected', b.dataset.vote === choice);
      if (b.dataset.vote === choice) b.classList.add('vote-selected');
    });

    setTimeout(async () => {
      battlePanels.className = 'battle-panels round-exit';
      battleVote.style.display = 'none';
      await delay(500);
      await runRound();
    }, 1000);
  }

  // ===== 최종 결과 표시 (safe DOM) =====
  async function showFinalResult() {
    battleLoading.style.display = 'flex';
    battlePanels.style.display = 'none';
    battleVote.style.display = 'none';
    $('.loading-text').textContent = '최종 판정 중...';

    const result = await BattleEngine.getFinalResult();

    showSection('result');

    // 승자
    const winnerIcon = result.winner === 'saju' ? '\u{1F3EE}' : '\u{1F52E}';
    const winnerName = result.winner === 'saju' ? '사주' : '타로';

    resultWinner.textContent = '';
    const iconEl = createEl('div', 'winner-icon crown-bounce', winnerIcon);
    const nameEl = createEl('div', 'winner-name winner-reveal', `${winnerName} 승리!`);
    resultWinner.appendChild(iconEl);
    resultWinner.appendChild(nameEl);

    // 점수
    resultScore.textContent = '';
    const scoreRow = createEl('div', 'score-display');
    scoreRow.appendChild(createEl('span', 'score-saju score-count', `\u{1F3EE} ${result.scores.saju}`));
    scoreRow.appendChild(createEl('span', 'score-vs', ':'));
    scoreRow.appendChild(createEl('span', 'score-tarot score-count', `${result.scores.tarot} \u{1F52E}`));
    resultScore.appendChild(scoreRow);
    const detailEl = createEl('div', 'score-detail',
      `투표: 사주 ${result.voteDetail.saju} - 타로 ${result.voteDetail.tarot}`);
    resultScore.appendChild(detailEl);

    // 라운드별 요약
    resultRounds.textContent = '';
    result.rounds.forEach((r, i) => {
      const voteIcon = r.vote === 'saju' ? '\u{1F3EE}' : '\u{1F52E}';
      const item = createEl('div', 'result-round-item result-item-enter');
      item.style.animationDelay = `${i * 0.15}s`;
      item.appendChild(createEl('div', 'round-label', `R${r.round}. ${r.topic}`));
      item.appendChild(createEl('div', 'round-vote', `내 선택: ${voteIcon}`));
      resultRounds.appendChild(item);
    });

    // AI 메시지
    resultMessage.textContent = '';
    const msgBox = createEl('div', 'message-box text-reveal');
    msgBox.appendChild(createEl('p', 'message-title', 'AI 심판의 한마디'));
    msgBox.appendChild(createEl('p', 'message-text', result.message || result.aiJudgment.reason || ''));
    resultMessage.appendChild(msgBox);

    // 공유용 데이터에 birth_info, question, judgment 추가
    result.birth_info = currentUserData ? `${currentUserData.year}-${currentUserData.month}-${currentUserData.day}-${currentUserData.gender}` : '';
    result.question = currentUserData?.question || '';
    result.judgment = result.message || result.aiJudgment?.reason || '';
    result.rounds = (result.rounds || []).map(r => ({
      ...r,
      sajuReading: r.saju?.reading?.text || '',
      tarotReading: r.tarot?.reading?.text || ''
    }));

    ShareManager.setResult(result);
  }

  // ===== 리딩 텍스트 렌더 (safe DOM) =====
  function renderReading(container, text) {
    container.textContent = '';
    if (!text) {
      container.appendChild(createEl('p', 'reading-text', '해석을 불러오지 못했습니다.'));
      return;
    }
    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      container.appendChild(createEl('p', 'reading-text text-reveal', line));
    });
  }

  // ===== 타로 카드 렌더 (safe DOM + 이미지) =====
  function renderTarotCards(container, drawResult) {
    container.textContent = '';
    if (!drawResult || !drawResult.reading) return;

    drawResult.reading.forEach((item, i) => {
      const card = item.card;
      const cardEl = createEl('div', 'tarot-card-item card-flip');
      cardEl.style.animationDelay = `${i * 0.2}s`;

      // 카드 이미지
      if (card.image_key) {
        const imgEl = document.createElement('img');
        imgEl.src = `images/tarot/${card.image_key}.jpg`;
        imgEl.alt = card.korean || card.name;
        imgEl.className = 'tarot-card-img';
        if (card.isReversed) imgEl.classList.add('reversed');
        cardEl.appendChild(imgEl);
      }

      // 위치/이름/방향 텍스트
      cardEl.appendChild(createEl('div', 'card-position', item.position));
      const nameEl = createEl('div', `card-name ${card.isReversed ? 'reversed' : 'upright'}`,
        card.korean || card.name);
      cardEl.appendChild(nameEl);
      cardEl.appendChild(createEl('div', 'card-direction', item.direction));
      container.appendChild(cardEl);
    });
  }

  // ===== 사주 명식표 렌더링 =====
  const ELEMENT_CLASS = { '목': 'wood', '화': 'fire', '토': 'earth', '금': 'metal', '수': 'water' };

  function renderSajuChart(container, sajuResult) {
    container.textContent = '';
    if (!sajuResult || !sajuResult.pillars) return;

    const { pillars, tenGods, dayMaster } = sajuResult;
    const cols = [
      { label: '시주', key: 'hour' },
      { label: '일주', key: 'day' },
      { label: '월주', key: 'month' },
      { label: '년주', key: 'year' }
    ];

    const table = document.createElement('div');
    table.className = 'saju-table';

    // 십성 행
    const tenGodRow = createEl('div', 'saju-row saju-row-tengod');
    cols.forEach(col => {
      const p = pillars[col.key];
      let tenGodText = '';
      if (col.key === 'day') {
        tenGodText = '일원';
      } else if (p && tenGods) {
        const stemEntry = tenGods.find(t => t.char === p.cheongan && t.tenGod);
        tenGodText = stemEntry ? stemEntry.tenGod : '';
      }
      tenGodRow.appendChild(createEl('div', 'saju-cell saju-cell-tengod', tenGodText || '–'));
    });
    table.appendChild(tenGodRow);

    // 천간 행 (큰 한자)
    const stemRow = createEl('div', 'saju-row saju-row-stem');
    cols.forEach(col => {
      const p = pillars[col.key];
      const cell = createEl('div', 'saju-cell saju-cell-hanja');
      if (p) {
        const el = SajuEngine.CHEONGAN_ELEMENT ? ELEMENT_CLASS[p.element_stem] : '';
        cell.classList.add('el-' + (ELEMENT_CLASS[getElementForStem(p.cheongan)] || ''));
        cell.appendChild(createEl('span', 'hanja-big', p.cheongan));
      } else {
        cell.appendChild(createEl('span', 'hanja-big hanja-empty', '?'));
      }
      stemRow.appendChild(cell);
    });
    table.appendChild(stemRow);

    // 지지 행 (큰 한자)
    const branchRow = createEl('div', 'saju-row saju-row-branch');
    cols.forEach(col => {
      const p = pillars[col.key];
      const cell = createEl('div', 'saju-cell saju-cell-hanja');
      if (p) {
        cell.classList.add('el-' + (ELEMENT_CLASS[getElementForBranch(p.jiji)] || ''));
        cell.appendChild(createEl('span', 'hanja-big', p.jiji));
      } else {
        cell.appendChild(createEl('span', 'hanja-big hanja-empty', '?'));
      }
      branchRow.appendChild(cell);
    });
    table.appendChild(branchRow);

    // 라벨 행 (시주/일주/월주/년주)
    const labelRow = createEl('div', 'saju-row saju-row-label');
    cols.forEach(col => {
      labelRow.appendChild(createEl('div', 'saju-cell saju-cell-label', col.label));
    });
    table.appendChild(labelRow);

    container.appendChild(table);

    // 오행 분포 바
    if (sajuResult.elements) {
      const barWrap = createEl('div', 'saju-element-bar');
      const total = Object.values(sajuResult.elements).reduce((a, b) => a + b, 0);
      const elementNames = { '목': '木', '화': '火', '토': '土', '금': '金', '수': '水' };
      Object.entries(sajuResult.elements).forEach(([el, count]) => {
        if (count > 0) {
          const seg = createEl('div', 'el-seg el-' + ELEMENT_CLASS[el]);
          seg.style.flex = count;
          seg.textContent = elementNames[el];
          barWrap.appendChild(seg);
        }
      });
      container.appendChild(barWrap);
    }
  }

  // 오행 매핑 헬퍼
  const STEM_ELEMENT = { '甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수' };
  const BRANCH_ELEMENT = { '子':'수','丑':'토','寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토','申':'금','酉':'금','戌':'토','亥':'수' };
  function getElementForStem(char) { return STEM_ELEMENT[char] || ''; }
  function getElementForBranch(char) { return BRANCH_ELEMENT[char] || ''; }

  // ===== 공유 오버레이 =====
  function openShareOverlay() {
    shareOverlay.style.display = 'flex';
  }

  function closeShareOverlay() {
    shareOverlay.style.display = 'none';
  }

  // ===== 상태 초기화 =====
  function resetState() {
    selectedGender = null;
    noTimeSelected = false;
    $$('.btn-gender').forEach(b => b.classList.remove('selected'));
    btnNoTime.classList.remove('selected');
    inputHour.disabled = false;
    inputMinute.disabled = false;
    btnBattle.disabled = true;
    [inputYear, inputMonth, inputDay, inputHour, inputMinute].forEach(el => el.value = '');

    // U1: 양력/음력 토글 초기화
    calendarType = 'solar';
    isLeapMonth = false;
    if (btnCalSolar) btnCalSolar.classList.add('selected');
    if (btnCalLunar) btnCalLunar.classList.remove('selected');
    if (leapMonthWrap) leapMonthWrap.style.display = 'none';
    if (inputLeapMonth) inputLeapMonth.checked = false;

    // U2: 질문 초기화
    if (inputQuestion) inputQuestion.value = '';
  }

  // ===== 유틸 =====
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== 시작 =====
  await initialize();
})();
