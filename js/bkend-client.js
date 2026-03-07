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

  return { saveResult, getResult };
})();
