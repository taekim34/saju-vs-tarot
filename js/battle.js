/**
 * 배틀 엔진 (battle.js)
 *
 * 3라운드 배틀 진행 + 투표 + 점수 계산 + 최종 승자 판정
 */

const BattleEngine = (() => {
  const TOPICS = ['연애운', '재물운', '종합운세'];
  const TOTAL_ROUNDS = 3;

  let currentRound = 0;
  let sajuResult = null;
  let rounds = [];        // 라운드별 결과 저장
  let votes = [];          // 라운드별 투표 저장
  let isProcessing = false;
  let userQuestion = '';   // U2: 자유 질문
  let birthYear = null;    // U3: 시그니피케이터용
  let gender = null;
  let dayMasterElement = null;

  /**
   * 배틀 초기화
   * @param {object} userData - { year, month, day, gender, hour, minute }
   */
  function init(userData) {
    currentRound = 0;
    rounds = [];
    votes = [];
    isProcessing = false;

    // U2: 자유 질문 저장
    userQuestion = userData.question || '';

    // U3: 시그니피케이터용 정보 저장
    birthYear = userData.year;
    gender = userData.gender;

    // 사주 분석 (1회만) — saju.js는 "YYYY-MM-DD" 문자열과 "HH:MM" 문자열을 기대
    const birthDateStr = `${userData.year}-${String(userData.month).padStart(2, '0')}-${String(userData.day).padStart(2, '0')}`;
    const birthTimeStr = userData.hour != null ? `${String(userData.hour).padStart(2, '0')}:${String(userData.minute || 0).padStart(2, '0')}` : null;
    sajuResult = SajuEngine.analyze(birthDateStr, userData.gender, birthTimeStr);

    // U3: 일간 오행 저장
    dayMasterElement = sajuResult.dayMasterElement || null;

    // 타로 덱 초기화 + 셔플
    TarotEngine.initDeck();
  }

  /**
   * 다음 라운드 시작
   * @returns {Promise<object>} 라운드 결과
   */
  async function nextRound() {
    if (isProcessing) return null;
    if (currentRound >= TOTAL_ROUNDS) return null;

    isProcessing = true;
    currentRound++;

    const topic = TOPICS[currentRound - 1];

    // U3: 시그니피케이터 계산 + 타로 드로우
    const significator = TarotEngine.getSignificator(birthYear, gender, topic, dayMasterElement);
    const tarotDraw = TarotEngine.drawForRound(currentRound, significator);

    // AI 해석 요청 (순차) + U2: 질문 전달
    const sajuReading = await AIInterpreter.getSajuReading(sajuResult, topic, sajuResult.gender, userQuestion);
    const tarotReading = await AIInterpreter.getTarotReading(tarotDraw, topic, userQuestion);

    const roundData = {
      round: currentRound,
      topic,
      question: userQuestion || null,  // U2: 사용자 질문 기록
      saju: {
        result: sajuResult,
        reading: sajuReading
      },
      tarot: {
        draw: tarotDraw,
        reading: tarotReading
      },
      vote: null
    };

    rounds.push(roundData);
    isProcessing = false;

    return roundData;
  }

  /**
   * 투표 처리
   * @param {string} choice - 'saju' 또는 'tarot'
   */
  function vote(choice) {
    if (currentRound <= 0 || currentRound > rounds.length) return;

    const roundIndex = currentRound - 1;
    rounds[roundIndex].vote = choice;
    votes.push(choice);
  }

  /**
   * 최종 결과 계산
   * @returns {Promise<object>} 최종 결과
   */
  async function getFinalResult() {
    // 투표 집계
    const sajuVotes = votes.filter(v => v === 'saju').length;
    const tarotVotes = votes.filter(v => v === 'tarot').length;

    // AI 최종 판정
    const aiJudgment = await AIInterpreter.getFinalJudgment(rounds, votes);

    // 종합 점수 계산 (투표 60% + AI 40%)
    const voteScore = {
      saju: sajuVotes / TOTAL_ROUNDS,
      tarot: tarotVotes / TOTAL_ROUNDS
    };

    const aiScore = {
      saju: aiJudgment.winner === 'saju' ? 1 : 0,
      tarot: aiJudgment.winner === 'tarot' ? 1 : 0
    };

    const finalScore = {
      saju: Math.round((voteScore.saju * 60 + aiScore.saju * 40)),
      tarot: Math.round((voteScore.tarot * 60 + aiScore.tarot * 40))
    };

    let winner;
    if (finalScore.saju > finalScore.tarot) {
      winner = 'saju';
    } else if (finalScore.tarot > finalScore.saju) {
      winner = 'tarot';
    } else {
      winner = aiJudgment.winner; // 동점 시 AI 판정 우선
    }

    return {
      winner,
      scores: finalScore,
      voteDetail: { saju: sajuVotes, tarot: tarotVotes },
      aiJudgment,
      rounds,
      message: aiJudgment.message
    };
  }

  /**
   * 현재 진행 상태
   */
  function getStatus() {
    return {
      currentRound,
      totalRounds: TOTAL_ROUNDS,
      isComplete: currentRound >= TOTAL_ROUNDS && votes.length >= TOTAL_ROUNDS,
      isProcessing,
      votes: [...votes]
    };
  }

  return {
    init,
    nextRound,
    vote,
    getFinalResult,
    getStatus,
    TOPICS,
    TOTAL_ROUNDS
  };
})();
