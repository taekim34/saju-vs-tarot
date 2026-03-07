/**
 * 음력→양력 변환 모듈 (lunar.js)
 *
 * 표준 중한 음력 데이터 테이블 사용 (1900~2050)
 * 외부 API 없이 순수 로컬 변환
 *
 * 인코딩 규칙 (각 연도별 20-bit hex):
 * - Bits 3-0: 윤달 번호 (0=없음, 1~12)
 * - Bit 16: 윤달이 큰달(30일)이면 1, 작은달(29일)이면 0
 * - Bits 4-15: 1~12월 각각의 대소 (0x10000>>m 에 해당 비트, 1=30일)
 *
 * 기준일: 양력 1900-01-31 = 음력 1900년 1월 1일
 */
const LunarConverter = (() => {
  const BASE_YEAR = 1900;

  // 표준 중한 음력 데이터 (1900~2050, 151개)
  const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, // 1900-1904
    0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1905-1909
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, // 1910-1914
    0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1915-1919
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, // 1920-1924
    0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1925-1929
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, // 1930-1934
    0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1935-1939
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, // 1940-1944
    0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1945-1949
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, // 1950-1954
    0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1955-1959
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, // 1960-1964
    0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1965-1969
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, // 1970-1974
    0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1975-1979
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, // 1980-1984
    0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1985-1989
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, // 1990-1994
    0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1995-1999
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, // 2000-2004
    0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2005-2009
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, // 2010-2014
    0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2015-2019
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, // 2020-2024
    0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2025-2029
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, // 2030-2034
    0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2035-2039
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, // 2040-2044
    0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2045-2049
    0x14b63                                        // 2050
  ];

  /** 해당 연도의 윤달 번호 (0=없음) */
  function leapMonth(y) {
    return LUNAR_INFO[y - BASE_YEAR] & 0xf;
  }

  /** 해당 연도 윤달의 일수 (0, 29, 30) */
  function leapDays(y) {
    if (!leapMonth(y)) return 0;
    return (LUNAR_INFO[y - BASE_YEAR] & 0x10000) ? 30 : 29;
  }

  /** 해당 연도 m월의 일수 (29 또는 30, 윤달 아닌 정상 월) */
  function monthDays(y, m) {
    return (LUNAR_INFO[y - BASE_YEAR] & (0x10000 >> m)) ? 30 : 29;
  }

  /** 해당 음력 연도의 총 일수 */
  function yearDays(y) {
    let sum = 0;
    for (let m = 1; m <= 12; m++) sum += monthDays(y, m);
    sum += leapDays(y);
    return sum;
  }

  /**
   * 음력 → 양력 변환
   * @param {number} lunarYear  음력 연도 (1900~2050)
   * @param {number} lunarMonth 음력 월 (1~12)
   * @param {number} lunarDay   음력 일 (1~30)
   * @param {boolean} isLeap    윤달 여부
   * @returns {{ year, month, day } | null}
   */
  function toSolar(lunarYear, lunarMonth, lunarDay, isLeap = false) {
    // 범위 검증
    if (lunarYear < BASE_YEAR || lunarYear > 2050) return null;
    if (lunarMonth < 1 || lunarMonth > 12) return null;
    if (lunarDay < 1 || lunarDay > 30) return null;

    // 윤달 요청인데 해당 연도에 해당 윤달이 없으면 null
    if (isLeap && leapMonth(lunarYear) !== lunarMonth) return null;

    // 일수 유효성 검증
    if (isLeap) {
      if (lunarDay > leapDays(lunarYear)) return null;
    } else {
      if (lunarDay > monthDays(lunarYear, lunarMonth)) return null;
    }

    // 기준일(1900-01-31)로부터의 총 일수 계산
    let offset = 0;

    // 완료된 연도의 일수 합산
    for (let y = BASE_YEAR; y < lunarYear; y++) {
      offset += yearDays(y);
    }

    // 해당 연도 내 완료된 월의 일수 합산
    const leap = leapMonth(lunarYear);
    for (let m = 1; m < lunarMonth; m++) {
      offset += monthDays(lunarYear, m);
      // 이 월 뒤에 윤달이 오는 경우
      if (leap === m) {
        offset += leapDays(lunarYear);
      }
    }

    // 윤달인 경우: 정상 월 일수를 먼저 더함
    if (isLeap) {
      offset += monthDays(lunarYear, lunarMonth);
    }

    // 해당 월의 일수
    offset += lunarDay - 1;

    // 양력 날짜 계산
    const date = new Date(1900, 0, 31 + offset);

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }

  /**
   * 데이터 로드 (임베디드 데이터이므로 즉시 완료)
   */
  async function loadData() {
    // 데이터가 내장되어 있으므로 별도 로드 불필요
    return true;
  }

  /**
   * 변환 가능 여부 확인
   */
  function isAvailable() {
    return LUNAR_INFO.length > 0;
  }

  /**
   * 해당 연도에 윤달이 있는지 확인
   */
  function getLeapInfo(year) {
    if (year < BASE_YEAR || year > 2050) return null;
    const lm = leapMonth(year);
    if (!lm) return { hasLeap: false };
    return {
      hasLeap: true,
      month: lm,
      days: leapDays(year)
    };
  }

  return { loadData, toSolar, isAvailable, getLeapInfo };
})();
