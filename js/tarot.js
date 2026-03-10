/**
 * 타로 카드 엔진 (tarot.js) — v2.0 전문가 수준
 *
 * 78장 덱 관리 + Fisher-Yates 셔플 + 라운드별 드로우 + 패턴 분석
 *
 * v2.0 개선사항:
 * T1: 역방향 확률 35% — 실제 타로 리더 수준
 * T2: 수트 패턴 분석 — 원소 에너지 감지
 * T3: 숫자 패턴 분석 — 수비학적 메시지
 * T4: 메이저/마이너 비율 — 운명 vs 일상 판단
 * T5: 원소 상성 (Elemental Dignity) — 카드 간 "대화"
 * T6: 코트 카드 감지 — 인물 에너지 분석
 */

const TarotEngine = (() => {
  let majorArcana = [];
  let minorArcana = [];
  let deck = [];

  const SPREADS = {
    1: {
      name: '쓰리 카드 (과거-현재-미래)',
      topic: '연애운',
      count: 3,
      positions: ['과거', '현재', '미래']
    },
    2: {
      name: '쓰리 카드 (상황-조언-결과)',
      topic: '재물운',
      count: 3,
      positions: ['현재 상황', '조언', '결과']
    },
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
  };

  // ============================================================
  // [T2] 수트별 원소 에너지 설명
  // ============================================================
  const SUIT_ENERGY = {
    'wands':     { element: '불', energy: '열정, 행동, 창조, 의지' },
    'cups':      { element: '물', energy: '감정, 직관, 관계, 사랑' },
    'swords':    { element: '바람', energy: '사고, 분석, 갈등, 진실' },
    'pentacles': { element: '흙', energy: '물질, 안정, 현실, 건강' }
  };

  // [T3] 숫자별 수비학적 의미
  const NUMBER_MEANINGS = {
    'ace': '새로운 시작의 에너지 증폭',
    'two': '선택과 균형의 테마',
    'three': '창조와 확장의 에너지',
    'four': '안정과 구조화',
    'five': '변화와 도전',
    'six': '조화와 책임',
    'seven': '내면 탐구와 영적 성장',
    'eight': '힘과 성취',
    'nine': '완성 직전, 지혜',
    'ten': '순환의 완성, 새로운 시작의 문턱'
  };

  // [T5] 원소 상성 (Golden Dawn 전통)
  const ELEMENT_RELATIONS = {
    '불_바람': 'friendly',   '바람_불': 'friendly',
    '물_흙':   'friendly',   '흙_물':   'friendly',
    '불_물':   'hostile',    '물_불':   'hostile',
    '바람_흙': 'hostile',    '흙_바람': 'hostile',
    '불_흙':   'neutral',    '흙_불':   'neutral',
    '물_바람': 'neutral',    '바람_물': 'neutral'
  };

  const RELATION_DESC = {
    'friendly': '우호 — 에너지가 서로 강화됨',
    'hostile': '적대 — 긴장과 갈등, 에너지 약화',
    'neutral': '중립 — 독립적 에너지',
    'same': '동일 — 에너지 집중/과잉'
  };

  // [T6] 코트 카드 의미
  const COURT_MEANINGS = {
    'page':   '메시지, 소식, 학습 에너지 (젊은이의 영향)',
    'knight': '빠른 행동, 변화의 바람 (활동적 인물의 등장)',
    'queen':  '내면의 성숙, 수용적 지혜 (조언자의 역할)',
    'king':   '외적 권위, 리더십 (결정권자의 영향)'
  };

  // ============================================================
  // 기본 함수
  // ============================================================

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function loadData() {
    try {
      const [majorRes, minorRes] = await Promise.all([
        fetch('data/tarot-major.json'),
        fetch('data/tarot-minor.json')
      ]);
      majorArcana = await majorRes.json();
      minorArcana = await minorRes.json();
    } catch (e) {
      console.error('타로 데이터 로드 실패:', e);
    }
  }

  function initDeck() {
    const allCards = [...majorArcana, ...minorArcana];
    deck = shuffle(allCards);
  }

  // [T1] 역방향 확률 35%로 수정
  function drawCards(count) {
    if (deck.length < count) {
      console.warn('덱에 카드가 부족합니다. 남은 카드:', deck.length);
      count = deck.length;
    }
    const drawn = deck.splice(0, count);
    return drawn.map(card => ({
      ...card,
      isReversed: Math.random() < 0.35   // [T1] 50% → 35%
    }));
  }

  // ============================================================
  // 패턴 분석 (T2~T6)
  // ============================================================

  function analyzePatterns(cards) {
    const patterns = {};

    // [T4] 메이저/마이너 비율
    const majorCards = cards.filter(c => c.id < 22);
    const minorCards = cards.filter(c => c.id >= 22);
    const majorCount = majorCards.length;
    const totalCount = cards.length;

    let majorMessage = '';
    if (majorCount === totalCount) {
      majorMessage = '전부 메이저 — 극히 드문 조합, 운명이 강력하게 개입하는 시기';
    } else if (totalCount <= 3 && majorCount >= 2) {
      majorMessage = '메이저 다수 — 운명의 큰 전환기, 우주가 강력한 메시지를 보내고 있음';
    } else if (totalCount === 7 && majorCount >= 4) {
      majorMessage = '메이저 다수(4+/7) — 운명이 강력하게 개입, 인생의 중대한 전환점';
    } else if (totalCount === 7 && majorCount >= 3) {
      majorMessage = '메이저 과반 — 영적 메시지가 강한 시기, 큰 흐름에 주목하세요';
    } else if (totalCount === 5 && majorCount >= 3) {
      majorMessage = '메이저 과반 — 영적 메시지가 매우 강력, 인생의 중대한 갈림길';
    } else if (majorCount === 0) {
      majorMessage = '전부 마이너 — 일상적 차원의 변화, 스스로의 선택이 더 중요';
    } else {
      majorMessage = `메이저 ${majorCount}장/마이너 ${minorCards.length}장 — 운명과 일상이 교차하는 시기`;
    }
    patterns.majorMinor = { majorCount, minorCount: minorCards.length, totalCount, message: majorMessage };

    // [T2] 수트 패턴 분석
    const suitCounts = {};
    minorCards.forEach(c => {
      if (c.suit) {
        suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
      }
    });

    const suitPatterns = [];
    Object.entries(suitCounts).forEach(([suit, count]) => {
      if (count >= 2 && SUIT_ENERGY[suit]) {
        const info = SUIT_ENERGY[suit];
        suitPatterns.push({
          suit,
          suitKorean: minorCards.find(c => c.suit === suit)?.suit_korean || suit,
          count,
          element: info.element,
          message: `${info.element}의 에너지(${info.energy})가 ${count}장으로 강조됨`
        });
      }
    });

    // 부재 원소 감지
    const presentElements = new Set(minorCards.map(c => SUIT_ENERGY[c.suit]?.element).filter(Boolean));
    const allElements = ['불', '물', '바람', '흙'];
    const missingElements = allElements.filter(e => !presentElements.has(e));
    const missingSuits = {
      '불': '완드(행동/열정)', '물': '컵(감정/직관)',
      '바람': '소드(사고/분석)', '흙': '펜타클(현실/안정)'
    };
    const missingPatterns = missingElements.map(e => ({
      element: e,
      message: `${e} 원소 부재(${missingSuits[e]}) — 해당 영역의 에너지가 약함`
    }));

    patterns.suits = { dominant: suitPatterns, missing: missingPatterns };

    // [T3] 숫자 패턴 분석
    const rankCounts = {};
    minorCards.forEach(c => {
      if (c.rank) {
        rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
      }
    });

    const numberPatterns = [];
    Object.entries(rankCounts).forEach(([rank, count]) => {
      if (count >= 2 && NUMBER_MEANINGS[rank]) {
        numberPatterns.push({
          rank,
          rankKorean: minorCards.find(c => c.rank === rank)?.rank_korean || rank,
          count,
          message: `${rank} ${count}장 — ${NUMBER_MEANINGS[rank]}이(가) 겹쳐 강조됨`
        });
      }
    });
    patterns.numbers = numberPatterns;

    // [T5] 원소 상성 (Elemental Dignity) — 인접 카드 간 관계
    const elementalDignity = [];
    for (let i = 0; i < cards.length - 1; i++) {
      const e1 = getCardElement(cards[i]);
      const e2 = getCardElement(cards[i + 1]);
      if (e1 && e2) {
        let relation, desc;
        if (e1 === e2) {
          relation = 'same';
          desc = RELATION_DESC['same'];
        } else {
          const key = `${e1}_${e2}`;
          relation = ELEMENT_RELATIONS[key] || 'neutral';
          desc = RELATION_DESC[relation];
        }
        elementalDignity.push({
          card1: cards[i].korean || cards[i].name,
          card2: cards[i + 1].korean || cards[i + 1].name,
          element1: e1,
          element2: e2,
          relation,
          description: desc
        });
      }
    }
    patterns.elementalDignity = elementalDignity;

    // [T6] 코트 카드 감지
    const courtCards = [];
    const courtRanks = ['page', 'knight', 'queen', 'king'];
    cards.forEach(c => {
      if (c.rank && courtRanks.includes(c.rank)) {
        courtCards.push({
          name: c.korean || c.name,
          rank: c.rank,
          rankKorean: c.rank_korean || c.rank,
          suit: c.suit,
          suitKorean: c.suit_korean || c.suit,
          meaning: COURT_MEANINGS[c.rank],
          element: SUIT_ENERGY[c.suit]?.element || ''
        });
      }
    });
    patterns.courtCards = courtCards;

    return patterns;
  }

  function getCardElement(card) {
    if (card.id < 22) {
      // 메이저 아르카나: element 필드에서 추출
      const el = card.element || '';
      if (el.includes('불') || el.includes('화성') || el.includes('태양')) return '불';
      if (el.includes('물') || el.includes('달') || el.includes('해왕')) return '물';
      if (el.includes('바람') || el.includes('천왕') || el.includes('수성')) return '바람';
      if (el.includes('흙') || el.includes('토성') || el.includes('금성')) return '흙';
      return null;
    }
    // 마이너 아르카나: suit_element 필드
    return card.suit_element || SUIT_ENERGY[card.suit]?.element || null;
  }

  // ============================================================
  // 라운드별 드로우 (패턴 분석 포함)
  // ============================================================

  function drawForRound(round, significator = null) {
    const spread = SPREADS[round];
    if (!spread) {
      console.error('유효하지 않은 라운드:', round);
      return null;
    }

    const cards = drawCards(spread.count);
    const reading = cards.map((card, i) => ({
      position: spread.positions[i],
      card,
      direction: card.isReversed ? '역방향' : '정방향',
      keywords: card.isReversed ? card.reversed : card.upright
    }));

    // 패턴 분석 추가
    const patterns = analyzePatterns(cards);

    return {
      round,
      topic: spread.topic,
      spreadName: spread.name,
      reading,
      patterns,
      significator   // U3: 시그니피케이터 정보
    };
  }

  // ============================================================
  // AI 프롬프트용 요약 (전면 강화)
  // ============================================================

  function buildSummary(drawResult) {
    let text = `스프레드: ${drawResult.spreadName}\n`;
    text += `주제: ${drawResult.topic}\n`;

    // U3: 시그니피케이터 정보 추가
    if (drawResult.significator) {
      const sig = drawResult.significator;
      text += `【시그니피케이터】 ${sig.korean} — ${sig.meaning} (${sig.reason})\n`;
    }
    text += '\n';

    // 카드별 정보
    drawResult.reading.forEach(item => {
      const card = item.card;
      const isMajor = card.id < 22;
      const cardType = isMajor ? '메이저 아르카나' : `마이너 아르카나(${card.suit_korean || ''})`;
      text += `[${item.position}] ${card.korean || card.name} (${item.direction})\n`;
      text += `  유형: ${cardType}\n`;
      text += `  키워드: ${item.keywords.join(', ')}\n`;

      if (drawResult.topic === '연애운') {
        const loveText = card.isReversed ? card.love_reversed : card.love_upright;
        if (loveText) text += `  연애 힌트: ${loveText}\n`;
      } else if (drawResult.topic === '재물운') {
        const wealthText = card.isReversed ? card.wealth_reversed : card.wealth_upright;
        if (wealthText) text += `  재물 힌트: ${wealthText}\n`;
      }
      text += '\n';
    });

    // 퀸테센스(Quintessence) — 카드 숫자 합산 → 숨겨진 메이저 아르카나
    const quintNames = ['바보','마법사','여사제','여황제','황제','교황','연인','전차','힘','은둔자','운명의 수레바퀴','정의','매달린 사람','죽음','절제','악마','탑','별','달','태양','심판','세계'];
    let quintSum = drawResult.reading.reduce((sum, item) => {
      const c = item.card;
      if (c.id < 22) return sum + c.id;
      const courtVal = { page: 11, knight: 12, queen: 13, king: 14 };
      return sum + (courtVal[c.rank] || c.number || 0);
    }, 0);
    while (quintSum > 21) quintSum = String(quintSum).split('').reduce((a, d) => a + Number(d), 0);
    text += `\n【퀸테센스】 카드 숫자 합 → ${quintNames[quintSum] || quintSum}(${quintSum}번) — 이 리딩의 숨겨진 본질\n`;

    // [T4] 메이저/마이너 비율
    if (drawResult.patterns) {
      const p = drawResult.patterns;

      text += `\n【메이저/마이너 비율】 ${p.majorMinor.message}\n`;

      // [T2] 수트 패턴
      if (p.suits.dominant.length > 0) {
        text += `\n【수트 패턴】\n`;
        p.suits.dominant.forEach(s => { text += `  ${s.suitKorean}(${s.element}) ${s.count}장: ${s.message}\n`; });
      }
      if (p.suits.missing.length > 0) {
        p.suits.missing.forEach(m => { text += `  ⚠ ${m.message}\n`; });
      }

      // [T3] 숫자 패턴
      if (p.numbers.length > 0) {
        text += `\n【숫자 패턴】\n`;
        p.numbers.forEach(n => { text += `  ${n.message}\n`; });
      }

      // [T5] 원소 상성
      if (p.elementalDignity.length > 0) {
        text += `\n【카드 간 원소 관계】\n`;
        p.elementalDignity.forEach(ed => {
          text += `  ${ed.card1}(${ed.element1}) ↔ ${ed.card2}(${ed.element2}): ${ed.description}\n`;
        });
      }

      // [T6] 코트 카드
      if (p.courtCards.length > 0) {
        text += `\n【코트 카드 (인물 에너지)】\n`;
        p.courtCards.forEach(cc => {
          text += `  ${cc.name} (${cc.rankKorean}/${cc.suitKorean}): ${cc.meaning}\n`;
        });
      }
    }

    return text;
  }

  function getRemainingCount() {
    return deck.length;
  }

  // ============================================================
  // [U3] 시그니피케이터 — 나이/성별/주제 기반 코트 카드 자동 배정
  // ============================================================

  const SUIT_KOREAN = { wands: '완드', cups: '컵', swords: '소드', pentacles: '펜타클' };
  const RANK_KOREAN = { page: '시종', knight: '기사', queen: '여왕', king: '왕' };

  /**
   * 시그니피케이터 (질문자 대표 카드) 배정
   * @param {number} birthYear 출생 연도
   * @param {string} gender 'male' | 'female'
   * @param {string} topic 라운드 주제 ('연애운' | '재물운' | '종합운세')
   * @param {string} dayMasterElement 사주 일간 오행 ('목'|'화'|'토'|'금'|'수')
   * @returns {{ rank, suit, korean, meaning, reason }}
   */
  function getSignificator(birthYear, gender, topic, dayMasterElement) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear + 1; // 한국 나이

    // 랭크 결정 (나이 + 성별)
    let rank;
    if (age <= 19) {
      rank = 'page';
    } else if (age <= 39) {
      rank = gender === 'male' ? 'knight' : 'queen';
    } else {
      rank = gender === 'male' ? 'king' : 'queen';
    }

    // 수트 결정 (주제 기반 + 일간 오행 폴백)
    let suit;
    if (topic === '연애운') {
      suit = 'cups';
    } else if (topic === '재물운') {
      suit = 'pentacles';
    } else {
      // 종합운세: 일간 오행으로 수트 결정
      const elementToSuit = {
        '목': 'wands', '화': 'wands',
        '수': 'cups',
        '금': 'swords',
        '토': 'pentacles'
      };
      suit = elementToSuit[dayMasterElement] || 'wands';
    }

    return {
      rank,
      suit,
      korean: `${SUIT_KOREAN[suit]}의 ${RANK_KOREAN[rank]}`,
      meaning: `${RANK_KOREAN[rank]}의 에너지를 가진 질문자 (${age}세 ${gender === 'male' ? '남성' : '여성'})`,
      reason: `${age}세 ${gender === 'male' ? '남성' : '여성'} + ${topic}`
    };
  }

  return {
    loadData,
    initDeck,
    drawForRound,
    buildSummary,
    getRemainingCount,
    getSignificator,
    SPREADS
  };
})();
