/**
 * 공유 기능 (share.js)
 *
 * X(Twitter) 공유 + URL 복사
 */

const ShareManager = (() => {
  let resultData = null;
  let savedId = null;  // bkend에 저장된 ID

  /**
   * 결과 데이터 설정
   */
  function setResult(data) {
    resultData = data;
    savedId = null;  // 새 결과 시 리셋
  }

  /**
   * bkend에 결과 저장 → 공유 URL 생성
   */
  async function getShareUrl() {
    const base = window.location.href.split('?')[0];
    if (!resultData) return base;

    // 이미 저장된 ID가 있으면 재사용
    if (savedId) return `${base}?id=${savedId}`;

    try {
      const id = await BkendClient.saveResult({
        winner: resultData.winner,
        scores: `${resultData.voteDetail.saju}-${resultData.voteDetail.tarot}`,
        rounds: (resultData.rounds || []).map(r => ({
          topic: r.topic,
          vote: r.vote,
          sajuReading: r.sajuReading || '',
          tarotReading: r.tarotReading || ''
        })),
        birth_info: resultData.birth_info || '',
        question: resultData.question || '',
        judgment: resultData.judgment || ''
      });
      savedId = id;
      return `${base}?id=${id}`;
    } catch (e) {
      console.error('결과 저장 실패, 폴백 URL 사용:', e);
      // 폴백: 기존 방식
      const params = new URLSearchParams({
        w: resultData.winner,
        s: `${resultData.voteDetail.saju}-${resultData.voteDetail.tarot}`
      });
      return `${base}?${params.toString()}`;
    }
  }

  /**
   * 공유 텍스트 생성
   */
  function getShareText() {
    if (!resultData) return '사주 vs 타로 운명의 대결!';

    const winnerName = resultData.winner === 'saju' ? '사주' : '타로';
    return `사주 vs 타로 운명의 대결! ${winnerName} 승! (${resultData.voteDetail.saju}:${resultData.voteDetail.tarot}) 나의 운세를 확인해보세요!`;
  }

  /**
   * 플랫폼별 공유
   */
  async function share(platform) {
    const url = await getShareUrl();
    const text = getShareText();

    switch (platform) {
      case 'twitter':
        shareTwitter(url, text);
        break;
      case 'copy':
        await copyUrl(url);
        break;
    }
  }

  /**
   * 트위터(X) 공유
   */
  function shareTwitter(url, text) {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  }

  /**
   * URL 복사
   */
  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL이 복사되었습니다!');
    } catch {
      // 폴백: execCommand
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('URL이 복사되었습니다!');
    }
  }

  /**
   * 토스트 메시지
   */
  function showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.95); color: #1a1a2e;
      padding: 12px 24px; border-radius: 25px;
      font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      z-index: 10000; animation: fade-in 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  return {
    setResult,
    share,
    getShareUrl,
    getShareText
  };
})();
