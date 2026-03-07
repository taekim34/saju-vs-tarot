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
