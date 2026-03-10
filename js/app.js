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
    result: $('#section-result'),
    stats: $('#section-stats')
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
  const sajuInfo = $('#saju-info');
  const tarotCards = $('#tarot-cards');
  const tarotInfo = $('#tarot-info');
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

      // 결과 컨테이너를 공유용으로 재구성
      const container = document.getElementById('result-card');
      container.textContent = '';
      container.className = 'result-container shared-result';

      // 생년월일 + 성별 + 시간
      const birthInfo = data.birth_info || '';
      if (birthInfo) {
        const parts = birthInfo.split('-');
        const genderText = parts[3] === 'male' ? '\u{1F468} 남성' : '\u{1F469} 여성';
        let birthText = `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 ${genderText}`;
        if (parts[4] != null && parts[4] !== '') {
          const h = String(parts[4]).padStart(2, '0');
          const m = String(parts[5] || 0).padStart(2, '0');
          birthText += ` ${h}:${m}생`;
        }
        container.appendChild(createEl('div', 'shared-birth-badge', birthText));
      }

      // 승자
      const winnerIcon = data.winner === 'saju' ? '\u{1F3EE}' : '\u{1F52E}';
      const winnerName = data.winner === 'saju' ? '사주' : '타로';
      const loserName = data.winner === 'saju' ? '타로' : '사주';
      const winnerDiv = createEl('div', 'shared-winner');
      winnerDiv.appendChild(createEl('div', 'winner-icon crown-bounce', winnerIcon));
      winnerDiv.appendChild(createEl('div', 'winner-name winner-reveal', `${winnerName} 승리!`));
      container.appendChild(winnerDiv);

      // 점수 + 친절한 설명
      const [sajuScore, tarotScore] = (data.scores || '0-0').split('-');
      const scoreDiv = createEl('div', 'shared-score');
      const scoreRow = createEl('div', 'score-display');
      scoreRow.appendChild(createEl('span', 'score-saju score-count', `\u{1F3EE} ${sajuScore}`));
      scoreRow.appendChild(createEl('span', 'score-vs', ':'));
      scoreRow.appendChild(createEl('span', 'score-tarot score-count', `${tarotScore} \u{1F52E}`));
      scoreDiv.appendChild(scoreRow);
      scoreDiv.appendChild(createEl('div', 'shared-caption',
        `3라운드 투표에서 ${winnerName}의 해석이 ${loserName}보다 더 공감을 얻었어요`));
      container.appendChild(scoreDiv);

      // 사주 명식표 (첫 라운드 데이터에서)
      const rounds = data.rounds || [];
      const sajuPillars = rounds[0]?.sajuPillars;
      const sajuElements = rounds[0]?.sajuElements;
      if (sajuPillars) {
        const chartSection = createEl('div', 'shared-saju-section');
        chartSection.appendChild(createEl('h3', 'shared-section-title', '\u{1F3EE} 사주 명식'));
        chartSection.appendChild(createEl('p', 'shared-caption',
          '생년월일을 기반으로 계산한 사주팔자입니다. 네 기둥(년/월/일/시)의 한자가 타고난 운명을 나타내요'));
        const chartContainer = createEl('div', 'saju-chart');
        renderSajuChart(chartContainer, { pillars: sajuPillars, elements: sajuElements });
        chartSection.appendChild(chartContainer);
        container.appendChild(chartSection);
      }

      // 라운드별 설명 텍스트
      const topicDesc = {
        '\uC5F0\uC560\uC6B4': '사랑과 인간관계에 대한 운세를 동양과 서양이 각각 풀이했어요',
        '\uC7AC\uBB3C\uC6B4': '돈과 재물에 관한 흐름을 두 관점에서 비교했어요',
        '\uC885\uD569\uC6B4\uC138': '올해의 전체적인 운세를 종합적으로 판단했어요'
      };

      // 라운드별 — 선택된 쪽만 표시
      rounds.forEach((r, i) => {
        const roundSection = createEl('div', 'shared-round');
        const isSaju = r.vote === 'saju';

        // 라운드 헤더
        const header = createEl('div', 'shared-round-title');
        header.appendChild(createEl('span', 'shared-round-num', `ROUND ${i + 1}`));
        header.appendChild(createEl('span', 'shared-round-topic', r.topic || ''));
        const badge = createEl('span', `shared-vote-badge ${isSaju ? 'saju' : 'tarot'}`);
        badge.textContent = isSaju ? '\u{1F3EE} 사주 선택' : '\u{1F52E} 타로 선택';
        header.appendChild(badge);
        roundSection.appendChild(header);

        // 친절한 라운드 설명
        const desc = topicDesc[r.topic];
        if (desc) {
          roundSection.appendChild(createEl('p', 'shared-caption', desc));
        }

        if (isSaju) {
          roundSection.appendChild(createEl('p', 'shared-method-note',
            '\u{1F3EE} 사주: 생년월일의 천간/지지를 분석하여 운의 흐름을 읽어줍니다'));
          const readingBox = createEl('div', 'shared-content-box saju-accent');
          (r.sajuReading || '').split('\n').filter(l => l.trim()).forEach(line => {
            readingBox.appendChild(createEl('p', 'shared-content-text', line));
          });
          roundSection.appendChild(readingBox);
        } else {
          roundSection.appendChild(createEl('p', 'shared-method-note',
            '\u{1F52E} 타로: 무의식이 이끄는 카드를 뽑아 현재 에너지를 읽어줍니다'));

          // 타로 카드 이미지
          if (r.tarotCards && r.tarotCards.length > 0) {
            const cardsContainer = createEl('div', 'shared-tarot-cards');
            r.tarotCards.forEach(card => {
              const cardEl = createEl('div', 'shared-tarot-card');
              if (card.image_key) {
                const img = document.createElement('img');
                img.src = `images/tarot/${card.image_key}.jpg`;
                img.alt = card.korean || '';
                img.className = `shared-card-img${card.isReversed ? ' reversed' : ''}`;
                img.loading = 'lazy';
                cardEl.appendChild(img);
              }
              cardEl.appendChild(createEl('div', 'shared-card-name', card.korean || ''));
              if (card.position) {
                cardEl.appendChild(createEl('div', 'shared-card-pos', card.position));
              }
              if (card.direction) {
                cardEl.appendChild(createEl('div', 'shared-card-dir',
                  card.isReversed ? '역방향 (숨겨진 의미)' : '정방향'));
              }
              cardsContainer.appendChild(cardEl);
            });
            roundSection.appendChild(cardsContainer);
          }

          const readingBox = createEl('div', 'shared-content-box tarot-accent');
          (r.tarotReading || '').split('\n').filter(l => l.trim()).forEach(line => {
            readingBox.appendChild(createEl('p', 'shared-content-text', line));
          });
          roundSection.appendChild(readingBox);
        }

        // 투표 결과 설명
        const votedName = isSaju ? '사주' : '타로';
        roundSection.appendChild(createEl('p', 'shared-vote-result',
          `\u{2705} 이 라운드에서는 ${votedName}의 해석에 더 공감했어요`));

        container.appendChild(roundSection);
      });

      // AI 심판 한마디
      if (data.judgment) {
        const judgeDiv = createEl('div', 'shared-judgment');
        judgeDiv.appendChild(createEl('h3', 'shared-section-title', '\u{2696}\u{FE0F} AI 심판의 한마디'));
        judgeDiv.appendChild(createEl('p', 'shared-caption',
          'AI가 양쪽의 해석 품질, 구체성, 논리성을 종합 평가한 최종 판정이에요'));
        judgeDiv.appendChild(createEl('p', 'shared-judgment-text', data.judgment));
        container.appendChild(judgeDiv);
      }

      // CTA + 역대 전적
      const ctaDiv = createEl('div', 'shared-cta');
      ctaDiv.appendChild(createEl('p', 'shared-cta-text', '나도 사주 vs 타로 운명의 대결을 해보고 싶다면?'));
      const ctaBtn = createEl('button', 'btn-primary btn-glow', '나도 해보기');
      ctaBtn.addEventListener('click', () => {
        window.location.href = window.location.href.split('?')[0];
      });
      ctaDiv.appendChild(ctaBtn);

      const statsBtn = createEl('button', 'btn-stats-link', '\u{1F4CA} 역대 전적 보기');
      statsBtn.addEventListener('click', () => {
        showSection('stats');
        StatsManager.loadAndRender($('#stats-content'));
      });
      ctaDiv.appendChild(statsBtn);
      container.appendChild(ctaDiv);
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

    // 통계 페이지
    function openStats() {
      showSection('stats');
      StatsManager.loadAndRender($('#stats-content'));
    }

    const btnStats = $('#btn-stats');
    if (btnStats) btnStats.addEventListener('click', openStats);

    const btnResultStats = $('#btn-result-stats');
    if (btnResultStats) btnResultStats.addEventListener('click', openStats);

    const btnStatsBack = $('#btn-stats-back');
    if (btnStatsBack) {
      btnStatsBack.addEventListener('click', () => showSection('intro'));
    }
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
    loadingCharMsg.classList.remove('fade-in', 'fade-out');
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
    }, 5000);
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

    battleLoading.style.display = 'block';
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

    // 사주 패널 — 명식표 + 분석정보 + AI 해석
    renderSajuChart(sajuChart, roundData.saju.result);
    renderSajuInfo(sajuInfo, roundData.saju.result);
    renderReading(sajuReading, roundData.saju.reading.text);
    sajuReading.closest('.battle-panel').className = 'battle-panel panel-saju panel-slide-left';

    // 타로 패널 — 카드 + 분석정보 + AI 해석
    renderTarotCards(tarotCards, roundData.tarot.draw);
    renderTarotInfo(tarotInfo, roundData.tarot.draw);
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
    battleLoading.style.display = 'block';
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
    scoreRow.appendChild(createEl('span', 'score-saju score-count', `\u{1F3EE} ${result.voteDetail.saju}`));
    scoreRow.appendChild(createEl('span', 'score-vs', ':'));
    scoreRow.appendChild(createEl('span', 'score-tarot score-count', `${result.voteDetail.tarot} \u{1F52E}`));
    resultScore.appendChild(scoreRow);
    const winDetail = result.winner === 'saju' ? '사주' : '타로';
    const detailEl = createEl('div', 'score-detail',
      `3라운드 투표에서 ${winDetail}의 해석이 더 공감을 얻었어요`);
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

    // 공유용 데이터 준비 (사주 명식 + 타로 카드 포함)
    const shareData = {
      winner: result.winner,
      scores: result.scores,
      voteDetail: result.voteDetail,
      birth_info: currentUserData ? `${currentUserData.year}-${currentUserData.month}-${currentUserData.day}-${currentUserData.gender}${currentUserData.hour != null ? `-${currentUserData.hour}-${currentUserData.minute || 0}` : ''}` : '',
      question: currentUserData?.question || '',
      judgment: result.message || result.aiJudgment?.reason || '',
      rounds: (result.rounds || []).map((r, i) => {
        const rd = {
          topic: r.topic,
          vote: r.vote,
          sajuReading: r.saju?.reading?.text || '',
          tarotReading: r.tarot?.reading?.text || '',
          tarotCards: (r.tarot?.draw?.reading || []).map(item => ({
            image_key: item.card?.image_key,
            korean: item.card?.korean || item.card?.name,
            isReversed: !!item.card?.isReversed,
            position: item.position,
            direction: item.direction
          }))
        };
        if (i === 0 && r.saju?.result) {
          rd.sajuPillars = r.saju.result.pillars;
          rd.sajuElements = r.saju.result.elements;
        }
        return rd;
      })
    };

    ShareManager.setResult(shareData);

    // 자동 저장: 공유용 풀 데이터
    ShareManager.getShareUrl().catch(e => console.warn('자동 저장 실패:', e));

    // 통계 저장: 경량 레코드 (카운트 쿼리용)
    BkendClient.saveStat({
      winner: result.winner,
      gender: currentUserData?.gender || '',
      birth_year: currentUserData?.year || 0,
      r1_vote: result.rounds[0]?.vote || '',
      r2_vote: result.rounds[1]?.vote || '',
      r3_vote: result.rounds[2]?.vote || ''
    }).catch(e => console.warn('통계 저장 실패:', e));
  }

  // ===== 리딩 텍스트 렌더 (safe DOM) =====
  function renderReading(container, text) {
    container.textContent = '';
    if (!text) {
      container.appendChild(createEl('p', 'reading-text', '해석을 불러오지 못했습니다.'));
      return;
    }

    // 간단한 마크다운 → DOM 변환
    const lines = text.split('\n');
    let inList = false;
    let listEl = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { container.appendChild(listEl); inList = false; listEl = null; }
        return;
      }

      // 리스트 아이템 (- 또는 * 으로 시작)
      if (/^[-*]\s+/.test(trimmed)) {
        if (!inList) { listEl = createEl('ul', 'reading-list'); inList = true; }
        const li = createEl('li', 'reading-text text-reveal');
        renderInlineMd(li, trimmed.replace(/^[-*]\s+/, ''));
        listEl.appendChild(li);
        return;
      }

      // 리스트 밖이면 리스트 종료
      if (inList) { container.appendChild(listEl); inList = false; listEl = null; }

      // # 제목 레벨
      if (/^###\s+/.test(trimmed)) {
        const h = createEl('h5', 'reading-heading reading-h3 text-reveal');
        renderInlineMd(h, trimmed.replace(/^###\s+/, ''));
        container.appendChild(h);
        return;
      }
      if (/^##\s+/.test(trimmed)) {
        const h = createEl('h4', 'reading-heading reading-h2 text-reveal');
        renderInlineMd(h, trimmed.replace(/^##\s+/, ''));
        container.appendChild(h);
        return;
      }
      if (/^#\s+/.test(trimmed)) {
        const h = createEl('h3', 'reading-heading reading-h1 text-reveal');
        renderInlineMd(h, trimmed.replace(/^#\s+/, ''));
        container.appendChild(h);
        return;
      }

      // 일반 텍스트
      const p = createEl('p', 'reading-text text-reveal');
      renderInlineMd(p, trimmed);
      container.appendChild(p);
    });

    if (inList && listEl) container.appendChild(listEl);
  }

  /** 인라인 마크다운: **볼드** → <strong> (XSS 안전: textContent + DOM 조합) */
  function renderInlineMd(el, text) {
    // **bold** 패턴을 분리하여 안전한 DOM 노드로 변환
    const parts = text.split(/(\*\*.+?\*\*)/g);
    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        el.appendChild(strong);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  // ===== 타로 카드 렌더 (safe DOM + 이미지) =====
  function renderTarotCards(container, drawResult) {
    container.textContent = '';
    if (!drawResult || !drawResult.reading) return;

    const ELEMENT_EMOJI = { '불': '🔥', '물': '💧', '바람': '🌬️', '흙': '🌿' };
    const ELEMENT_CLS = { '불': 'tarot-el-fire', '물': 'tarot-el-water', '바람': 'tarot-el-air', '흙': 'tarot-el-earth' };

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

      // 원소 뱃지
      const cardElement = card.suit_element || card.element || '';
      let elKey = null;
      if (cardElement.includes('불') || cardElement.includes('화성') || cardElement.includes('태양')) elKey = '불';
      else if (cardElement.includes('물') || cardElement.includes('달') || cardElement.includes('해왕')) elKey = '물';
      else if (cardElement.includes('바람') || cardElement.includes('천왕') || cardElement.includes('수성')) elKey = '바람';
      else if (cardElement.includes('흙') || cardElement.includes('토성') || cardElement.includes('금성')) elKey = '흙';
      if (elKey) {
        cardEl.appendChild(createEl('div', 'tarot-element-badge ' + (ELEMENT_CLS[elKey] || ''),
          (ELEMENT_EMOJI[elKey] || '') + ' ' + elKey));
      }

      // 위치/이름/방향 텍스트
      cardEl.appendChild(createEl('div', 'card-position', item.position));
      const nameEl = createEl('div', `card-name ${card.isReversed ? 'reversed' : 'upright'}`,
        card.korean || card.name);
      cardEl.appendChild(nameEl);
      cardEl.appendChild(createEl('div', 'card-direction', item.direction));
      container.appendChild(cardEl);
    });

    // 패턴 요약 바
    if (drawResult.patterns) {
      const patBar = createEl('div', 'tarot-pattern-bar');
      const p = drawResult.patterns;

      // 메이저/마이너 비율
      if (p.majorMinor) {
        patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-major',
          'M' + p.majorMinor.majorCount + ' / m' + p.majorMinor.minorCount));
      }
      // 우세 수트
      if (p.suits && p.suits.dominant && p.suits.dominant.length > 0) {
        p.suits.dominant.forEach(s => {
          patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-suit',
            (ELEMENT_EMOJI[s.element] || '') + ' ' + s.suit + ' ' + s.count + '장'));
        });
      }
      // 부재 원소
      if (p.suits && p.suits.missing && p.suits.missing.length > 0) {
        p.suits.missing.forEach(s => {
          patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-missing',
            '⊘ ' + s.suit));
        });
      }
      // 코트 카드
      if (p.courtCards && p.courtCards.length > 0) {
        patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-court',
          '👑 인물 ' + p.courtCards.length + '장'));
      }
      container.appendChild(patBar);
    }
  }

  // ===== 사주 명식표 렌더링 =====
  const ELEMENT_CLASS = { '목': 'wood', '화': 'fire', '토': 'earth', '금': 'metal', '수': 'water' };

  function renderSajuChart(container, sajuResult) {
    container.textContent = '';
    if (!sajuResult || !sajuResult.pillars) return;

    const { pillars, tenGods, dayMaster, twelveStages, twelveSinsal, jijangganDetail } = sajuResult;
    const cols = [
      { label: '시주', key: 'hour', pos: '시' },
      { label: '일주', key: 'day', pos: '일' },
      { label: '월주', key: 'month', pos: '월' },
      { label: '년주', key: 'year', pos: '년' }
    ];
    const posMap = { hour: '시', day: '일', month: '월', year: '년' };
    const yySymbol = { '양': '+', '음': '−' };
    const CYY = SajuEngine.CHEONGAN_YINYANG || {};
    const JYY = SajuEngine.JIJI_YINYANG || {};

    const table = document.createElement('div');
    table.className = 'saju-table';

    // === 헤더: 라벨 행 ===
    const labelRow = createEl('div', 'saju-row saju-row-label');
    cols.forEach(col => {
      labelRow.appendChild(createEl('div', 'saju-cell saju-cell-label', col.label));
    });
    table.appendChild(labelRow);

    // === 천간 십성 행 ===
    const stemTenGodRow = createEl('div', 'saju-row saju-row-sub');
    cols.forEach(col => {
      const p = pillars[col.key];
      let text = '';
      if (col.key === 'day') {
        text = '일원';
      } else if (p && tenGods) {
        const posName = posMap[col.key] + '간';
        const entry = tenGods.find(t => t.position === posName);
        text = entry ? entry.tenGod : '';
      }
      stemTenGodRow.appendChild(createEl('div', 'saju-cell saju-cell-sub', text || '–'));
    });
    table.appendChild(stemTenGodRow);

    // === 천간 행 (큰 한자 + 음양) ===
    const stemRow = createEl('div', 'saju-row saju-row-stem');
    cols.forEach(col => {
      const p = pillars[col.key];
      const cell = createEl('div', 'saju-cell saju-cell-hanja');
      if (p) {
        cell.classList.add('el-' + (ELEMENT_CLASS[getElementForStem(p.cheongan)] || ''));
        const yy = CYY[p.cheongan] || '';
        cell.appendChild(createEl('span', 'hanja-big', p.cheongan));
        cell.appendChild(createEl('span', 'yinyang-mark', yySymbol[yy] || ''));
      } else {
        cell.appendChild(createEl('span', 'hanja-big hanja-empty', '?'));
      }
      stemRow.appendChild(cell);
    });
    table.appendChild(stemRow);

    // === 지지 행 (큰 한자 + 음양) ===
    const branchRow = createEl('div', 'saju-row saju-row-branch');
    cols.forEach(col => {
      const p = pillars[col.key];
      const cell = createEl('div', 'saju-cell saju-cell-hanja');
      if (p) {
        cell.classList.add('el-' + (ELEMENT_CLASS[getElementForBranch(p.jiji)] || ''));
        const yy = JYY[p.jiji] || '';
        cell.appendChild(createEl('span', 'hanja-big', p.jiji));
        cell.appendChild(createEl('span', 'yinyang-mark', yySymbol[yy] || ''));
      } else {
        cell.appendChild(createEl('span', 'hanja-big hanja-empty', '?'));
      }
      branchRow.appendChild(cell);
    });
    table.appendChild(branchRow);

    // === 지지 십성 행 ===
    const branchTenGodRow = createEl('div', 'saju-row saju-row-sub');
    cols.forEach(col => {
      const p = pillars[col.key];
      let text = '';
      if (p && tenGods) {
        const posName = posMap[col.key] + '지';
        const entry = tenGods.find(t => t.position === posName);
        text = entry ? entry.tenGod : '';
      }
      branchTenGodRow.appendChild(createEl('div', 'saju-cell saju-cell-sub', text || '–'));
    });
    table.appendChild(branchTenGodRow);

    // === 지장간 행 ===
    const jijangRow = createEl('div', 'saju-row saju-row-sub');
    cols.forEach(col => {
      const p = pillars[col.key];
      let text = '';
      if (p && jijangganDetail) {
        const posName = posMap[col.key] + '지';
        const entry = jijangganDetail.find(j => j.position === posName);
        text = entry ? entry.stems.join(' ') : '';
      }
      jijangRow.appendChild(createEl('div', 'saju-cell saju-cell-sub saju-cell-jijang', text || '–'));
    });
    table.appendChild(jijangRow);

    // === 12운성 행 ===
    const stageRow = createEl('div', 'saju-row saju-row-sub');
    cols.forEach(col => {
      const p = pillars[col.key];
      let text = '';
      if (p && twelveStages) {
        const posName = posMap[col.key] + '지';
        const entry = twelveStages.find(s => s.position === posName);
        text = entry ? entry.stage : '';
      }
      stageRow.appendChild(createEl('div', 'saju-cell saju-cell-sub', text || '–'));
    });
    table.appendChild(stageRow);

    // === 12신살 행 ===
    const sinsalRow = createEl('div', 'saju-row saju-row-sub');
    cols.forEach(col => {
      let text = '';
      if (twelveSinsal && twelveSinsal[col.key]) {
        text = twelveSinsal[col.key];
      }
      sinsalRow.appendChild(createEl('div', 'saju-cell saju-cell-sub', text || '–'));
    });
    table.appendChild(sinsalRow);

    // === 행 라벨 (좌측 legend) ===
    const rowLabels = ['', '천간십성', '천간', '지지', '지지십성', '지장간', '12운성', '12신살'];
    const rows = table.querySelectorAll('.saju-row');
    rows.forEach((row, i) => {
      const lbl = createEl('div', 'saju-cell saju-cell-rowlabel', rowLabels[i] || '');
      row.insertBefore(lbl, row.firstChild);
    });

    container.appendChild(table);

    // === 오행 분포 바 ===
    if (sajuResult.elements) {
      const barWrap = createEl('div', 'saju-element-bar');
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

    // === 오행 색상 범례 ===
    const legend = createEl('div', 'saju-legend');
    const legendItems = [
      { cls: 'el-wood', label: '木 목(나무)' },
      { cls: 'el-fire', label: '火 화(불)' },
      { cls: 'el-earth', label: '土 토(흙)' },
      { cls: 'el-metal', label: '金 금(쇠)' },
      { cls: 'el-water', label: '水 수(물)' }
    ];
    legendItems.forEach(item => {
      const span = createEl('span', 'saju-legend-item ' + item.cls, item.label);
      legend.appendChild(span);
    });
    const yyLegend = createEl('span', 'saju-legend-yy', '+ 양 / − 음');
    legend.appendChild(yyLegend);
    container.appendChild(legend);
  }

  // 오행 매핑 헬퍼
  const STEM_ELEMENT = { '甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수' };
  const BRANCH_ELEMENT = { '子':'수','丑':'토','寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토','申':'금','酉':'금','戌':'토','亥':'수' };
  function getElementForStem(char) { return STEM_ELEMENT[char] || ''; }
  function getElementForBranch(char) { return BRANCH_ELEMENT[char] || ''; }

  // ===== 사주 분석 정보 패널 =====
  function renderSajuInfo(container, sajuResult) {
    container.textContent = '';
    if (!sajuResult) return;

    const wrap = createEl('div', 'info-panel');

    // 신강/신약
    if (sajuResult.strength) {
      const s = sajuResult.strength;
      const tag = createEl('div', 'info-tag info-tag-strength');
      tag.appendChild(createEl('span', 'info-tag-label', '신강/신약'));
      tag.appendChild(createEl('span', 'info-tag-value', s.result + ' (' + s.score + '점)'));
      wrap.appendChild(tag);
    }

    // 일간
    if (sajuResult.dayMasterInfo) {
      const dm = sajuResult.dayMasterInfo;
      const el = sajuResult.dayMasterElement || '';
      const yy = sajuResult.dayMasterYinYang || '';
      const tag = createEl('div', 'info-tag');
      tag.appendChild(createEl('span', 'info-tag-label', '일간'));
      tag.appendChild(createEl('span', 'info-tag-value',
        sajuResult.dayMaster + ' ' + (dm.korean || '') + ' (' + el + '/' + yy + ')'));
      wrap.appendChild(tag);
    }

    // 충
    if (sajuResult.chung && sajuResult.chung.length > 0) {
      const tag = createEl('div', 'info-tag info-tag-warn');
      tag.appendChild(createEl('span', 'info-tag-label', '충(冲)'));
      tag.appendChild(createEl('span', 'info-tag-value',
        sajuResult.chung.map(c => c.pair + ' ' + c.type).join(', ')));
      wrap.appendChild(tag);
    }

    // 합
    if (sajuResult.hap && sajuResult.hap.length > 0) {
      const tag = createEl('div', 'info-tag info-tag-good');
      tag.appendChild(createEl('span', 'info-tag-label', '합(合)'));
      tag.appendChild(createEl('span', 'info-tag-value',
        sajuResult.hap.map(h => h.pair + ' ' + h.type).join(', ')));
      wrap.appendChild(tag);
    }

    // 특수 신살
    if (sajuResult.specialStars && sajuResult.specialStars.length > 0) {
      const tag = createEl('div', 'info-tag');
      tag.appendChild(createEl('span', 'info-tag-label', '특수살'));
      tag.appendChild(createEl('span', 'info-tag-value',
        sajuResult.specialStars.map(s => s.name).join(', ')));
      wrap.appendChild(tag);
    }

    // 세운
    if (sajuResult.seun) {
      const se = sajuResult.seun;
      const tag = createEl('div', 'info-tag');
      tag.appendChild(createEl('span', 'info-tag-label', se.year + '세운'));
      tag.appendChild(createEl('span', 'info-tag-value',
        se.stem + se.branch + ' (' + se.stemTenGod + '/' + se.branchTenGod + ')'));
      wrap.appendChild(tag);
    }

    // 대운
    if (sajuResult.daeun && sajuResult.daeun.current) {
      const d = sajuResult.daeun.current;
      const tag = createEl('div', 'info-tag');
      tag.appendChild(createEl('span', 'info-tag-label', '현재 대운'));
      tag.appendChild(createEl('span', 'info-tag-value',
        d.stem + d.branch + ' (' + d.startAge + '~' + (d.startAge + 9) + '세)'));
      wrap.appendChild(tag);
    }

    container.appendChild(wrap);
  }

  // ===== 타로 분석 정보 패널 =====
  function renderTarotInfo(container, drawResult) {
    container.textContent = '';
    if (!drawResult || !drawResult.patterns) return;

    const wrap = createEl('div', 'info-panel');
    const p = drawResult.patterns;

    // 원소 상성 (Elemental Dignity)
    if (p.elementalDignity && p.elementalDignity.length > 0) {
      p.elementalDignity.forEach(ed => {
        const tag = createEl('div', 'info-tag');
        tag.appendChild(createEl('span', 'info-tag-label', '원소상성'));
        tag.appendChild(createEl('span', 'info-tag-value',
          ed.card1 + '(' + ed.element1 + ') ↔ ' + ed.card2 + '(' + ed.element2 + '): ' + ed.description));
        wrap.appendChild(tag);
      });
    }

    // 숫자 패턴
    if (p.numbers && p.numbers.length > 0) {
      const tag = createEl('div', 'info-tag');
      tag.appendChild(createEl('span', 'info-tag-label', '숫자패턴'));
      tag.appendChild(createEl('span', 'info-tag-value',
        p.numbers.map(n => n.message).join(' / ')));
      wrap.appendChild(tag);
    }

    // 퀸테센스 (buildSummary에서 계산하므로 여기서 직접 계산)
    if (drawResult.reading) {
      const QUINT_NAMES = ['바보','마법사','여사제','여황제','황제','교황','연인','전차','힘','은둔자','운명의수레바퀴','정의','매달린사람','죽음','절제','악마','탑','별','달','태양','심판','세계'];
      let quintSum = drawResult.reading.reduce((sum, item) => {
        const c = item.card;
        if (c.id < 22) return sum + c.id;
        const courtVal = { page: 11, knight: 12, queen: 13, king: 14 };
        return sum + (courtVal[c.rank] || c.number || 0);
      }, 0);
      while (quintSum > 21) quintSum = String(quintSum).split('').reduce((a, d) => a + Number(d), 0);
      const tag = createEl('div', 'info-tag info-tag-good');
      tag.appendChild(createEl('span', 'info-tag-label', '퀸테센스'));
      tag.appendChild(createEl('span', 'info-tag-value',
        (QUINT_NAMES[quintSum] || quintSum) + '(' + quintSum + '번) — 이 리딩의 숨겨진 본질'));
      wrap.appendChild(tag);
    }

    container.appendChild(wrap);
  }

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
