/**
 * bkend.ai REST API 클라이언트 (bkend-client.js)
 *
 * 배틀 결과를 저장하고 조회하는 wrapper
 * - saveResult(data) → POST → 생성된 레코드 ID 반환
 * - getResult(id)    → GET  → 저장된 결과 조회
 */
const BkendClient = (() => {
  function getConfig() {
    const cfg = window.__CONFIG__ || {};
    return {
      apiKey: cfg.BKEND_API_KEY || '',
      baseUrl: cfg.BKEND_API_URL || 'https://api-client.bkend.ai'
    };
  }

  async function saveResult(data) {
    const { apiKey, baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/data/battle_results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        winner: data.winner,
        scores: data.scores,
        rounds: data.rounds || [],
        birth_info: data.birth_info,
        question: data.question || '',
        judgment: data.judgment || ''
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('bkend save error:', response.status, errText);
      throw new Error(`bkend save failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data ? result.data.id : result.id;
  }

  async function getResult(id) {
    const { apiKey, baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/data/battle_results/${id}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      console.error('bkend get error:', response.status);
      return null;
    }

    const result = await response.json();
    return result.data || result;
  }

  async function listResults(limit = 100, offset = 0) {
    const { apiKey, baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/data/battle_results?limit=${limit}&offset=${offset}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      console.error('bkend list error:', response.status);
      return [];
    }

    const result = await response.json();
    const data = result.data || result;
    return data.items || data || [];
  }

  /**
   * 통계 전용 경량 레코드 저장
   */
  async function saveStat(data) {
    const { apiKey, baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/data/battle_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        winner: data.winner,
        gender: data.gender || '',
        birth_year: data.birth_year || 0,
        r1_vote: data.r1_vote || '',
        r2_vote: data.r2_vote || '',
        r3_vote: data.r3_vote || ''
      })
    });

    if (!response.ok) {
      console.error('bkend saveStat error:', response.status);
      return null;
    }

    const result = await response.json();
    return result.data ? result.data.id : result.id;
  }

  /**
   * 서버 측 카운트 쿼리 — limit=1로 요청, pagination.total만 사용
   * @param {Object} filters - andFilters 조건 (빈 객체면 전체 카운트)
   * @returns {number}
   */
  async function countStats(filters = {}) {
    const { apiKey, baseUrl } = getConfig();
    const params = new URLSearchParams({ limit: '1' });
    if (Object.keys(filters).length > 0) {
      params.set('andFilters', JSON.stringify(filters));
    }

    const response = await fetch(`${baseUrl}/v1/data/battle_stats?${params}`, {
      headers: { 'X-API-Key': apiKey }
    });

    if (!response.ok) return 0;

    const result = await response.json();
    const pagination = result.data?.pagination || result.pagination;
    return pagination?.total || 0;
  }

  return { saveResult, getResult, listResults, saveStat, countStats };
})();
