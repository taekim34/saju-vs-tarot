/**
 * 사주 계산 엔진 (saju.js) — v2.0 전문가 수준
 *
 * 양력 생년월일시 → 사주팔자 산출 → 전문가 수준 분석
 *
 * v2.0 개선사항:
 * S1: 지지 십성 음양 버그 수정 — 정재/정관/정인 정상 산출
 * S2: 세운(歲運) — 올해 간지와 사주의 관계 분석
 * S3: 지장간 활용 — 숨은 오행/십성 분석
 * S4: 충(冲) 판단 — 6충 + 세운충
 * S5: 삼합/육합 — 조합 에너지 분석
 * S6: 대운(大運) 계산 — 10년 단위 큰 운의 흐름
 * S7: 12운성 — 천간 에너지의 생로병사
 * S8: 정밀 절기 테이블 — 연도별 절기 경계
 */

const SajuEngine = (() => {
  let cheonganData = [];
  let jijiData = [];
  let sipsungData = [];

  const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const JIJI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

  const CHEONGAN_ELEMENT = {
    '甲': '목', '乙': '목', '丙': '화', '丁': '화',
    '戊': '토', '己': '토', '庚': '금', '辛': '금',
    '壬': '수', '癸': '수'
  };

  const CHEONGAN_YINYANG = {
    '甲': '양', '乙': '음', '丙': '양', '丁': '음',
    '戊': '양', '己': '음', '庚': '양', '辛': '음',
    '壬': '양', '癸': '음'
  };

  const JIJI_ELEMENT = {
    '子': '수', '丑': '토', '寅': '목', '卯': '목',
    '辰': '토', '巳': '화', '午': '화', '未': '토',
    '申': '금', '酉': '금', '戌': '토', '亥': '수'
  };

  // [S1] 지지 음양 매핑 — 정기(正氣) 천간의 음양을 사용해야 정확
  // 지지 자체 음양(子=양, 巳=음 등)이 아니라 정기 천간(子→癸=음, 巳→丙=양 등) 기준
  const JIJI_YINYANG = {
    '子': '음', '丑': '음', '寅': '양', '卯': '음',  // 子:癸(음), 丑:己(음), 寅:甲(양), 卯:乙(음)
    '辰': '양', '巳': '양', '午': '음', '未': '음',  // 辰:戊(양), 巳:丙(양), 午:丁(음), 未:己(음)
    '申': '양', '酉': '음', '戌': '양', '亥': '양'   // 申:庚(양), 酉:辛(음), 戌:戊(양), 亥:壬(양)
  };

  const SANG_SAENG = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const SANG_GEUK = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };

  // ============================================================
  // [S4] 6충 테이블
  // ============================================================
  const CHUNG_MAP = {
    '子': '午', '午': '子', '丑': '未', '未': '丑',
    '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
    '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
  };

  const CHUNG_MEANINGS = {
    '子午': '수화 충돌 — 감정과 이성의 갈등, 심리적 변동',
    '午子': '수화 충돌 — 감정과 이성의 갈등, 심리적 변동',
    '丑未': '토토 충돌 — 가정 내 갈등, 재산 변동',
    '未丑': '토토 충돌 — 가정 내 갈등, 재산 변동',
    '寅申': '목금 충돌 — 직업/방향의 변화, 이동수',
    '申寅': '목금 충돌 — 직업/방향의 변화, 이동수',
    '卯酉': '목금 충돌 — 대인관계 변동, 문서/계약 주의',
    '酉卯': '목금 충돌 — 대인관계 변동, 문서/계약 주의',
    '辰戌': '토토 충돌 — 부동산/재산 변동, 변화의 소용돌이',
    '戌辰': '토토 충돌 — 부동산/재산 변동, 변화의 소용돌이',
    '巳亥': '화수 충돌 — 건강 주의, 학업/시험 변동',
    '亥巳': '화수 충돌 — 건강 주의, 학업/시험 변동'
  };

  // ============================================================
  // [S5] 삼합/육합 테이블
  // ============================================================
  const SAMHAP = [
    { branches: ['申','子','辰'], element: '수', name: '수국(水局)', meaning: '지혜와 유연함의 에너지' },
    { branches: ['寅','午','戌'], element: '화', name: '화국(火局)', meaning: '열정과 행동의 에너지' },
    { branches: ['巳','酉','丑'], element: '금', name: '금국(金局)', meaning: '결단력과 실행의 에너지' },
    { branches: ['亥','卯','未'], element: '목', name: '목국(木局)', meaning: '성장과 인자함의 에너지' }
  ];

  const YUKHAP = {
    '子丑': { element: '토', meaning: '안정과 결속의 합' },
    '丑子': { element: '토', meaning: '안정과 결속의 합' },
    '寅亥': { element: '목', meaning: '성장과 발전의 합' },
    '亥寅': { element: '목', meaning: '성장과 발전의 합' },
    '卯戌': { element: '화', meaning: '열정과 변화의 합' },
    '戌卯': { element: '화', meaning: '열정과 변화의 합' },
    '辰酉': { element: '금', meaning: '결단과 조율의 합' },
    '酉辰': { element: '금', meaning: '결단과 조율의 합' },
    '巳申': { element: '수', meaning: '지혜와 소통의 합' },
    '申巳': { element: '수', meaning: '지혜와 소통의 합' },
    '午未': { element: '토', meaning: '조화와 화합의 합' },
    '未午': { element: '토', meaning: '조화와 화합의 합' }
  };

  // ============================================================
  // [S7] 12운성 — 일간의 에너지 생로병사 순환
  // ============================================================
  const TWELVE_STAGES = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];

  // 각 천간의 장생 지지 인덱스 + 방향 (1=순행, -1=역행)
  const TWELVE_STAGE_CONFIG = {
    '甲': { start: 11, dir: 1 },   // 亥 장생, 순행
    '乙': { start: 6,  dir: -1 },  // 午 장생, 역행
    '丙': { start: 2,  dir: 1 },   // 寅 장생, 순행
    '丁': { start: 9,  dir: -1 },  // 酉 장생, 역행
    '戊': { start: 2,  dir: 1 },   // 寅 장생, 순행 (丙과 동일)
    '己': { start: 9,  dir: -1 },  // 酉 장생, 역행 (丁과 동일)
    '庚': { start: 5,  dir: 1 },   // 巳 장생, 순행
    '辛': { start: 0,  dir: -1 },  // 子 장생, 역행
    '壬': { start: 8,  dir: 1 },   // 申 장생, 순행
    '癸': { start: 3,  dir: -1 }   // 卯 장생, 역행
  };

  // ============================================================
  // [S8] 정밀 절기 테이블 — 연도별 (한국 표준시 기준)
  // ============================================================
  const JEOLGI_PRECISE = {
    2024: [
      { month: 1, start: [2, 4] }, { month: 2, start: [3, 5] },
      { month: 3, start: [4, 4] }, { month: 4, start: [5, 5] },
      { month: 5, start: [6, 5] }, { month: 6, start: [7, 6] },
      { month: 7, start: [8, 7] }, { month: 8, start: [9, 7] },
      { month: 9, start: [10, 8] }, { month: 10, start: [11, 7] },
      { month: 11, start: [12, 7] }, { month: 12, start: [1, 6] }
    ],
    2025: [
      { month: 1, start: [2, 3] }, { month: 2, start: [3, 5] },
      { month: 3, start: [4, 4] }, { month: 4, start: [5, 5] },
      { month: 5, start: [6, 5] }, { month: 6, start: [7, 7] },
      { month: 7, start: [8, 7] }, { month: 8, start: [9, 7] },
      { month: 9, start: [10, 8] }, { month: 10, start: [11, 7] },
      { month: 11, start: [12, 7] }, { month: 12, start: [1, 5] }
    ],
    2026: [
      { month: 1, start: [2, 4] }, { month: 2, start: [3, 5] },
      { month: 3, start: [4, 5] }, { month: 4, start: [5, 5] },
      { month: 5, start: [6, 5] }, { month: 6, start: [7, 7] },
      { month: 7, start: [8, 7] }, { month: 8, start: [9, 7] },
      { month: 9, start: [10, 8] }, { month: 10, start: [11, 7] },
      { month: 11, start: [12, 7] }, { month: 12, start: [1, 5] }
    ],
    2027: [
      { month: 1, start: [2, 4] }, { month: 2, start: [3, 5] },
      { month: 3, start: [4, 5] }, { month: 4, start: [5, 5] },
      { month: 5, start: [6, 5] }, { month: 6, start: [7, 7] },
      { month: 7, start: [8, 7] }, { month: 8, start: [9, 7] },
      { month: 9, start: [10, 8] }, { month: 10, start: [11, 7] },
      { month: 11, start: [12, 7] }, { month: 12, start: [1, 5] }
    ],
    2028: [
      { month: 1, start: [2, 4] }, { month: 2, start: [3, 5] },
      { month: 3, start: [4, 4] }, { month: 4, start: [5, 5] },
      { month: 5, start: [6, 5] }, { month: 6, start: [7, 6] },
      { month: 7, start: [8, 7] }, { month: 8, start: [9, 7] },
      { month: 9, start: [10, 7] }, { month: 10, start: [11, 7] },
      { month: 11, start: [12, 6] }, { month: 12, start: [1, 6] }
    ]
  };

  // 기본 절기 (정밀 테이블이 없는 연도용 fallback)
  const JEOLGI_DEFAULT = [
    { month: 1, start: [2, 4] },  { month: 2, start: [3, 6] },
    { month: 3, start: [4, 5] },  { month: 4, start: [5, 6] },
    { month: 5, start: [6, 6] },  { month: 6, start: [7, 7] },
    { month: 7, start: [8, 7] },  { month: 8, start: [9, 8] },
    { month: 9, start: [10, 8] }, { month: 10, start: [11, 7] },
    { month: 11, start: [12, 7] }, { month: 12, start: [1, 6] }
  ];

  // 월주/시주 천간 시작점
  const MONTH_STEM_START = {
    0: 2, 1: 4, 2: 6, 3: 8, 4: 0,
    5: 2, 6: 4, 7: 6, 8: 8, 9: 0
  };

  const HOUR_STEM_START = {
    0: 0, 1: 2, 2: 4, 3: 6, 4: 8,
    5: 0, 6: 2, 7: 4, 8: 6, 9: 8
  };

  // ============================================================
  // 기본 계산 함수
  // ============================================================

  function toJDN(year, month, day) {
    if (month <= 2) { year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  // [S8] 절기 기준 월 계산 — 연도별 정밀 테이블 활용
  function getSajuMonth(year, solarMonth, solarDay) {
    const boundaries = JEOLGI_PRECISE[year] || JEOLGI_DEFAULT;
    const sohanDay = boundaries[11]?.start[1] || 6;

    if (solarMonth === 1 && solarDay >= sohanDay) return 12;
    if (solarMonth === 1 && solarDay < sohanDay) return 11;

    for (let i = boundaries.length - 1; i >= 0; i--) {
      const [bMonth, bDay] = boundaries[i].start;
      if (bMonth > 1 && (solarMonth > bMonth || (solarMonth === bMonth && solarDay >= bDay))) {
        return boundaries[i].month;
      }
    }
    return 12;
  }

  // [S8] 년주 — 입춘 날짜도 정밀 테이블 참조
  function getYearPillar(year, month, day) {
    const boundaries = JEOLGI_PRECISE[year] || JEOLGI_DEFAULT;
    const ipchun = boundaries[0].start; // 입춘
    let sajuYear = year;
    if (month < ipchun[0] || (month === ipchun[0] && day < ipchun[1])) {
      sajuYear -= 1;
    }
    const stemIdx = (sajuYear - 4) % 10;
    const branchIdx = (sajuYear - 4) % 12;
    return { cheongan: CHEONGAN[stemIdx], jiji: JIJI[branchIdx], stemIndex: stemIdx, branchIndex: branchIdx };
  }

  function getMonthPillar(yearStemIndex, year, solarMonth, solarDay) {
    const sajuMonth = getSajuMonth(year, solarMonth, solarDay);
    const branchIdx = (sajuMonth + 1) % 12;
    const startStem = MONTH_STEM_START[yearStemIndex];
    const stemIdx = (startStem + (sajuMonth - 1)) % 10;
    return { cheongan: CHEONGAN[stemIdx], jiji: JIJI[branchIdx], stemIndex: stemIdx, branchIndex: branchIdx, sajuMonth };
  }

  function getDayPillar(year, month, day) {
    const jdn = toJDN(year, month, day);
    const dayIdx = (Math.round(jdn) + 49) % 60;
    const stemIdx = dayIdx % 10;
    const branchIdx = dayIdx % 12;
    return { cheongan: CHEONGAN[stemIdx], jiji: JIJI[branchIdx], stemIndex: stemIdx, branchIndex: branchIdx };
  }

  function getHourPillar(dayStemIndex, hour, minute) {
    const totalMinutes = hour * 60 + minute;
    let branchIdx;
    if (totalMinutes >= 1380 || totalMinutes < 60) branchIdx = 0;
    else if (totalMinutes < 180) branchIdx = 1;
    else if (totalMinutes < 300) branchIdx = 2;
    else if (totalMinutes < 420) branchIdx = 3;
    else if (totalMinutes < 540) branchIdx = 4;
    else if (totalMinutes < 660) branchIdx = 5;
    else if (totalMinutes < 780) branchIdx = 6;
    else if (totalMinutes < 900) branchIdx = 7;
    else if (totalMinutes < 1020) branchIdx = 8;
    else if (totalMinutes < 1140) branchIdx = 9;
    else if (totalMinutes < 1260) branchIdx = 10;
    else branchIdx = 11;

    const startStem = HOUR_STEM_START[dayStemIndex];
    const stemIdx = (startStem + branchIdx) % 10;
    return { cheongan: CHEONGAN[stemIdx], jiji: JIJI[branchIdx], stemIndex: stemIdx, branchIndex: branchIdx };
  }

  // ============================================================
  // 표면 오행 분포
  // ============================================================

  function calculateElements(pillars) {
    const dist = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    const list = [pillars.year, pillars.month, pillars.day];
    if (pillars.hour) list.push(pillars.hour);
    list.forEach(p => {
      dist[CHEONGAN_ELEMENT[p.cheongan]]++;
      dist[JIJI_ELEMENT[p.jiji]]++;
    });
    return dist;
  }

  // ============================================================
  // [S3] 지장간 활용 — jiji.json의 jijanggan 데이터 사용
  // ============================================================

  function calculateJijangganElements(pillars) {
    const dist = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    const branches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji];
    if (pillars.hour) branches.push(pillars.hour.jiji);

    branches.forEach(branch => {
      const info = jijiData.find(j => j.name === branch);
      if (info && info.jijanggan) {
        info.jijanggan.forEach(stem => {
          const el = CHEONGAN_ELEMENT[stem];
          if (el) dist[el]++;
        });
      }
    });
    return dist;
  }

  function getJijangganDetail(pillars) {
    const positions = [
      { name: '년지', branch: pillars.year.jiji },
      { name: '월지', branch: pillars.month.jiji },
      { name: '일지', branch: pillars.day.jiji }
    ];
    if (pillars.hour) positions.push({ name: '시지', branch: pillars.hour.jiji });

    return positions.map(pos => {
      const info = jijiData.find(j => j.name === pos.branch);
      const stems = (info && info.jijanggan) || [];
      return {
        position: pos.name,
        branch: pos.branch,
        stems,
        elements: stems.map(s => CHEONGAN_ELEMENT[s])
      };
    });
  }

  // ============================================================
  // [S1] 십성 계산 — 지지 음양 버그 완전 수정
  // ============================================================

  function getTenGod(dayMaster, targetChar, isCheongan) {
    const myElement = CHEONGAN_ELEMENT[dayMaster];
    const myYinYang = CHEONGAN_YINYANG[dayMaster];
    const targetElement = isCheongan ? CHEONGAN_ELEMENT[targetChar] : JIJI_ELEMENT[targetChar];
    // [S1 핵심 수정] 지지도 JIJI_YINYANG으로 음양 비교
    const targetYinYang = isCheongan ? CHEONGAN_YINYANG[targetChar] : JIJI_YINYANG[targetChar];
    const sameYinYang = targetYinYang === myYinYang;

    if (targetElement === myElement) return sameYinYang ? '비견' : '겁재';
    if (SANG_SAENG[myElement] === targetElement) return sameYinYang ? '식신' : '상관';
    if (SANG_GEUK[myElement] === targetElement) return sameYinYang ? '편재' : '정재';
    if (SANG_GEUK[targetElement] === myElement) return sameYinYang ? '편관' : '정관';
    if (SANG_SAENG[targetElement] === myElement) return sameYinYang ? '편인' : '정인';
    return '비견';
  }

  function calculateTenGods(dayMaster, pillars) {
    const result = [];
    result.push({ position: '년간', char: pillars.year.cheongan, tenGod: getTenGod(dayMaster, pillars.year.cheongan, true) });
    result.push({ position: '년지', char: pillars.year.jiji, tenGod: getTenGod(dayMaster, pillars.year.jiji, false) });
    result.push({ position: '월간', char: pillars.month.cheongan, tenGod: getTenGod(dayMaster, pillars.month.cheongan, true) });
    result.push({ position: '월지', char: pillars.month.jiji, tenGod: getTenGod(dayMaster, pillars.month.jiji, false) });
    result.push({ position: '일지', char: pillars.day.jiji, tenGod: getTenGod(dayMaster, pillars.day.jiji, false) });
    if (pillars.hour) {
      result.push({ position: '시간', char: pillars.hour.cheongan, tenGod: getTenGod(dayMaster, pillars.hour.cheongan, true) });
      result.push({ position: '시지', char: pillars.hour.jiji, tenGod: getTenGod(dayMaster, pillars.hour.jiji, false) });
    }
    return result;
  }

  // ============================================================
  // [S2] 세운(歲運) — 올해 간지와 사주의 관계
  // ============================================================

  function calculateSeun(dayMaster, pillars) {
    const currentYear = new Date().getFullYear();
    const stemIdx = (currentYear - 4) % 10;
    const branchIdx = (currentYear - 4) % 12;
    const seunStem = CHEONGAN[stemIdx];
    const seunBranch = JIJI[branchIdx];

    const branches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji];
    if (pillars.hour) branches.push(pillars.hour.jiji);

    const seunChung = [];
    const seunHap = [];
    branches.forEach(b => {
      if (CHUNG_MAP[seunBranch] === b) {
        seunChung.push({ branch: b, meaning: CHUNG_MEANINGS[seunBranch + b] || '충' });
      }
      const hapKey = seunBranch + b;
      if (YUKHAP[hapKey]) {
        seunHap.push({ branch: b, ...YUKHAP[hapKey] });
      }
    });

    return {
      year: currentYear,
      stem: seunStem,
      branch: seunBranch,
      stemElement: CHEONGAN_ELEMENT[seunStem],
      branchElement: JIJI_ELEMENT[seunBranch],
      stemTenGod: getTenGod(dayMaster, seunStem, true),
      branchTenGod: getTenGod(dayMaster, seunBranch, false),
      chung: seunChung,
      hap: seunHap
    };
  }

  // ============================================================
  // [S4] 충(冲) 판단
  // ============================================================

  function checkChung(pillars) {
    const branches = [
      { pos: '년지', branch: pillars.year.jiji },
      { pos: '월지', branch: pillars.month.jiji },
      { pos: '일지', branch: pillars.day.jiji }
    ];
    if (pillars.hour) branches.push({ pos: '시지', branch: pillars.hour.jiji });

    const chungList = [];
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        if (CHUNG_MAP[branches[i].branch] === branches[j].branch) {
          const key = branches[i].branch + branches[j].branch;
          chungList.push({
            pair: `${branches[i].pos}(${branches[i].branch})-${branches[j].pos}(${branches[j].branch})`,
            meaning: CHUNG_MEANINGS[key] || '충'
          });
        }
      }
    }
    return chungList;
  }

  // ============================================================
  // [S5] 삼합/육합
  // ============================================================

  function checkHap(pillars) {
    const branches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji];
    if (pillars.hour) branches.push(pillars.hour.jiji);
    const branchSet = new Set(branches);
    const posNames = ['년지', '월지', '일지', '시지'];

    const result = { samhap: [], banhap: [], yukhap: [] };

    SAMHAP.forEach(group => {
      const matches = group.branches.filter(b => branchSet.has(b));
      if (matches.length === 3) {
        result.samhap.push({ ...group, type: '완전삼합' });
      } else if (matches.length === 2) {
        result.banhap.push({ branches: matches, element: group.element, name: group.name, meaning: group.meaning, type: '반합' });
      }
    });

    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const key = branches[i] + branches[j];
        if (YUKHAP[key]) {
          result.yukhap.push({
            pair: `${posNames[i]}(${branches[i]})-${posNames[j]}(${branches[j]})`,
            ...YUKHAP[key]
          });
        }
      }
    }
    return result;
  }

  // ============================================================
  // [S7] 12운성 — 일간의 에너지 상태
  // ============================================================

  function getTwelveStage(cheongan, jijiIndex) {
    const config = TWELVE_STAGE_CONFIG[cheongan];
    if (!config) return null;
    const offset = config.dir === 1
      ? (jijiIndex - config.start + 12) % 12
      : (config.start - jijiIndex + 12) % 12;
    return TWELVE_STAGES[offset];
  }

  function calculateTwelveStages(dayMaster, pillars) {
    const positions = [
      { name: '년지', branch: pillars.year.jiji, idx: pillars.year.branchIndex },
      { name: '월지', branch: pillars.month.jiji, idx: pillars.month.branchIndex },
      { name: '일지', branch: pillars.day.jiji, idx: pillars.day.branchIndex }
    ];
    if (pillars.hour) {
      positions.push({ name: '시지', branch: pillars.hour.jiji, idx: pillars.hour.branchIndex });
    }
    return positions.map(p => ({
      position: p.name,
      branch: p.branch,
      stage: getTwelveStage(dayMaster, p.idx)
    }));
  }

  // ============================================================
  // [S6] 대운(大運) 계산 — 10년 단위 운의 흐름
  // ============================================================

  function calculateDaeun(birthDate, gender, yearPillar, monthPillar) {
    const [year, month, day] = birthDate.split('-').map(Number);
    const yearStemYY = CHEONGAN_YINYANG[yearPillar.cheongan];

    // 순행/역행: 남양 or 여음 → 순행, 남음 or 여양 → 역행
    const isForward = (gender === 'male' && yearStemYY === '양') ||
                      (gender === 'female' && yearStemYY === '음');

    // 대운 시작 나이 (근사 계산: 다음/이전 절기까지 일수 ÷ 3)
    const boundaries = JEOLGI_PRECISE[year] || JEOLGI_DEFAULT;
    let daysToJeolgi = 0;

    if (isForward) {
      for (let i = 0; i < boundaries.length; i++) {
        const [bm, bd] = boundaries[i].start;
        if (bm > month || (bm === month && bd > day)) {
          daysToJeolgi = (bm - month) * 30 + (bd - day);
          break;
        }
      }
      if (daysToJeolgi <= 0) daysToJeolgi = 30;
    } else {
      for (let i = boundaries.length - 1; i >= 0; i--) {
        const [bm, bd] = boundaries[i].start;
        if (bm < month || (bm === month && bd <= day)) {
          daysToJeolgi = (month - bm) * 30 + (day - bd);
          break;
        }
      }
      if (daysToJeolgi <= 0) daysToJeolgi = 15;
    }

    const startAge = Math.max(1, Math.round(daysToJeolgi / 3));
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - year + 1;

    // 대운 간지 생성 (8개)
    const daeunList = [];
    let stemIdx = monthPillar.stemIndex;
    let branchIdx = monthPillar.branchIndex;

    for (let i = 1; i <= 8; i++) {
      if (isForward) {
        stemIdx = (stemIdx + 1) % 10;
        branchIdx = (branchIdx + 1) % 12;
      } else {
        stemIdx = (stemIdx - 1 + 10) % 10;
        branchIdx = (branchIdx - 1 + 12) % 12;
      }
      const ageStart = startAge + (i - 1) * 10;
      const ageEnd = ageStart + 9;
      daeunList.push({
        order: i,
        stem: CHEONGAN[stemIdx],
        branch: JIJI[branchIdx],
        stemElement: CHEONGAN_ELEMENT[CHEONGAN[stemIdx]],
        branchElement: JIJI_ELEMENT[JIJI[branchIdx]],
        ageRange: `${ageStart}~${ageEnd}세`,
        ageStart,
        ageEnd,
        isCurrent: currentAge >= ageStart && currentAge <= ageEnd
      });
    }

    return {
      direction: isForward ? '순행' : '역행',
      startAge,
      current: daeunList.find(d => d.isCurrent) || null,
      list: daeunList
    };
  }

  // ============================================================
  // 신강/신약 (개선 — 지장간 + 12운성 반영)
  // ============================================================

  function determineStrength(dayMaster, elements, jijangganElements, twelveStages) {
    const myElement = CHEONGAN_ELEMENT[dayMaster];
    const generatesMe = Object.keys(SANG_SAENG).find(k => SANG_SAENG[k] === myElement);

    let supportCount = elements[myElement] + (generatesMe ? elements[generatesMe] : 0);
    let total = Object.values(elements).reduce((a, b) => a + b, 0);

    // 지장간 오행 가산 (가중치 0.5)
    if (jijangganElements) {
      const jjSupport = jijangganElements[myElement] + (generatesMe ? jijangganElements[generatesMe] : 0);
      supportCount += jjSupport * 0.5;
      total += Object.values(jijangganElements).reduce((a, b) => a + b, 0) * 0.5;
    }

    // 12운성 보정
    if (twelveStages) {
      const strongStages = ['건록', '제왕', '관대', '장생'];
      const weakStages = ['사', '묘', '절', '병'];
      twelveStages.forEach(ts => {
        if (strongStages.includes(ts.stage)) supportCount += 0.5;
        if (weakStages.includes(ts.stage)) supportCount -= 0.3;
      });
    }

    const resistCount = total - supportCount;
    return supportCount >= resistCount ? '신강' : '신약';
  }

  // ============================================================
  // 십성 집계 + 격국 판단
  // ============================================================

  function analyzeTenGodStats(tenGods, dayMaster, pillars) {
    // 십성별 개수 집계
    const counts = {};
    tenGods.forEach(t => {
      counts[t.tenGod] = (counts[t.tenGod] || 0) + 1;
    });

    // 십성 그룹별 집계
    const groups = {
      '비겁(자아)': (counts['비견'] || 0) + (counts['겁재'] || 0),
      '식상(표현)': (counts['식신'] || 0) + (counts['상관'] || 0),
      '재성(재물)': (counts['편재'] || 0) + (counts['정재'] || 0),
      '관성(직업)': (counts['편관'] || 0) + (counts['정관'] || 0),
      '인성(학문)': (counts['편인'] || 0) + (counts['정인'] || 0)
    };

    // 가장 강한 십성 그룹
    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0];
    const weakest = sorted.filter(s => s[1] === 0).map(s => s[0]);

    // 간이 격국 판단 (월지 정기 기준)
    const monthBranch = pillars.month.jiji;
    const monthMainStem = {
      '子': '癸', '丑': '己', '寅': '甲', '卯': '乙', '辰': '戊', '巳': '丙',
      '午': '丁', '未': '己', '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
    }[monthBranch];
    const monthTenGod = monthMainStem ? getTenGod(dayMaster, monthMainStem, true) : '';

    const geukgukMap = {
      '비견': '비견격 — 자립심 강한 독립형',
      '겁재': '겁재격 — 경쟁심 강한 도전형',
      '식신': '식신격 — 재능 풍부한 표현형',
      '상관': '상관격 — 창의적이고 자유분방',
      '편재': '편재격 — 사업수완, 큰 재물 감각',
      '정재': '정재격 — 꾸준한 저축형 재물',
      '편관': '편관격 — 권위와 추진력',
      '정관': '정관격 — 안정적 직장인형',
      '편인': '편인격 — 독창적 사고, 전문 분야',
      '정인': '정인격 — 학문·교육 중시, 모범형'
    };

    return {
      counts,
      groups,
      dominant: dominant ? { name: dominant[0], count: dominant[1] } : null,
      weakest,
      geukguk: monthTenGod ? { tenGod: monthTenGod, description: geukgukMap[monthTenGod] || monthTenGod + '격' } : null
    };
  }

  // ============================================================
  // 신살/길성 확장 (귀인, 살, 록)
  // ============================================================

  function checkSpecialStars(pillars) {
    const stars = [];
    const dayStem = pillars.day.cheongan;
    const dayBranch = pillars.day.jiji;
    const allStems = [pillars.year.cheongan, pillars.month.cheongan, pillars.day.cheongan];
    const allBranches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji];
    if (pillars.hour) {
      allStems.push(pillars.hour.cheongan);
      allBranches.push(pillars.hour.jiji);
    }

    // 도화살 (일지 기준)
    const doHwaMap = {
      '寅': '卯', '午': '卯', '戌': '卯',
      '巳': '午', '酉': '午', '丑': '午',
      '申': '酉', '子': '酉', '辰': '酉',
      '亥': '子', '卯': '子', '未': '子'
    };
    if (doHwaMap[dayBranch] && allBranches.includes(doHwaMap[dayBranch])) {
      stars.push({ name: '도화살', meaning: '이성에게 매력적, 연애 기운 강함', type: '살' });
    }

    // 홍염살 (일간 기준)
    const hongYeomMap = {
      '甲': '午', '乙': '申', '丙': '寅', '丁': '未', '戊': '辰',
      '己': '辰', '庚': '戌', '辛': '酉', '壬': '子', '癸': '申'
    };
    if (hongYeomMap[dayStem] && allBranches.includes(hongYeomMap[dayStem])) {
      stars.push({ name: '홍염살', meaning: '강렬한 매력, 깊은 사랑 경험', type: '살' });
    }

    // 역마살 (일지 기준)
    const yeokmaMap = {
      '寅': '申', '午': '申', '戌': '申',
      '巳': '亥', '酉': '亥', '丑': '亥',
      '申': '寅', '子': '寅', '辰': '寅',
      '亥': '巳', '卯': '巳', '未': '巳'
    };
    if (yeokmaMap[dayBranch] && allBranches.includes(yeokmaMap[dayBranch])) {
      stars.push({ name: '역마살', meaning: '이동, 변화, 해외 인연', type: '살' });
    }

    // 양인살 (일간 기준, 양간만 해당)
    const yangInMap = { '甲': '卯', '丙': '午', '戊': '午', '庚': '酉', '壬': '子' };
    if (yangInMap[dayStem] && allBranches.includes(yangInMap[dayStem])) {
      stars.push({ name: '양인살', meaning: '강한 추진력, 과감한 결단력. 통제 필요', type: '살' });
    }

    // 천을귀인 (일간 기준, 가장 중요한 길성)
    const cheonEulMap = {
      '甲': ['丑','未'], '戊': ['丑','未'], '庚': ['丑','未'],
      '乙': ['子','申'], '己': ['子','申'],
      '丙': ['酉','亥'], '丁': ['酉','亥'],
      '壬': ['卯','巳'], '癸': ['卯','巳'],
      '辛': ['寅','午']
    };
    const ceTargets = cheonEulMap[dayStem] || [];
    if (ceTargets.some(t => allBranches.includes(t))) {
      stars.push({ name: '천을귀인', meaning: '위기에 귀인의 도움, 사회적 인복', type: '귀인' });
    }

    // 문창귀인 (일간 기준)
    const munChangMap = { '甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申', '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯' };
    if (munChangMap[dayStem] && allBranches.includes(munChangMap[dayStem])) {
      stars.push({ name: '문창귀인', meaning: '학문 재능, 시험운, 문서운 좋음', type: '귀인' });
    }

    // 천덕귀인 (월지 기준)
    const cheonDeokMap = { '寅': '丁', '卯': '申', '辰': '壬', '巳': '辛', '午': '亥', '未': '甲', '申': '癸', '酉': '寅', '戌': '丙', '亥': '乙', '子': '巳', '丑': '庚' };
    const cdTarget = cheonDeokMap[pillars.month.jiji];
    if (cdTarget && (allStems.includes(cdTarget) || allBranches.includes(cdTarget))) {
      stars.push({ name: '천덕귀인', meaning: '하늘의 덕, 재난 면함, 선한 성품', type: '귀인' });
    }

    // 월덕귀인 (월지 기준)
    const wolDeokMap = { '寅': '丙', '午': '丙', '戌': '丙', '申': '壬', '子': '壬', '辰': '壬', '巳': '庚', '酉': '庚', '丑': '庚', '亥': '甲', '卯': '甲', '未': '甲' };
    const wdTarget = wolDeokMap[pillars.month.jiji];
    if (wdTarget && allStems.includes(wdTarget)) {
      stars.push({ name: '월덕귀인', meaning: '매달 복이 따름, 관재·질병 면함', type: '귀인' });
    }

    // 건록 (일간 기준)
    const geonRokMap = { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' };
    if (geonRokMap[dayStem] && allBranches.includes(geonRokMap[dayStem])) {
      stars.push({ name: '건록', meaning: '자수성가, 독립적 성공, 안정적 재물', type: '록' });
    }

    // 학당귀인 (일간 기준)
    const hakDangMap = { '甲': '亥', '乙': '亥', '丙': '寅', '丁': '寅', '戊': '寅', '己': '寅', '庚': '巳', '辛': '巳', '壬': '申', '癸': '申' };
    if (hakDangMap[dayStem] && allBranches.includes(hakDangMap[dayStem])) {
      stars.push({ name: '학당귀인', meaning: '학문·연구 능력 우수, 지적 호기심', type: '귀인' });
    }

    // 금여록 (일간 기준)
    const geumYeoMap = { '甲': '辰', '乙': '巳', '丙': '未', '丁': '申', '戊': '未', '己': '申', '庚': '戌', '辛': '亥', '壬': '丑', '癸': '寅' };
    if (geumYeoMap[dayStem] && allBranches.includes(geumYeoMap[dayStem])) {
      stars.push({ name: '금여록', meaning: '배우자 복, 결혼 후 안정, 이성 인연 좋음', type: '귀인' });
    }

    // 태극귀인 (일간 기준)
    const taeGeukMap = {
      '甲': ['子','午'], '己': ['子','午'],
      '乙': ['卯','酉'], '庚': ['卯','酉'],
      '丙': ['丑','未'], '辛': ['丑','未'],
      '丁': ['寅','申'], '壬': ['寅','申'],
      '戊': ['巳','亥'], '癸': ['巳','亥']
    };
    if ((taeGeukMap[dayStem] || []).some(t => allBranches.includes(t))) {
      stars.push({ name: '태극귀인', meaning: '큰 일을 이루는 기운, 위기를 기회로 바꿈', type: '귀인' });
    }

    // 삼기귀인 (천간 3연속: 甲戊庚/乙丙丁/壬癸辛)
    const samgiSets = [['甲','戊','庚'], ['乙','丙','丁'], ['壬','癸','辛']];
    samgiSets.forEach(set => {
      if (set.every(s => allStems.includes(s))) {
        stars.push({ name: '삼기귀인', meaning: '하늘이 내린 세 가지 기운, 비범한 재능', type: '귀인' });
      }
    });

    // 천관귀인 (일간 기준)
    const cheonGwanMap = { '甲': '未', '乙': '辰', '丙': '酉', '丁': '亥', '戊': '酉', '己': '亥', '庚': '丑', '辛': '寅', '壬': '卯', '癸': '巳' };
    if (cheonGwanMap[dayStem] && allBranches.includes(cheonGwanMap[dayStem])) {
      stars.push({ name: '천관귀인', meaning: '관직·승진운, 사회적 지위 상승', type: '귀인' });
    }

    // 천주귀인 (일간 기준)
    const cheonJuMap = { '甲': '酉', '乙': '申', '丙': '子', '丁': '亥', '戊': '子', '己': '亥', '庚': '卯', '辛': '寅', '壬': '午', '癸': '巳' };
    if (cheonJuMap[dayStem] && allBranches.includes(cheonJuMap[dayStem])) {
      stars.push({ name: '천주귀인', meaning: '주방·요리·음식 관련 재능, 먹고사는 복', type: '귀인' });
    }

    // 천의성 (일간 기준)
    const cheonUiMap = { '甲': '丑', '乙': '子', '丙': '卯', '丁': '寅', '戊': '卯', '己': '寅', '庚': '巳', '辛': '辰', '壬': '未', '癸': '午' };
    if (cheonUiMap[dayStem] && allBranches.includes(cheonUiMap[dayStem])) {
      stars.push({ name: '천의성', meaning: '의학·치유 재능, 건강 관련 직업 적성', type: '성' });
    }

    // 천문성 (일간 기준) — 학문·연구의 별
    const cheonMunMap = { '甲': '亥', '乙': '子', '丙': '寅', '丁': '卯', '戊': '寅', '己': '卯', '庚': '巳', '辛': '午', '壬': '申', '癸': '酉' };
    if (cheonMunMap[dayStem] && allBranches.includes(cheonMunMap[dayStem])) {
      stars.push({ name: '천문성', meaning: '학문·철학·종교에 깊은 관심, 정신세계 발달', type: '성' });
    }

    // 괴강살 (일주 기준: 戊辰, 壬辰, 庚辰, 庚戌)
    const gwaeGangPairs = ['戊辰', '壬辰', '庚辰', '庚戌'];
    if (gwaeGangPairs.includes(dayStem + dayBranch)) {
      stars.push({ name: '괴강살', meaning: '강한 카리스마와 결단력, 리더십. 극과 극의 성격', type: '살' });
    }

    // 백호살 (일지 기준)
    const baekHoMap = {
      '寅': '申', '卯': '辰', '辰': '寅', '巳': '酉', '午': '戌', '未': '丑',
      '申': '寅', '酉': '巳', '戌': '午', '亥': '未', '子': '午', '丑': '未'
    };
    if (baekHoMap[dayBranch] && allBranches.includes(baekHoMap[dayBranch])) {
      stars.push({ name: '백호살', meaning: '외과수술, 유혈사고 주의. 의료·군·경 적성', type: '살' });
    }

    // 고신살 (년지 기준) — 외로움의 살
    const goSinMap = { '寅': '巳', '卯': '巳', '辰': '巳', '巳': '申', '午': '申', '未': '申', '申': '亥', '酉': '亥', '戌': '亥', '亥': '寅', '子': '寅', '丑': '寅' };
    if (goSinMap[pillars.year.jiji] && allBranches.includes(goSinMap[pillars.year.jiji])) {
      stars.push({ name: '고신살', meaning: '홀로 있는 시간이 많음, 독립적 성향', type: '살' });
    }

    // 과숙살 (년지 기준) — 외로움의 살 (고신살의 짝)
    const gwaSukMap = { '寅': '丑', '卯': '丑', '辰': '丑', '巳': '辰', '午': '辰', '未': '辰', '申': '未', '酉': '未', '戌': '未', '亥': '戌', '子': '戌', '丑': '戌' };
    if (gwaSukMap[pillars.year.jiji] && allBranches.includes(gwaSukMap[pillars.year.jiji])) {
      stars.push({ name: '과숙살', meaning: '배우자와 인연이 늦거나 고독한 시기 존재', type: '살' });
    }

    // 현침살 (일간 기준) — 기술·예술의 살
    const hyunChimMap = { '甲': '酉', '乙': '申', '丙': '亥', '丁': '亥', '戊': '亥', '己': '亥', '庚': '寅', '辛': '寅', '壬': '巳', '癸': '巳' };
    if (hyunChimMap[dayStem] && allBranches.includes(hyunChimMap[dayStem])) {
      stars.push({ name: '현침살', meaning: '손재주·기술·예술 재능. 침술·바느질·공예 적성', type: '살' });
    }

    // 원진살 (일지 기준) — 인간관계 갈등
    const wonJinMap = { '子': '未', '丑': '午', '寅': '巳', '卯': '辰', '辰': '卯', '巳': '寅', '午': '丑', '未': '子', '申': '亥', '酉': '戌', '戌': '酉', '亥': '申' };
    if (wonJinMap[dayBranch] && allBranches.includes(wonJinMap[dayBranch])) {
      stars.push({ name: '원진살', meaning: '가까운 사이에서 갈등, 미워하면서 끌리는 관계', type: '살' });
    }

    // 공망 (일주 기준, 갑자순 10간 배열에서 빠진 2지지)
    const dayPillarIdx = (CHEONGAN.indexOf(dayStem) + JIJI.indexOf(dayBranch) * 0) || 0;
    // 60갑자에서 일주 위치 찾기
    const stemIdx = CHEONGAN.indexOf(dayStem);
    const branchIdx = JIJI.indexOf(dayBranch);
    // 갑자순 시작점: 일간 인덱스만큼 뒤로 가면 해당 순의 甲 위치
    const gongBranch1 = JIJI[(branchIdx - stemIdx + 10 + 12) % 12];
    const gongBranch2 = JIJI[(branchIdx - stemIdx + 11 + 12) % 12];
    if (allBranches.includes(gongBranch1) || allBranches.includes(gongBranch2)) {
      const gongList = [gongBranch1, gongBranch2].filter(g => allBranches.includes(g));
      stars.push({ name: '공망', meaning: '비어있는 기운 (' + gongList.join(',') + '). 해당 영역 허무감, 반전의 기회', type: '살' });
    }

    // 관귀학관 (일간 기준) — 학문 관직의 별
    const gwanGwiMap = { '甲': '午', '乙': '巳', '丙': '寅', '丁': '卯', '戊': '寅', '己': '卯', '庚': '亥', '辛': '子', '壬': '申', '癸': '酉' };
    if (gwanGwiMap[dayStem] && allBranches.includes(gwanGwiMap[dayStem])) {
      stars.push({ name: '관귀학관', meaning: '관직·학업에서 높은 성취, 고시·공직 적성', type: '귀인' });
    }

    // 암록 (일간의 건록이 지장간에 숨어있는 경우)
    const amRokTargets = geonRokMap[dayStem];
    if (amRokTargets) {
      // 사주 내 지지의 지장간에 건록 지지가 포함되어 있는지 확인
      const jijangganAll = [];
      allBranches.forEach(b => {
        const info = jijiData.find(j => j.name === b);
        if (info && info.jijanggan) jijangganAll.push(...info.jijanggan);
      });
      const rokStem = dayStem; // 건록은 일간과 같은 천간이 정기인 지지
      if (jijangganAll.includes(rokStem) && !allBranches.includes(amRokTargets)) {
        stars.push({ name: '암록', meaning: '숨겨진 재물복, 드러나지 않는 도움', type: '록' });
      }
    }

    // 화개살 (년지 기준) — 예술·종교·고독의 별
    const hwaGaeMap = {
      '寅': '戌', '午': '戌', '戌': '戌',
      '巳': '丑', '酉': '丑', '丑': '丑',
      '申': '辰', '子': '辰', '辰': '辰',
      '亥': '未', '卯': '未', '未': '未'
    };
    if (hwaGaeMap[pillars.year.jiji] && allBranches.includes(hwaGaeMap[pillars.year.jiji])) {
      stars.push({ name: '화개살', meaning: '예술·종교·철학 재능, 고독한 탐구자', type: '성' });
    }

    // 장성살 (년지 기준) — 리더십의 별
    const jangSungMap = {
      '寅': '巳', '午': '巳', '戌': '巳',
      '巳': '申', '酉': '申', '丑': '申',
      '申': '亥', '子': '亥', '辰': '亥',
      '亥': '寅', '卯': '寅', '未': '寅'
    };
    // 장성은 12신살에서 이미 계산하므로 여기서는 년지에 직접 있는 경우만
    // (12신살과 중복 방지를 위해 별도 체크 불필요 — 12신살에서 커버)

    return stars;
  }

  // ============================================================
  // 12신살 — 일지 기준, 각 기둥 지지별 판정
  // ============================================================

  const TWELVE_SINSAL_NAMES = ['겁살','재살','천살','지살','년살','월살','망신살','장성살','반안살','역마살','육해살','화개살'];
  const SINSAL_ORDER = ['巳','午','未','申','酉','戌','亥','子','丑','寅','卯','辰']; // 申子辰 그룹 기준 겁살→화개살 순서

  // 삼합 그룹별 겁살 시작 지지 (SINSAL_ORDER 기준 오프셋)
  const SINSAL_START = {
    '申': 0, '子': 0, '辰': 0,  // 巳부터
    '寅': 6, '午': 6, '戌': 6,  // 亥부터
    '巳': 9, '酉': 9, '丑': 9,  // 寅부터
    '亥': 3, '卯': 3, '未': 3   // 申부터
  };

  function calculateTwelveSinsal(pillars) {
    const baseBranch = pillars.year.jiji; // 년지 기준 (전통 표준)
    const startOffset = SINSAL_START[baseBranch];
    if (startOffset === undefined) return {};

    // 지지 → 신살 매핑 테이블 구축 (SINSAL_ORDER 사용)
    const branchToSinsal = {};
    for (let i = 0; i < 12; i++) {
      const orderIdx = (startOffset + i) % 12;
      branchToSinsal[SINSAL_ORDER[orderIdx]] = TWELVE_SINSAL_NAMES[i];
    }

    // 각 기둥 지지에 해당하는 신살
    const result = {};
    const positions = [
      { key: 'year', branch: pillars.year.jiji },
      { key: 'month', branch: pillars.month.jiji },
      { key: 'day', branch: pillars.day.jiji }
    ];
    if (pillars.hour) positions.push({ key: 'hour', branch: pillars.hour.jiji });

    positions.forEach(pos => {
      result[pos.key] = branchToSinsal[pos.branch] || '';
    });
    return result;
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  function getCheonganInfo(char) {
    return cheonganData.find(c => c.name === char) || { korean: char, meaning: '' };
  }

  function getJijiInfo(char) {
    return jijiData.find(j => j.name === char) || { korean: char, animal: '' };
  }

  async function loadData() {
    try {
      const [cRes, jRes, sRes] = await Promise.all([
        fetch('data/cheongan.json'),
        fetch('data/jiji.json'),
        fetch('data/sipsung.json')
      ]);
      cheonganData = await cRes.json();
      jijiData = await jRes.json();
      sipsungData = await sRes.json();
    } catch (e) {
      console.error('사주 데이터 로드 실패:', e);
    }
  }

  // ============================================================
  // 메인 분석 함수
  // ============================================================

  function analyze(birthDate, gender, birthTime) {
    const [year, month, day] = birthDate.split('-').map(Number);

    const yearPillar = getYearPillar(year, month, day);
    const monthPillar = getMonthPillar(yearPillar.stemIndex, year, month, day);
    const dayPillar = getDayPillar(year, month, day);
    let hourPillar = null;
    if (birthTime) {
      const [h, m] = birthTime.split(':').map(Number);
      // 지역시(진태양시) 보정: 한국 표준시(135°E) → 서울 기준(127°E) ≈ -30분
      const corrected = h * 60 + m - 30;
      const adjMin = corrected >= 0 ? corrected : corrected + 1440;
      hourPillar = getHourPillar(dayPillar.stemIndex, Math.floor(adjMin / 60), adjMin % 60);
    }

    const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };
    const dayMaster = dayPillar.cheongan;
    const dayMasterInfo = getCheonganInfo(dayMaster);

    const elements = calculateElements(pillars);
    const jijangganElements = calculateJijangganElements(pillars);
    const jijangganDetail = getJijangganDetail(pillars);
    const tenGods = calculateTenGods(dayMaster, pillars);
    const twelveStages = calculateTwelveStages(dayMaster, pillars);
    const strength = determineStrength(dayMaster, elements, jijangganElements, twelveStages);
    const specialStars = checkSpecialStars(pillars);
    const chung = checkChung(pillars);
    const hap = checkHap(pillars);
    const seun = calculateSeun(dayMaster, pillars);
    const daeun = calculateDaeun(birthDate, gender, yearPillar, monthPillar);
    const twelveSinsal = calculateTwelveSinsal(pillars);
    const tenGodStats = analyzeTenGodStats(tenGods, dayMaster, pillars);

    return {
      pillars,
      dayMaster,
      dayMasterElement: CHEONGAN_ELEMENT[dayMaster],
      dayMasterYinYang: CHEONGAN_YINYANG[dayMaster],
      dayMasterInfo,
      elements,
      jijangganElements,
      jijangganDetail,
      tenGods,
      twelveStages,
      twelveSinsal,
      tenGodStats,
      strength,
      specialStars,
      chung,
      hap,
      seun,
      daeun,
      gender,
      hasHourPillar: !!hourPillar,
      summary: buildSummary(pillars, dayMaster, elements, jijangganElements, strength, specialStars, chung, hap, seun, daeun, twelveStages, hourPillar, twelveSinsal, tenGodStats)
    };
  }

  // ============================================================
  // AI 프롬프트용 요약 (전면 강화)
  // ============================================================

  function buildSummary(pillars, dayMaster, elements, jijangganElements, strength, specialStars, chung, hap, seun, daeun, twelveStages, hourPillar, twelveSinsal, tenGodStats) {
    const yi = getCheonganInfo(pillars.year.cheongan);
    const yj = getJijiInfo(pillars.year.jiji);
    const mi = getCheonganInfo(pillars.month.cheongan);
    const mj = getJijiInfo(pillars.month.jiji);
    const di = getCheonganInfo(pillars.day.cheongan);
    const dj = getJijiInfo(pillars.day.jiji);

    let text = `년주: ${pillars.year.cheongan}${pillars.year.jiji} (${yi.korean}${yj.korean})\n`;
    text += `월주: ${pillars.month.cheongan}${pillars.month.jiji} (${mi.korean}${mj.korean})\n`;
    text += `일주: ${pillars.day.cheongan}${pillars.day.jiji} (${di.korean}${dj.korean})\n`;

    if (hourPillar) {
      const hi = getCheonganInfo(pillars.hour.cheongan);
      const hj = getJijiInfo(pillars.hour.jiji);
      text += `시주: ${pillars.hour.cheongan}${pillars.hour.jiji} (${hi.korean}${hj.korean})\n`;
    } else {
      text += `시주: 미상\n`;
    }

    // 절기 기준 생월 (조후 판단용)
    const sajuMonth = pillars.month.sajuMonth;
    const seasonMap = { 1: '초봄(인월)', 2: '봄(묘월)', 3: '늦봄(진월)', 4: '초여름(사월)', 5: '여름(오월)', 6: '늦여름(미월)', 7: '초가을(신월)', 8: '가을(유월)', 9: '늦가을(술월)', 10: '초겨울(해월)', 11: '겨울(자월)', 12: '늦겨울(축월)' };
    text += `\n절기 생월: ${sajuMonth}월 — ${seasonMap[sajuMonth] || sajuMonth + '월'}\n`;
    text += `일간(나): ${dayMaster} (${CHEONGAN_ELEMENT[dayMaster]}/${CHEONGAN_YINYANG[dayMaster]}, ${di.meaning})\n`;

    // 각 기둥 오행/음양 상세
    const pillarList = [
      { name: '년', p: pillars.year },
      { name: '월', p: pillars.month },
      { name: '일', p: pillars.day }
    ];
    if (hourPillar) pillarList.push({ name: '시', p: pillars.hour });
    text += `기둥 오행/음양: ${pillarList.map(x =>
      `${x.name}간=${x.p.cheongan}(${CHEONGAN_ELEMENT[x.p.cheongan]}/${CHEONGAN_YINYANG[x.p.cheongan]}) ${x.name}지=${x.p.jiji}(${JIJI_ELEMENT[x.p.jiji]}/${JIJI_YINYANG[x.p.jiji]})`
    ).join(', ')}\n`;

    text += `오행(표면): 목${elements['목']} 화${elements['화']} 토${elements['토']} 금${elements['금']} 수${elements['수']}\n`;
    text += `오행(지장간): 목${jijangganElements['목']} 화${jijangganElements['화']} 토${jijangganElements['토']} 금${jijangganElements['금']} 수${jijangganElements['수']}\n`;
    text += `신강/신약: ${strength}\n`;

    // 지장간 상세
    const jijangganDetail = getJijangganDetail(pillars);
    if (jijangganDetail.length > 0) {
      text += `지장간: ${jijangganDetail.map(j => `${j.position}(${j.branch})=[${j.stems.join(',')}]`).join(', ')}\n`;
    }

    // 12신살 (년지 기준)
    if (twelveSinsal && Object.keys(twelveSinsal).length > 0) {
      const sinsalMap = { year: '년지', month: '월지', day: '일지', hour: '시지' };
      text += `12신살(년지기준): ${Object.entries(twelveSinsal).map(([k, v]) => `${sinsalMap[k]}=${v}`).join(', ')}\n`;
    }

    // 십성 배치 (궁성 포함)
    const tenGods = calculateTenGods(dayMaster, pillars);
    const gungMap = { '년간': '조상궁', '년지': '조상궁', '월간': '부모궁/사회궁', '월지': '부모궁/사회궁', '일지': '배우자궁', '시간': '자녀궁', '시지': '자녀궁' };
    text += `십성(궁성): ${tenGods.map(t => `${t.position}(${gungMap[t.position] || ''})=${t.tenGod}`).join(', ')}\n`;

    // 12운성
    if (twelveStages && twelveStages.length > 0) {
      text += `12운성: ${twelveStages.map(ts => `${ts.position}=${ts.stage}`).join(', ')}\n`;
    }

    // 신살/길성
    if (specialStars.length > 0) {
      const guiin = specialStars.filter(s => s.type === '귀인' || s.type === '록');
      const sal = specialStars.filter(s => s.type === '살');
      if (guiin.length > 0) {
        text += `길성(귀인/록): ${guiin.map(s => `${s.name}(${s.meaning})`).join(', ')}\n`;
      }
      if (sal.length > 0) {
        text += `흉살: ${sal.map(s => `${s.name}(${s.meaning})`).join(', ')}\n`;
      }
    }

    // 십성 집계 + 격국
    if (tenGodStats) {
      const gc = tenGodStats.groups;
      text += `\n【십성 분포】 ${Object.entries(gc).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
      if (tenGodStats.dominant) text += `  최강: ${tenGodStats.dominant.name}(${tenGodStats.dominant.count}개)\n`;
      if (tenGodStats.weakest.length > 0) text += `  부재: ${tenGodStats.weakest.join(', ')}\n`;
      if (tenGodStats.geukguk) text += `  격국: ${tenGodStats.geukguk.description}\n`;
    }

    // 충
    if (chung && chung.length > 0) {
      text += `\n【충(冲)】 ${chung.map(c => c.pair).join(', ')}\n`;
      chung.forEach(c => { text += `  ${c.meaning}\n`; });
    }

    // 합
    if (hap) {
      if (hap.samhap.length > 0) {
        hap.samhap.forEach(s => { text += `【삼합】 ${s.branches.join('')} → ${s.name}: ${s.meaning}\n`; });
      }
      if (hap.banhap.length > 0) {
        hap.banhap.forEach(s => { text += `【반합】 ${s.branches.join('')} → ${s.name}: ${s.meaning}\n`; });
      }
      if (hap.yukhap.length > 0) {
        hap.yukhap.forEach(y => { text += `【육합】 ${y.pair} → ${y.element}(${y.meaning})\n`; });
      }
    }

    // 세운
    if (seun) {
      text += `\n【${seun.year}년 세운】 ${seun.stem}${seun.branch} (${seun.stemElement}${seun.branchElement})\n`;
      text += `  세운 천간 ${seun.stem} → ${seun.stemTenGod} / 세운 지지 ${seun.branch} → ${seun.branchTenGod}\n`;
      if (seun.chung.length > 0) text += `  세운 충: ${seun.chung.map(c => `${seun.branch}-${c.branch}`).join(', ')}\n`;
      if (seun.hap.length > 0) text += `  세운 합: ${seun.hap.map(h => `${seun.branch}-${h.branch}(${h.element})`).join(', ')}\n`;
    }

    // 대운
    if (daeun) {
      text += `\n【대운】 ${daeun.direction}, ${daeun.startAge}세 시작\n`;
      if (daeun.current) {
        text += `  현재 대운: ${daeun.current.stem}${daeun.current.branch} (${daeun.current.stemElement}${daeun.current.branchElement}) [${daeun.current.ageRange}]\n`;
      }
      text += `  흐름: ${daeun.list.slice(0, 5).map(d => `${d.stem}${d.branch}(${d.ageRange})`).join(' → ')}\n`;
    }

    return text;
  }

  return { loadData, analyze, CHEONGAN_YINYANG, JIJI_YINYANG, CHEONGAN_ELEMENT, JIJI_ELEMENT };
})();
