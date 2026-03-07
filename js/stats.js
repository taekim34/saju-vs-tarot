/**
 * 통계 관리 (stats.js)
 *
 * 역대 배틀 결과 통계 계산 및 렌더링
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

  async function loadAndRender(container) {
    container.textContent = '';
    container.appendChild(createEl('div', 'stats-loading-indicator', '통계를 불러오는 중...'));

    try {
      const results = await BkendClient.listResults(500);
      const stats = compute(results);
      render(container, stats);
    } catch (e) {
      console.error('통계 로드 실패:', e);
      container.textContent = '';
      container.appendChild(createEl('p', 'stats-error', '통계를 불러오지 못했습니다.'));
    }
  }

  function compute(results) {
    const total = results.length;
    if (total === 0) return { total: 0 };

    let sajuWins = 0, tarotWins = 0;
    const roundVotes = {
      '연애운': { saju: 0, tarot: 0 },
      '재물운': { saju: 0, tarot: 0 },
      '종합운세': { saju: 0, tarot: 0 }
    };
    const gender = {
      male: { saju: 0, tarot: 0, total: 0 },
      female: { saju: 0, tarot: 0, total: 0 }
    };
    const age = {};

    results.forEach(r => {
      if (r.winner === 'saju') sajuWins++;
      else if (r.winner === 'tarot') tarotWins++;

      // Round votes
      (r.rounds || []).forEach(rd => {
        if (roundVotes[rd.topic] && rd.vote) {
          roundVotes[rd.topic][rd.vote]++;
        }
      });

      // Demographics from birth_info "YYYY-MM-DD-gender"
      if (r.birth_info) {
        const parts = r.birth_info.split('-');
        const year = parseInt(parts[0]);
        const g = parts[3];

        if (g && gender[g]) {
          gender[g].total++;
          if (r.winner === 'saju') gender[g].saju++;
          else if (r.winner === 'tarot') gender[g].tarot++;
        }

        if (year && !isNaN(year)) {
          const a = new Date().getFullYear() - year;
          const decade = Math.floor(a / 10) * 10;
          if (decade >= 10 && decade <= 80) {
            const key = `${decade}대`;
            if (!age[key]) age[key] = { saju: 0, tarot: 0, total: 0 };
            age[key].total++;
            if (r.winner === 'saju') age[key].saju++;
            else if (r.winner === 'tarot') age[key].tarot++;
          }
        }
      }
    });

    return { total, overall: { saju: sajuWins, tarot: tarotWins }, roundVotes, gender, age };
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

    // Per-round
    const roundCard = createEl('div', 'stats-card');
    roundCard.appendChild(createEl('h3', 'stats-card-title', '라운드별 투표'));
    ['연애운', '재물운', '종합운세'].forEach(topic => {
      const rv = stats.roundVotes[topic];
      if (!rv) return;
      const total = rv.saju + rv.tarot;
      if (total === 0) return;
      const label = createEl('div', 'stats-bar-label');
      label.appendChild(createEl('span', '', topic));
      label.appendChild(createEl('span', 'stats-bar-count', `사주 ${rv.saju} : 타로 ${rv.tarot}`));
      roundCard.appendChild(label);
      roundCard.appendChild(renderBar(rv.saju, rv.tarot));
    });
    container.appendChild(roundCard);

    // Gender
    const genderCard = createEl('div', 'stats-card');
    genderCard.appendChild(createEl('h3', 'stats-card-title', '성별 분석'));
    const genderData = [
      { key: 'male', name: '남성' },
      { key: 'female', name: '여성' }
    ];
    let hasGenderData = false;
    genderData.forEach(({ key, name }) => {
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
