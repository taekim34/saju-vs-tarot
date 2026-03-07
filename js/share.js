/**
 * 공유 기능 (share.js)
 *
 * 결과 카드 이미지 생성 + SNS 공유
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
   * 결과 카드 이미지 생성 (html2canvas)
   */
  async function generateImage() {
    const card = document.getElementById('result-card');
    if (!card) return null;

    // html2canvas CDN 로드 (아직 없다면)
    if (typeof html2canvas === 'undefined') {
      // html2canvas v1.4.1 — 버전 고정 + SRI
      await loadScript(
        'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
        'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H'
      );
    }

    try {
      const canvas = await html2canvas(card, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        useCORS: true,
        logging: false
      });
      return canvas;
    } catch (e) {
      console.error('이미지 생성 실패:', e);
      return null;
    }
  }

  /**
   * 스크립트 동적 로드
   */
  function loadScript(src, integrity = null) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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
        scores: `${resultData.scores.saju}-${resultData.scores.tarot}`,
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
        s: `${resultData.scores.saju}-${resultData.scores.tarot}`
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
    return `사주 vs 타로 운명의 대결! ${winnerName} 승! (${resultData.scores.saju}:${resultData.scores.tarot}) 나의 운세를 확인해보세요!`;
  }

  /**
   * 플랫폼별 공유
   */
  async function share(platform) {
    const url = await getShareUrl();
    const text = getShareText();

    switch (platform) {
      case 'kakao':
        shareKakao(url, text);
        break;
      case 'twitter':
        shareTwitter(url, text);
        break;
      case 'copy':
        await copyUrl(url);
        break;
      case 'download':
        await downloadImage();
        break;
    }
  }

  /**
   * 카카오톡 공유
   */
  function shareKakao(url, text) {
    // Kakao SDK가 없으면 URL 복사로 폴백
    if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
      const kakaoUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}`;
      window.open(kakaoUrl, '_blank', 'width=600,height=400');
      return;
    }

    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '사주 vs 타로 — 운명의 대결',
        description: text,
        imageUrl: '',
        link: { mobileWebUrl: url, webUrl: url }
      },
      buttons: [{
        title: '나도 해보기',
        link: { mobileWebUrl: url, webUrl: url }
      }]
    });
  }

  /**
   * 트위터 공유
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
   * 이미지 다운로드
   */
  async function downloadImage() {
    const canvas = await generateImage();
    if (!canvas) {
      showToast('이미지 생성에 실패했습니다.');
      return;
    }

    const link = document.createElement('a');
    link.download = 'saju-vs-tarot-result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
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
    generateImage,
    share,
    getShareUrl,
    getShareText
  };
})();
