/**
 * 환경 설정 (config.js)
 *
 * - API 프록시: /api/interpret (Cloudflare Pages Functions)
 *   OpenRouter API 키는 서버 측 환경변수로 관리 (클라이언트 노출 없음)
 * - bkend.ai: pk_ 공개키 (클라이언트용, CORS 도메인 제한으로 보호)
 */
window.__CONFIG__ = {
  API_PROXY_URL: '/api/interpret',
  BKEND_API_KEY: 'pk_e8b0d45ac445aac5916e89561bb180a1b2ec5697a4b9ac8d43bdffbe21877a82',
  BKEND_API_URL: 'https://api-client.bkend.ai'
};
// .env fetch 제거 -- API 키는 서버 프록시가 관리
window.__CONFIG_READY__ = Promise.resolve();

// 주제 목록 (7개 중 3개 선택)
window.__TOPICS__ = [
  { id: 'love',    name: '연애운',   emoji: '💞', placeholder: '예: 짝사랑 중인데 고백해도 될까요?' },
  { id: 'wealth',  name: '재물운',   emoji: '💰', placeholder: '예: 주식에 투자해도 괜찮을까요?' },
  { id: 'general', name: '종합운세', emoji: '🌏', placeholder: '예: 올해 전반적으로 어떤 해가 될까요?' },
  { id: 'career',  name: '직업운',   emoji: '🏆', placeholder: '예: 이직을 고민 중인데 어떨까요?' },
  { id: 'health',  name: '건강운',   emoji: '🏥', placeholder: '예: 요즘 피로가 심한데 괜찮을까요?' },
  { id: 'study',   name: '학업운',   emoji: '📚', placeholder: '예: 시험 준비가 잘 될까요?' },
  { id: 'social',  name: '대인관계', emoji: '🤝', placeholder: '예: 친구와 갈등이 있는데 어떻게 할까요?' }
];
