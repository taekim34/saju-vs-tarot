/**
 * 통계 관리 (stats.js)
 *
 * 서버 측 카운트 쿼리 (andFilters + pagination.total) 기반 통계
 * 전체 레코드를 가져오지 않고, 조건별 카운트만 병렬 요청
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
   * 모든 통계를 병렬 카운트 쿼리로 수집
   */
  async function fetchAllCounts() {
    const c = BkendClient.countStats;

    // Wave 1: 종합 + 성별 (9건 병렬)
    const [
      total, sajuWins, tarotWins,
      maleTotal, maleSaju, maleTarot,
      femaleTotal, femaleSaju, femaleTarot
    ] = await Promise.all([
      c({}), c({ winner: 'saju' }), c({ winner: 'tarot' }),
      c({ gender: 'male' }), c({ gender: 'male', winner: 'saju' }), c({ gender: 'male', winner: 'tarot' }),
      c({ gender: 'female' }), c({ gender: 'female', winner: 'saju' }), c({ gender: 'female', winner: 'tarot' })
    ]);

    // Wave 2: 주제별 투표 — 레코드를 가져와서 클라이언트 집계
    // topic_votes 객체 + 레거시 r1/r2/r3_vote 모두 처리
    const topicVotes = {};
    try {
      const allStats = await BkendClient.listStats(500);
      console.log('[stats] listStats returned', allStats.length, 'records');
      ALL_TOPICS.forEach(t => {
        topicVotes[t.name] = { saju: 0, tarot: 0, emoji: t.emoji };
      });

      const LEGACY_TOPICS = ['연애운', '재물운', '종합운세'];
      allStats.forEach(record => {
        // 신규 데이터: topic_votes 객체
        const tv = record.topic_votes;
        if (tv && typeof tv === 'object' && Object.keys(tv).length > 0) {
          Object.entries(tv).forEach(([topic, vote]) => {
            if (topicVotes[topic] && (vote === 'saju' || vote === 'tarot')) {
              topicVotes[topic][vote]++;
            }
          });
        } else {
          // 레거시 데이터: r1/r2/r3_vote → 고정 주제 매핑
          ['r1_vote', 'r2_vote', 'r3_vote'].forEach((field, idx) => {
            const vote = record[field];
            if (vote === 'saju' || vote === 'tarot') {
              const topic = LEGACY_TOPICS[idx];
              topicVotes[topic][vote]++;
            }
          });
        }
      });

      // 데이터 없는 주제 제거
      ALL_TOPICS.forEach(t => {
        const tv = topicVotes[t.name];
        if (tv.saju + tv.tarot === 0) delete topicVotes[t.name];
      });
    } catch (e) {
      console.error('[stats] listStats failed:', e);
    }

    // Wave 3: 연령대 (birth_year 범위 필터)
    const now = new Date().getFullYear();
    const ageQueries = DECADES.flatMap(decade => {
      const maxYear = now - decade;
      const minYear = now - decade - 9;
      const range = { birth_year: { $gte: minYear, $lte: maxYear } };
      return [
        c(range),
        c({ ...range, winner: 'saju' }),
        c({ ...range, winner: 'tarot' })
      ];
    });
    const ageResults = await Promise.all(ageQueries);

    const age = {};
    DECADES.forEach((decade, i) => {
      const dTotal = ageResults[i * 3];
      const dSaju = ageResults[i * 3 + 1];
      const dTarot = ageResults[i * 3 + 2];
      if (dTotal > 0) {
        age[`${decade}대`] = { total: dTotal, saju: dSaju, tarot: dTarot };
      }
    });

    return {
      total,
      overall: { saju: sajuWins, tarot: tarotWins },
      topicVotes,
      gender: {
        male: { total: maleTotal, saju: maleSaju, tarot: maleTarot },
        female: { total: femaleTotal, saju: femaleSaju, tarot: femaleTarot }
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
