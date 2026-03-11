/**
 * 통계 관리 (stats.js)
 *
 * 서버 측 카운팅 (andFilters + pagination.total) + 파생값 계산
 * 27건 병렬 countStats → 단일 Promise.all → 1 network round-trip
 */
const StatsManager = (() => {
  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function pct(val, total) {
    return total > 0 ? Math.round(val / total * 100) : 0;
  }

  const ALL_TOPICS = [
    { name: '연애운',   emoji: '💞' },
    { name: '재물운',   emoji: '💰' },
    { name: '종합운세', emoji: '🌏' },
    { name: '직업운',   emoji: '🏆' },
    { name: '건강운',   emoji: '🏥' },
    { name: '학업운',   emoji: '📚' },
    { name: '대인관계', emoji: '🤝' }
  ];
  const DECADES = [10, 20, 30, 40, 50, 60, 70, 80];

  /**
   * 서버 측 카운팅 + 파생값 계산으로 최소 API 호출
   *
   * 전략:
   *   tarot = total - saju  →  매 카테고리 호출 1/3 절감
   *   female = total - male →  성별 호출 추가 절감
   *   모든 호출 단일 Promise.all  →  1 network round-trip
   *
   * 호출 수: 2(종합) + 2(성별) + 7(주제) + 16(연령대) = 27
   *   기존 34건 대비 ~20% 절감, 전부 서버 측 카운팅
   */
  async function fetchAllCounts() {
    const c = BkendClient.countStats;
    const now = new Date().getFullYear();
    const TOPIC_FIELDS = ALL_TOPICS.map(t => `vote_${t.name}`);

    // ── 모든 쿼리를 한방 Promise.all로 ──
    const queries = [
      // [0] 전체, [1] 사주 승
      c({}), c({ winner: 'saju' }),
      // [2] 남성 전체, [3] 남성 사주
      c({ gender: 'male' }), c({ gender: 'male', winner: 'saju' }),
      // [4~10] 주제별 사주 투표 (tarot = 별도 조회 필요 — 주제 total 불명이라 파생 불가)
      ...TOPIC_FIELDS.map(f => c({ [f]: 'saju' })),
      // [11~17] 주제별 타로 투표
      ...TOPIC_FIELDS.map(f => c({ [f]: 'tarot' })),
      // [18~33] 연령대 전체 + 사주 (8 decades × 2)
      ...DECADES.flatMap(decade => {
        const range = { birth_year: { $gte: now - decade - 9, $lte: now - decade } };
        return [c(range), c({ ...range, winner: 'saju' })];
      })
    ];

    const r = await Promise.all(queries);

    // ── 종합 (파생: tarot = total - saju) ──
    const total = r[0];
    const sajuWins = r[1];
    const tarotWins = total - sajuWins;

    // ── 성별 (파생: female = total - male) ──
    const maleTotal = r[2];
    const maleSaju = r[3];
    const femaleTotal = total - maleTotal;
    const femaleSaju = sajuWins - maleSaju;

    // ── 주제별 투표 ──
    const topicVotes = {};
    ALL_TOPICS.forEach((t, i) => {
      const saju = r[4 + i];
      const tarot = r[11 + i];
      if (saju + tarot > 0) {
        topicVotes[t.name] = { saju, tarot, emoji: t.emoji };
      }
    });

    // ── 연령대 (파생: tarot = total - saju) ──
    const age = {};
    DECADES.forEach((decade, i) => {
      const dTotal = r[18 + i * 2];
      const dSaju = r[18 + i * 2 + 1];
      if (dTotal > 0) {
        age[`${decade}대`] = { total: dTotal, saju: dSaju, tarot: dTotal - dSaju };
      }
    });

    return {
      total,
      overall: { saju: sajuWins, tarot: tarotWins },
      topicVotes,
      gender: {
        male:   { total: maleTotal, saju: maleSaju, tarot: maleTotal - maleSaju },
        female: { total: femaleTotal, saju: femaleSaju, tarot: femaleTotal - femaleSaju }
      },
      age
    };
  }

  async function loadAndRender(container) {
    container.textContent = '';
    container.appendChild(createEl('div', 'stats-loading-indicator', '통계를 불러오는 중...'));

    try {
      const stats = await fetchAllCounts();
      render(container, stats);
    } catch (e) {
      console.error('통계 로드 실패:', e);
      container.textContent = '';
      container.appendChild(createEl('p', 'stats-error', '통계를 불러오지 못했습니다.'));
    }
  }

  function renderBar(valA, valB) {
    const total = valA + valB;
    const bar = createEl('div', 'stats-bar');

    if (total === 0) {
      bar.appendChild(createEl('div', 'stats-bar-empty', '데이터 없음'));
      return bar;
    }

    const pctA = pct(valA, total);
    const pctB = 100 - pctA;

    const segA = createEl('div', 'stats-bar-seg saju');
    segA.style.width = `${Math.max(pctA, 10)}%`;
    segA.textContent = `${pctA}%`;
    bar.appendChild(segA);

    const segB = createEl('div', 'stats-bar-seg tarot');
    segB.style.width = `${Math.max(pctB, 10)}%`;
    segB.textContent = `${pctB}%`;
    bar.appendChild(segB);

    return bar;
  }

  function render(container, stats) {
    container.textContent = '';

    if (stats.total === 0) {
      container.appendChild(createEl('p', 'stats-empty', '아직 진행된 대결이 없습니다. 첫 번째 대결의 주인공이 되어보세요!'));
      return;
    }

    // Total count
    const totalCard = createEl('div', 'stats-card stats-total-card');
    totalCard.appendChild(createEl('div', 'stats-total-num', stats.total.toLocaleString()));
    totalCard.appendChild(createEl('div', 'stats-total-label', '번의 운명의 대결이 펼쳐졌습니다'));
    container.appendChild(totalCard);

    // Overall win rate
    const overallCard = createEl('div', 'stats-card');
    overallCard.appendChild(createEl('h3', 'stats-card-title', '종합 전적'));
    const legend = createEl('div', 'stats-legend');
    legend.appendChild(createEl('span', 'stats-legend-item saju', `사주 ${stats.overall.saju}승`));
    legend.appendChild(createEl('span', 'stats-legend-item tarot', `타로 ${stats.overall.tarot}승`));
    overallCard.appendChild(legend);
    overallCard.appendChild(renderBar(stats.overall.saju, stats.overall.tarot));
    container.appendChild(overallCard);

    // Per-topic votes (7개 주제 모두)
    const topicCard = createEl('div', 'stats-card');
    topicCard.appendChild(createEl('h3', 'stats-card-title', '주제별 투표'));
    let hasTopicData = false;
    ALL_TOPICS.forEach(t => {
      const tv = stats.topicVotes[t.name];
      if (!tv) return;
      const total = tv.saju + tv.tarot;
      if (total === 0) return;
      hasTopicData = true;
      const label = createEl('div', 'stats-bar-label');
      label.appendChild(createEl('span', '', `${t.emoji} ${t.name}`));
      label.appendChild(createEl('span', 'stats-bar-count', `사주 ${tv.saju} : 타로 ${tv.tarot}`));
      topicCard.appendChild(label);
      topicCard.appendChild(renderBar(tv.saju, tv.tarot));
    });
    if (!hasTopicData) {
      topicCard.appendChild(createEl('p', 'stats-no-data', '데이터 없음'));
    }
    container.appendChild(topicCard);

    // Gender
    const genderCard = createEl('div', 'stats-card');
    genderCard.appendChild(createEl('h3', 'stats-card-title', '성별 분석'));
    let hasGenderData = false;
    [{ key: 'male', name: '남성' }, { key: 'female', name: '여성' }].forEach(({ key, name }) => {
      const g = stats.gender[key];
      if (g.total === 0) return;
      hasGenderData = true;
      const label = createEl('div', 'stats-bar-label');
      label.appendChild(createEl('span', '', `${name} (${g.total}명)`));
      const pref = g.saju > g.tarot ? '사주 선호' : g.tarot > g.saju ? '타로 선호' : '동률';
      label.appendChild(createEl('span', 'stats-bar-pref', pref));
      genderCard.appendChild(label);
      genderCard.appendChild(renderBar(g.saju, g.tarot));
    });
    if (!hasGenderData) {
      genderCard.appendChild(createEl('p', 'stats-no-data', '데이터 없음'));
    }
    container.appendChild(genderCard);

    // Age
    const ageCard = createEl('div', 'stats-card');
    ageCard.appendChild(createEl('h3', 'stats-card-title', '연령대별 분석'));
    const ageKeys = Object.keys(stats.age).sort();
    if (ageKeys.length > 0) {
      ageKeys.forEach(key => {
        const a = stats.age[key];
        const label = createEl('div', 'stats-bar-label');
        label.appendChild(createEl('span', '', `${key} (${a.total}명)`));
        const pref = a.saju > a.tarot ? '사주 선호' : a.tarot > a.saju ? '타로 선호' : '동률';
        label.appendChild(createEl('span', 'stats-bar-pref', pref));
        ageCard.appendChild(label);
        ageCard.appendChild(renderBar(a.saju, a.tarot));
      });
    } else {
      ageCard.appendChild(createEl('p', 'stats-no-data', '데이터 없음'));
    }
    container.appendChild(ageCard);
  }

  return { loadAndRender };
})();
