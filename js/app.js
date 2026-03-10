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

  // 주제 선택
  const topicChipsContainer = $('#topic-chips');
  const topicError = $('#topic-error');
  const topicQuestionsWrap = $('#topic-questions');
  const topicQuestionFields = $('#topic-question-fields');

  // 상태
  let selectedGender = null;
  let noTimeSelected = false;
  let calendarType = 'solar';    // U1: 'solar' | 'lunar'
  let isLeapMonth = false;       // U1: 윤달 여부
  let currentUserData = null;    // 공유용 사용자 데이터 보존
  let selectedTopics = [];       // [{id, name, emoji, placeholder}, ...]

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

  // ===== 주제 선택 =====
  function renderTopicChips() {
    topicChipsContainer.textContent = '';
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
      topicChipsContainer.appendChild(chip);

      if (defaultIds.includes(t.id)) {
        toggleTopic(t, chip);
      }
    });
  }

  function toggleTopic(topic, chipEl) {
    const idx = selectedTopics.findIndex(t => t.id === topic.id);
    if (idx >= 0) {
      selectedTopics.splice(idx, 1);
      chipEl.classList.remove('selected');
      topicError.style.display = 'none';
    } else {
      if (selectedTopics.length >= 3) {
        topicError.textContent = '3개까지만 선택할 수 있어요! 먼저 하나를 해제하세요.';
        topicError.style.display = '';
        return;
      }
      selectedTopics.push(topic);
      chipEl.classList.add('selected');
      topicError.style.display = 'none';
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

  function updateTopicQuestions() {
    // 기존 입력값 보존
    const savedValues = {};
    topicQuestionFields.querySelectorAll('.topic-q-input').forEach(input => {
      if (input.value) savedValues[input.dataset.topicId] = input.value;
    });

    topicQuestionFields.textContent = '';

    if (selectedTopics.length === 0) {
      topicQuestionsWrap.style.display = 'none';
      return;
    }

    topicQuestionsWrap.style.display = '';
    selectedTopics.forEach(t => {
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
      if (savedValues[t.id]) input.value = savedValues[t.id];
      field.appendChild(input);
      topicQuestionFields.appendChild(field);
    });
  }

  // ===== 초기화 =====
  async function initialize() {
    populateSelects();
    renderTopicChips();
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

      // 사주 분석 (풀 데이터 또는 레거시 호환)
      const rounds = data.rounds || [];
      const sajuRes = data.sajuResult || (rounds[0]?.sajuPillars ? { pillars: rounds[0].sajuPillars, elements: rounds[0].sajuElements } : null);
      if (sajuRes && sajuRes.pillars) {
        const chartSection = createEl('div', 'shared-saju-section');
        chartSection.appendChild(createEl('h3', 'shared-section-title', '\u{1F3EE} 사주 명식'));
        chartSection.appendChild(createEl('p', 'shared-caption',
          '생년월일을 기반으로 계산한 사주팔자입니다. 네 기둥(년/월/일/시)의 한자가 타고난 운명을 나타내요'));
        const chartContainer = createEl('div', 'saju-chart');
        renderSajuChart(chartContainer, sajuRes);
        chartSection.appendChild(chartContainer);

        // 사주 분석 정보 패널 (풀 데이터일 때만)
        if (sajuRes.dayMaster) {
          const infoContainer = createEl('div', 'saju-info');
          renderSajuInfo(infoContainer, sajuRes);
          chartSection.appendChild(infoContainer);
        }

        // 오행 생극 관계도
        if (sajuRes.dayMasterElement && sajuRes.elements) {
          chartSection.appendChild(renderOhangGraph(sajuRes.dayMasterElement, sajuRes.elements));
        }

        container.appendChild(chartSection);
      }

      // 선택된 주제 표시
      const sharedTopics = data.topics || ['연애운', '재물운', '종합운세'];
      if (sharedTopics.length > 0) {
        const topicBadge = createEl('div', 'shared-topics-badge',
          sharedTopics.map(t => {
            const def = (window.__TOPICS__ || []).find(d => d.name === t);
            return def ? `${def.emoji} ${def.name}` : t;
          }).join('  '));
        container.appendChild(topicBadge);
      }

      // 라운드별 설명 텍스트
      const topicDesc = {
        '연애운': '사랑과 인간관계에 대한 운세를 동양과 서양이 각각 풀이했어요',
        '재물운': '돈과 재물에 관한 흐름을 두 관점에서 비교했어요',
        '종합운세': '올해의 전체적인 운세를 종합적으로 판단했어요',
        '직업운': '커리어와 직업적 발전을 두 관점에서 분석했어요',
        '건강운': '건강과 에너지 밸런스를 동양과 서양이 각각 풀이했어요',
        '학업운': '학업과 시험 운세를 두 관점에서 비교했어요',
        '대인관계': '사회적 관계와 인연을 동양과 서양이 각각 풀이했어요'
      };

      // 라운드별 — 양쪽 모두 표시
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

        const desc = topicDesc[r.topic];
        if (desc) {
          roundSection.appendChild(createEl('p', 'shared-caption', desc));
        }

        // 사주 풀이 (항상 표시, 비선택 시 dimmed)
        if (r.sajuReading) {
          const sajuWrap = createEl('div', `shared-reading-wrap${isSaju ? '' : ' dimmed'}`);
          sajuWrap.appendChild(createEl('p', 'shared-method-note',
            '\u{1F3EE} 사주명인의 풀이'));
          const sajuBox = createEl('div', 'shared-content-box saju-accent');
          renderReading(sajuBox, r.sajuReading);
          sajuWrap.appendChild(sajuBox);
          roundSection.appendChild(sajuWrap);
        }

        // 타로 카드 + 풀이 (항상 표시, 비선택 시 dimmed)
        const tarotWrap = createEl('div', `shared-reading-wrap${!isSaju ? '' : ' dimmed'}`);
        if (r.tarotCards && r.tarotCards.length > 0) {
          tarotWrap.appendChild(createEl('p', 'shared-method-note',
            '\u{1F52E} 타로할머니의 풀이'));

          const ELEM_EMOJI = { '불': '\u{1F525}', '물': '\u{1F4A7}', '바람': '\u{1F32C}\u{FE0F}', '흙': '\u{1F33F}' };
          const ELEM_CLS = { '불': 'tarot-el-fire', '물': 'tarot-el-water', '바람': 'tarot-el-air', '흙': 'tarot-el-earth' };

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
            // 원소 뱃지
            const cardElem = card.suit_element || card.element || '';
            let elKey = null;
            if (cardElem.includes('불') || cardElem.includes('화성') || cardElem.includes('태양')) elKey = '불';
            else if (cardElem.includes('물') || cardElem.includes('달') || cardElem.includes('해왕')) elKey = '물';
            else if (cardElem.includes('바람') || cardElem.includes('천왕') || cardElem.includes('수성')) elKey = '바람';
            else if (cardElem.includes('흙') || cardElem.includes('토성') || cardElem.includes('금성')) elKey = '흙';
            if (elKey) {
              cardEl.appendChild(createEl('div', 'tarot-element-badge ' + (ELEM_CLS[elKey] || ''),
                (ELEM_EMOJI[elKey] || '') + ' ' + elKey));
            }
            cardEl.appendChild(createEl('div', 'shared-card-name', card.korean || ''));
            if (card.position) cardEl.appendChild(createEl('div', 'shared-card-pos', card.position));
            if (card.direction) {
              cardEl.appendChild(createEl('div', 'shared-card-dir',
                card.isReversed ? '역방향' : '정방향'));
            }
            cardsContainer.appendChild(cardEl);
          });
          tarotWrap.appendChild(cardsContainer);

          // 타로 패턴 요약 바
          if (r.tarotPatterns) {
            const patBar = createEl('div', 'tarot-pattern-bar');
            const p = r.tarotPatterns;
            if (p.majorMinor) {
              patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-major',
                '메이저 ' + p.majorMinor.majorCount + ' / 마이너 ' + p.majorMinor.minorCount));
            }
            if (p.suits && p.suits.dominant) {
              p.suits.dominant.forEach(s => {
                patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-suit',
                  (ELEM_EMOJI[s.element] || '') + ' ' + (s.suitKorean || s.suit) + ' ' + s.count + '장'));
              });
            }
            if (p.courtCards && p.courtCards.length > 0) {
              patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-court',
                '\u{1F451} 인물 ' + p.courtCards.length + '장'));
            }
            tarotWrap.appendChild(patBar);
          }
        }

        if (r.tarotReading) {
          const tarotBox = createEl('div', 'shared-content-box tarot-accent');
          renderReading(tarotBox, r.tarotReading);
          tarotWrap.appendChild(tarotBox);
        }
        roundSection.appendChild(tarotWrap);

        // 투표 결과
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
    const isValid = inputYear.value && inputMonth.value && inputDay.value
      && selectedGender && selectedTopics.length === 3;
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

    // 주제별 질문 수집
    const topicNames = selectedTopics.map(t => t.name);
    const topicQuestions = {};
    $$('.topic-q-input').forEach(input => {
      const val = input.value.trim();
      if (val) {
        const t = selectedTopics.find(s => s.id === input.dataset.topicId);
        if (t) topicQuestions[t.name] = val;
      }
    });

    const userData = {
      year,
      month,
      day,
      gender: selectedGender,
      hour: noTimeSelected ? null : (inputHour.value ? parseInt(inputHour.value) : null),
      minute: noTimeSelected ? null : (inputMinute.value ? parseInt(inputMinute.value) : null),
      topics: topicNames,
      questions: topicQuestions
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
    roundTopic.textContent = BattleEngine.getTopics()[nextRound - 1];

    $$('.progress-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === nextRound - 1);
      dot.classList.toggle('done', i < status.currentRound);
    });

    battleLoading.style.display = 'block';
    battlePanels.style.display = 'none';
    battleVote.style.display = 'none';

    // 라운드 로딩 시 정적 텍스트 숨기고 캐릭터 멘트만 표시
    $('.loading-text').style.display = 'none';

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
    renderTarotInfo(tarotInfo, roundData.tarot.draw, currentUserData);
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
    stopLoadingMessages();
    const loadingText = $('.loading-text');
    loadingText.textContent = '최종 판정 중...';
    loadingText.style.display = '';

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

    // 사주 명식 (만세력) — 기존 섹션 제거 후 렌더
    const existingSajuSection = document.querySelector('.result-saju-section');
    if (existingSajuSection) existingSajuSection.remove();
    const finalSajuRes = result.rounds[0]?.saju?.result;
    if (finalSajuRes && finalSajuRes.pillars) {
      const sajuSection = createEl('div', 'result-saju-section');
      sajuSection.appendChild(createEl('h3', 'result-section-title', '\u{1F3EE} 사주 명식'));
      const chartContainer = createEl('div', 'saju-chart');
      renderSajuChart(chartContainer, finalSajuRes);
      sajuSection.appendChild(chartContainer);
      if (finalSajuRes.dayMaster) {
        const infoContainer = createEl('div', 'saju-info');
        renderSajuInfo(infoContainer, finalSajuRes);
        sajuSection.appendChild(infoContainer);
      }
      if (finalSajuRes.dayMasterElement && finalSajuRes.elements) {
        sajuSection.appendChild(renderOhangGraph(finalSajuRes.dayMasterElement, finalSajuRes.elements));
      }
      resultRounds.parentNode.insertBefore(sajuSection, resultRounds);
    }

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

    // 공유용 데이터 준비 (사주 풀 분석 + 타로 카드/패턴 포함)
    const sajuRes = result.rounds[0]?.saju?.result;
    const shareData = {
      winner: result.winner,
      scores: result.scores,
      voteDetail: result.voteDetail,
      birth_info: currentUserData ? `${currentUserData.year}-${currentUserData.month}-${currentUserData.day}-${currentUserData.gender}${currentUserData.hour != null ? `-${currentUserData.hour}-${currentUserData.minute || 0}` : ''}` : '',
      question: '',
      topics: result.topics || currentUserData?.topics || [],
      questions: currentUserData?.questions || {},
      judgment: result.message || result.aiJudgment?.reason || '',
      // 사주 분석 결과 (1회만 — 전 라운드 공통)
      sajuResult: sajuRes ? {
        pillars: sajuRes.pillars,
        elements: sajuRes.elements,
        dayMaster: sajuRes.dayMaster,
        dayMasterElement: sajuRes.dayMasterElement,
        dayMasterYinYang: sajuRes.dayMasterYinYang,
        dayMasterInfo: sajuRes.dayMasterInfo,
        strength: sajuRes.strength,
        tenGods: sajuRes.tenGods,
        tenGodStats: sajuRes.tenGodStats,
        twelveStages: sajuRes.twelveStages,
        twelveSinsal: sajuRes.twelveSinsal,
        jijangganDetail: sajuRes.jijangganDetail,
        specialStars: sajuRes.specialStars,
        chung: sajuRes.chung,
        hap: sajuRes.hap,
        seun: sajuRes.seun,
        daeun: sajuRes.daeun
      } : null,
      rounds: (result.rounds || []).map((r) => ({
        topic: r.topic,
        vote: r.vote,
        sajuReading: r.saju?.reading?.text || '',
        tarotReading: r.tarot?.reading?.text || '',
        tarotCards: (r.tarot?.draw?.reading || []).map(item => ({
          image_key: item.card?.image_key,
          korean: item.card?.korean || item.card?.name,
          isReversed: !!item.card?.isReversed,
          position: item.position,
          direction: item.direction,
          id: item.card?.id,
          suit: item.card?.suit,
          suit_korean: item.card?.suit_korean,
          suit_element: item.card?.suit_element,
          element: item.card?.element,
          rank: item.card?.rank
        })),
        tarotPatterns: r.tarot?.draw?.patterns || null
      }))
    };

    ShareManager.setResult(shareData);

    // 자동 저장: 공유용 풀 데이터
    ShareManager.getShareUrl().catch(e => console.warn('자동 저장 실패:', e));

    // 통계 저장: 경량 레코드 (카운트 쿼리용)
    const battleTopics = result.topics || currentUserData?.topics || [];
    const topicVotes = {};
    (result.rounds || []).forEach(r => {
      if (r.topic && r.vote) topicVotes[r.topic] = r.vote;
    });
    BkendClient.saveStat({
      winner: result.winner,
      gender: currentUserData?.gender || '',
      birth_year: currentUserData?.year || 0,
      r1_vote: result.rounds[0]?.vote || '',
      r2_vote: result.rounds[1]?.vote || '',
      r3_vote: result.rounds[2]?.vote || '',
      topics: battleTopics,
      topic_votes: topicVotes
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
          '메이저 ' + p.majorMinor.majorCount + ' / 마이너 ' + p.majorMinor.minorCount));
      }
      // 우세 수트
      if (p.suits && p.suits.dominant && p.suits.dominant.length > 0) {
        p.suits.dominant.forEach(s => {
          patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-suit',
            (ELEMENT_EMOJI[s.element] || '') + ' ' + (s.suitKorean || s.suit) + ' ' + s.count + '장'));
        });
      }
      // 부재 원소
      if (p.suits && p.suits.missing && p.suits.missing.length > 0) {
        p.suits.missing.forEach(s => {
          patBar.appendChild(createEl('span', 'tarot-pat-badge tarot-pat-missing',
            '⊘ ' + s.element));
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

    // 일간 + 신강/신약 + 격국
    const topRow = createEl('div', 'info-row');
    if (sajuResult.dayMasterInfo) {
      const el = sajuResult.dayMasterElement || '';
      const yy = sajuResult.dayMasterYinYang || '';
      addTag(topRow, '일간', sajuResult.dayMaster + ' (' + el + '/' + yy + ')');
    }
    if (sajuResult.strength) {
      addTag(topRow, '체질', sajuResult.strength, 'info-tag-strength');
    }
    if (sajuResult.tenGodStats && sajuResult.tenGodStats.geukguk) {
      addTag(topRow, '격국', sajuResult.tenGodStats.geukguk.description);
    }
    wrap.appendChild(topRow);

    // 십성 분포
    if (sajuResult.tenGodStats) {
      const tRow = createEl('div', 'info-row');
      const gs = sajuResult.tenGodStats.groups;
      Object.entries(gs).forEach(([name, count]) => {
        const cls = count === 0 ? 'info-tag-dim' : (count >= 3 ? 'info-tag-hot' : '');
        addTag(tRow, name.split('(')[0], count + '개', cls);
      });
      wrap.appendChild(tRow);
    }

    // 신살 — 길성(귀인/록)
    if (sajuResult.specialStars && sajuResult.specialStars.length > 0) {
      const guiin = sajuResult.specialStars.filter(s => s.type === '귀인' || s.type === '록');
      const sal = sajuResult.specialStars.filter(s => s.type === '살');
      if (guiin.length > 0) {
        const gRow = createEl('div', 'info-row');
        guiin.forEach(s => addTag(gRow, s.name, s.meaning, 'info-tag-good'));
        wrap.appendChild(gRow);
      }
      if (sal.length > 0) {
        const sRow = createEl('div', 'info-row');
        sal.forEach(s => addTag(sRow, s.name, s.meaning, 'info-tag-warn'));
        wrap.appendChild(sRow);
      }
    }

    // 충/합
    const chRow = createEl('div', 'info-row');
    if (sajuResult.chung && sajuResult.chung.length > 0) {
      sajuResult.chung.forEach(c => addTag(chRow, '충', c.pair, 'info-tag-warn'));
    }
    if (sajuResult.hap) {
      const allHap = [
        ...(sajuResult.hap.yukhap || []).map(h => h.pair + '→' + h.element),
        ...(sajuResult.hap.samhap || []).map(h => h.branches.join('')),
        ...(sajuResult.hap.banhap || []).map(h => h.branches.join(''))
      ];
      allHap.forEach(h => addTag(chRow, '합', h, 'info-tag-good'));
    }
    if (chRow.childNodes.length > 0) wrap.appendChild(chRow);

    // 세운 + 대운
    const uRow = createEl('div', 'info-row');
    if (sajuResult.seun) {
      const se = sajuResult.seun;
      addTag(uRow, se.year + '세운', se.stem + se.branch + ' (' + se.stemTenGod + '/' + se.branchTenGod + ')');
    }
    if (sajuResult.daeun && sajuResult.daeun.current) {
      const d = sajuResult.daeun.current;
      addTag(uRow, '현재대운', d.stem + d.branch + ' (' + d.ageStart + '~' + d.ageEnd + '세)');
    }
    wrap.appendChild(uRow);

    container.appendChild(wrap);

    // 오행 생극 관계도 (SVG)
    if (sajuResult.dayMasterElement) {
      container.appendChild(renderOhangGraph(sajuResult.dayMasterElement, sajuResult.elements));
    }
  }

  function addTag(parent, label, value, cls) {
    const tag = createEl('div', 'info-tag ' + (cls || ''));
    tag.appendChild(createEl('span', 'info-tag-label', label));
    tag.appendChild(createEl('span', 'info-tag-value', String(value)));
    parent.appendChild(tag);
  }

  // 오행 생극 관계도 SVG
  function renderOhangGraph(myElement, elements) {
    const size = 240;
    const cx = size / 2, cy = size / 2, r = 80;
    const ohang = ['목', '화', '토', '금', '수'];
    const ohangHanja = { '목': '木', '화': '火', '토': '土', '금': '金', '수': '水' };
    const colors = { '목': '#81c784', '화': '#ef9a9a', '토': '#ffd54f', '금': '#e0e0e0', '수': '#90caf9' };
    const sangSaeng = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
    const sangGeuk = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };

    // 오각형 좌표 (상단부터 시계방향: 화-토-금-수-목)
    // 전통 배치: 상=화, 우하=토, 우상=금... → 별모양
    const order = ['화', '토', '금', '수', '목'];
    const pos = {};
    order.forEach((el, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
      pos[el] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });

    let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="ohang-svg">';

    // 상생 화살표 (원형, 얇은 선)
    ohang.forEach(el => {
      const from = pos[el], to = pos[sangSaeng[el]];
      svg += '<line x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '" stroke="#555" stroke-width="1.2" stroke-dasharray="4,3"/>';
    });

    // 상극 화살표 (별모양, 빨간 점선)
    ohang.forEach(el => {
      const from = pos[el], to = pos[sangGeuk[el]];
      if (el === myElement) {
        svg += '<line x1="' + from.x + '" y1="' + from.y + '" x2="' + to.x + '" y2="' + to.y + '" stroke="rgba(244,67,54,0.5)" stroke-width="1.5" stroke-dasharray="3,3"/>';
      }
    });

    // 노드
    ohang.forEach(el => {
      const p = pos[el];
      const isMe = el === myElement;
      const count = elements ? (elements[el] || 0) : 0;
      const nodeR = isMe ? 26 : 18 + Math.min(count, 4) * 2;
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + nodeR + '" fill="' + colors[el] + '" opacity="' + (isMe ? '0.9' : '0.5') + '" stroke="' + (isMe ? '#fff' : 'none') + '" stroke-width="' + (isMe ? '2.5' : '0') + '"/>';
      svg += '<text x="' + p.x + '" y="' + (p.y + 1) + '" text-anchor="middle" dominant-baseline="central" fill="#000" font-size="' + (isMe ? '16' : '13') + '" font-weight="' + (isMe ? '900' : '600') + '">' + ohangHanja[el] + '</text>';
      // 개수 표시
      if (count > 0) {
        svg += '<text x="' + p.x + '" y="' + (p.y + (isMe ? 17 : 14)) + '" text-anchor="middle" fill="' + colors[el] + '" font-size="10">' + count + '</text>';
      }
    });

    // 범례
    svg += '<text x="' + cx + '" y="' + (size - 6) + '" text-anchor="middle" fill="#888" font-size="10">── 상생  - - 상극(나→)</text>';

    svg += '</svg>';

    const div = createEl('div', 'ohang-graph');
    div.innerHTML = svg; // SVG는 안전 (하드코딩된 값만 사용)
    return div;
  }

  // ===== 타로 분석 정보 패널 =====
  function renderTarotInfo(container, drawResult, userData) {
    container.textContent = '';
    if (!drawResult || !drawResult.patterns) return;

    const wrap = createEl('div', 'info-panel');
    const p = drawResult.patterns;

    // T7: 탄생 카드 (사주의 일간에 해당)
    const adv = (typeof TarotEngine.analyzeAdvanced === 'function' && userData)
      ? TarotEngine.analyzeAdvanced(drawResult, userData.year, userData.month, userData.day)
      : null;

    if (adv && adv.birthCard) {
      const topRow = createEl('div', 'info-row');
      addTag(topRow, '탄생카드', adv.birthCard.description, 'info-tag-strength');
      wrap.appendChild(topRow);
    }

    // 메이저/마이너 비율
    if (p.majorMinor) {
      const mmRow = createEl('div', 'info-row');
      addTag(mmRow, '메이저/마이너', 'M' + p.majorMinor.majorCount + ' / m' + p.majorMinor.minorCount);
      addTag(mmRow, '해석', p.majorMinor.message);
      wrap.appendChild(mmRow);
    }

    // 수트 에너지 분포 (사주의 오행 분포에 해당)
    if (p.suits) {
      const suitRow = createEl('div', 'info-row');
      if (p.suits.dominant && p.suits.dominant.length > 0) {
        p.suits.dominant.forEach(s => {
          addTag(suitRow, s.element, (s.suitKorean || s.suit) + ' ' + s.count + '장', 'info-tag-hot');
        });
      }
      if (p.suits.missing && p.suits.missing.length > 0) {
        p.suits.missing.forEach(s => {
          addTag(suitRow, s.element + '부재', '에너지 약함', 'info-tag-dim');
        });
      }
      if (suitRow.childNodes.length > 0) wrap.appendChild(suitRow);
    }

    // 원소 상성 (Elemental Dignity)
    if (p.elementalDignity && p.elementalDignity.length > 0) {
      const edRow = createEl('div', 'info-row');
      p.elementalDignity.forEach(ed => {
        const cls = ed.relation === 'friendly' ? 'info-tag-good'
          : ed.relation === 'hostile' ? 'info-tag-warn' : '';
        addTag(edRow, ed.card1 + '↔' + ed.card2, ed.element1 + '/' + ed.element2 + ' ' + ed.description, cls);
      });
      wrap.appendChild(edRow);
    }

    // T8: 점성술 대응
    if (adv && adv.astroLinks && adv.astroLinks.length > 0) {
      const astRow = createEl('div', 'info-row');
      adv.astroLinks.forEach(a => {
        addTag(astRow, a.card, a.astro + '(' + a.type + ') — ' + a.meaning);
      });
      wrap.appendChild(astRow);
    }

    // T9: 역방향 심화
    if (adv && adv.reversals && adv.reversals.length > 0) {
      const revRow = createEl('div', 'info-row');
      adv.reversals.forEach(r => {
        addTag(revRow, r.card + '(역)', r.analysis.desc, 'info-tag-warn');
      });
      wrap.appendChild(revRow);
    }

    // T10: 카드 조합
    if (adv && adv.combos && adv.combos.length > 0) {
      const comboRow = createEl('div', 'info-row');
      adv.combos.forEach(c => {
        addTag(comboRow, c.name, c.meaning, 'info-tag-good');
      });
      wrap.appendChild(comboRow);
    }

    // T11: 타이밍 지표
    if (adv && adv.timing) {
      const tRow = createEl('div', 'info-row');
      addTag(tRow, '시기암시', adv.timing.desc);
      addTag(tRow, '속도', adv.timing.speed);
      wrap.appendChild(tRow);
    }

    // 숫자 패턴
    if (p.numbers && p.numbers.length > 0) {
      const numRow = createEl('div', 'info-row');
      p.numbers.forEach(n => {
        addTag(numRow, '숫자' + (n.rankKorean || n.rank), n.count + '장 — ' + (n.message || ''));
      });
      wrap.appendChild(numRow);
    }

    // 코트 카드
    if (p.courtCards && p.courtCards.length > 0) {
      const ctRow = createEl('div', 'info-row');
      p.courtCards.forEach(cc => {
        addTag(ctRow, cc.name, cc.meaning);
      });
      wrap.appendChild(ctRow);
    }

    // 퀸테센스
    if (drawResult.reading) {
      const QUINT_NAMES = ['바보','마법사','여사제','여황제','황제','교황','연인','전차','힘','은둔자','운명의수레바퀴','정의','매달린사람','죽음','절제','악마','탑','별','달','태양','심판','세계'];
      let quintSum = drawResult.reading.reduce((sum, item) => {
        const c = item.card;
        if (c.id < 22) return sum + c.id;
        const courtVal = { page: 11, knight: 12, queen: 13, king: 14 };
        return sum + (courtVal[c.rank] || c.number || 0);
      }, 0);
      while (quintSum > 21) quintSum = String(quintSum).split('').reduce((a, d) => a + Number(d), 0);
      const qRow = createEl('div', 'info-row');
      addTag(qRow, '퀸테센스', (QUINT_NAMES[quintSum] || quintSum) + '(' + quintSum + '번) — 리딩의 숨겨진 본질', 'info-tag-good');
      wrap.appendChild(qRow);
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

    // 주제 선택 + 질문 초기화
    selectedTopics = [];
    renderTopicChips();
  }

  // ===== 유틸 =====
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== 시작 =====
  await initialize();
})();
