/**
 * 배틀 엔진 (battle.js)
 *
 * 3라운드 배틀 진행 + 투표 + 점수 계산 + 최종 승자 판정
 * 주제는 사용자가 7개 중 3개를 선택 (선택 순서 = 배틀 순서)
 */

const BattleEngine = (() => {
  const DEFAULT_TOPICS = ['연애운', '재물운', '종합운세'];
  const TOTAL_ROUNDS = 3;

  let topics = [...DEFAULT_TOPICS];  // 사용자 선택 주제 (동적)
  let currentRound = 0;
  let sajuResult = null;
  let rounds = [];
  let votes = [];
  let isProcessing = false;
  let topicQuestions = {};  // { '연애운': '질문', '직업운': '질문', ... }
  let birthYear = null;
  let birthMonth = null;
  let birthDay = null;
  let gender = null;
  let dayMasterElement = null;

  /**
   * 배틀 초기화
   * @param {object} userData - { year, month, day, gender, hour, minute, topics, questions }
   */
  function init(userData) {
    currentRound = 0;
    rounds = [];
    votes = [];
    isProcessing = false;

    // 동적 주제 설정 (없으면 기본 3개)
    if (userData.topics && userData.topics.length === 3) {
      topics = [...userData.topics];
    } else {
      topics = [...DEFAULT_TOPICS];
    }

    // 주제별 질문 저장
    topicQuestions = userData.questions || {};

    // 시그니피케이터용 정보 저장
    birthYear = userData.year;
    birthMonth = userData.month;
    birthDay = userData.day;
    gender = userData.gender;

    // 사주 분석 (1회만)
    const birthDateStr = `${userData.year}-${String(userData.month).padStart(2, '0')}-${String(userData.day).padStart(2, '0')}`;
    const birthTimeStr = userData.hour != null ? `${String(userData.hour).padStart(2, '0')}:${String(userData.minute || 0).padStart(2, '0')}` : null;
    sajuResult = SajuEngine.analyze(birthDateStr, userData.gender, birthTimeStr);

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

    const topic = topics[currentRound - 1];

    // 시그니피케이터 계산 + 타로 드로우
    const significator = TarotEngine.getSignificator(birthYear, gender, topic, dayMasterElement);
    const tarotDraw = TarotEngine.drawForRound(currentRound, significator);

    // T7~T11: 타로 심화 분석
    const tarotAdvanced = TarotEngine.analyzeAdvanced(tarotDraw, birthYear, birthMonth, birthDay);

    // 주제별 개별 질문 사용 — LLM이 관련성 판단
    const roundQuestion = topicQuestions[topic] || '';

    // AI 해석 요청 (병렬)
    const [sajuReading, tarotReading] = await Promise.all([
      AIInterpreter.getSajuReading(sajuResult, topic, sajuResult.gender, roundQuestion),
      AIInterpreter.getTarotReading(tarotDraw, topic, roundQuestion, tarotAdvanced)
    ]);

    const roundData = {
      round: currentRound,
      topic,
      question: roundQuestion || null,
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
    const sajuVotes = votes.filter(v => v === 'saju').length;
    const tarotVotes = votes.filter(v => v === 'tarot').length;

    const aiJudgment = await AIInterpreter.getFinalJudgment(rounds, votes);

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
      winner = aiJudgment.winner;
    }

    return {
      winner,
      scores: finalScore,
      voteDetail: { saju: sajuVotes, tarot: tarotVotes },
      aiJudgment,
      rounds,
      topics: [...topics],
      message: aiJudgment.message
    };
  }

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
    getTopics: () => [...topics],
    TOTAL_ROUNDS
  };
})();
