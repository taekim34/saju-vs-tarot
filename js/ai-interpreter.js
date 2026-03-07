/**
 * AI 해석기 (ai-interpreter.js) — v2.0 전문가 수준
 *
 * 서버 프록시(/api/interpret)를 통해 AI 해석 텍스트를 생성
 * - API 키/모델 선택은 서버(Cloudflare Workers) 환경변수로 관리
 * - 클라이언트는 systemPrompt, userPrompt, maxTokens만 전송
 *
 * v2.0 개선사항:
 * P1: 사주 시스템 프롬프트에 지장간/충합/대운/12운성 활용 지시
 * P2: 타로 시스템 프롬프트에 패턴 분석 활용 지시
 * P3: 사주 user 프롬프트 — summary에 이미 포함된 신규 데이터 참조 명시
 * P4: 타로 user 프롬프트 — 패턴 분석 섹션 참조 명시
 */

const AIInterpreter = (() => {
  function getAPIEndpoint() {
    const config = window.__CONFIG__ || {};
    return config.API_PROXY_URL || '/api/interpret';
  }

  /**
   * API 프록시 호출 (/api/interpret)
   * - 429 Rate Limit: 지수 백오프 (5s -> 10s -> 20s -> 30s)
   * - 502 Proxy Error: 서버 연결 문제 안내
   * - 기타 에러: 3초 대기 후 1회 재시도
   */
  async function callAPI(systemPrompt, userPrompt, retries = 2, attempt = 0, maxTokens = null) {
    try {
      const tokenLimit = maxTokens || 4096;
      const response = await fetch(getAPIEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, maxTokens: tokenLimit })
      });

      // 429 Rate Limit -- 지수 백오프로 대기 후 재시도
      if (response.status === 429) {
        if (retries > 0) {
          const backoffSec = Math.min(5 * Math.pow(2, attempt), 30); // 5s -> 10s -> 20s -> 30s
          console.warn(`Rate limit (429). ${backoffSec}s backoff... (retries left: ${retries})`);
          await new Promise(r => setTimeout(r, backoffSec * 1000));
          return callAPI(systemPrompt, userPrompt, retries - 1, attempt + 1, maxTokens);
        }
        return {
          fallback: true,
          text: '서버가 바빠서 잠시 쉬어가야 합니다... 잠시 후 다시 시도해주세요.'
        };
      }

      // 502 Proxy Error -- 서버 연결 문제
      if (response.status === 502) {
        return {
          fallback: true,
          text: '서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
        };
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`API ${response.status} response:`, errBody);
        throw new Error(`API Error: ${response.status} - ${errBody.substring(0, 200)}`);
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      const text = msg?.content || msg?.reasoning || '';
      return { fallback: false, text };
    } catch (error) {
      console.error('AI API call failed:', error);
      if (retries > 0) {
        const delay = 3000 + attempt * 2000; // 3s -> 5s -> 7s
        console.warn(`API retry in ${delay/1000}s... (retries left: ${retries})`);
        await new Promise(r => setTimeout(r, delay));
        return callAPI(systemPrompt, userPrompt, retries - 1, attempt + 1, maxTokens);
      }
      return {
        fallback: true,
        text: '운세의 기운이 잠시 흐려졌습니다... 다시 시도해주세요.'
      };
    }
  }

  // ============================================================
  // [P1 + P3] 사주 해석 — 강화된 프롬프트
  // ============================================================

  async function getSajuReading(sajuResult, topic, gender, question = '') {
    const currentYear = new Date().getFullYear();
    const topicMap = {
      '연애운': '연애운과 이성 관계',
      '재물운': '재물운과 금전 흐름',
      '종합운세': `${currentYear}년 종합운세`
    };

    // [P1] 시스템 프롬프트: 강화된 엔진의 모든 분석 항목을 활용하도록 지시
    const systemPrompt = `당신은 50년 경력의 사주 명리학 대가입니다. 대한민국 최고 수준의 철학원을 운영해 온 명인으로서 해석합니다.
현재 ${currentYear}년 기준으로 해석합니다.

【핵심 분석 도구 — 아래 데이터가 제공되면 반드시 해석에 활용하세요】
1. 일간(日干) 오행/음양 → 사주의 출발점, 성격과 기질의 핵심
2. 십성(十星) 배치 → 각 기둥별 십성이 삶의 어떤 영역을 지배하는지
3. 지장간(支藏干) → 지지 안에 숨은 천간의 힘, "겉과 속이 다른" 에너지 감지
4. 충(冲) → 사주 내 충돌하는 지지가 있으면 갈등/변화/전환의 에너지
5. 합(合) → 삼합/육합이 있으면 조화/결합/기회의 에너지
6. 12운성(十二運星) → 각 천간이 지지에서 어떤 생명 단계에 있는지 (장생~태)
7. 세운(歲運) → ${currentYear}년 간지가 사주에 미치는 영향 (충/합 여부 포함)
8. 대운(大運) → 현재 대운 기간의 특성과 운의 방향
9. 신강/신약 → 일간의 힘에 따른 용신(用神) 방향
10. 특수살 → 도화살, 역마살, 홍염살 등 특수한 기운

【해석 원칙】
- 제공된 십성, 지장간, 충/합 정보를 반드시 언급하며 해석하세요
- 12운성의 생명 단계(장생/관대/건록 등)를 활용하여 현재 에너지 수준을 설명하세요
- 세운과 대운 정보가 있으면 "올해"와 "현재 인생 단계"의 맥락을 결합하세요
- 충이 있으면 변화와 갈등의 구체적 영역을 짚어주세요
- 합이 있으면 어떤 에너지가 결합하여 어떤 기회가 열리는지 설명하세요
- 전문 용어를 자연스럽게 사용하되 괄호 안에 쉬운 설명을 붙여주세요

【답변 구조】
1. **명식 분석** (2~3문장): 일간 특성, 십성 구조, 신강/신약, 12운성의 핵심 포인트
2. **심층 분석** (2~3문장): 지장간/충/합이 만들어내는 사주 내부의 역학 관계
3. **${topicMap[topic]} 해석** (3~4문장): 해당 주제에 대한 구체적이고 실질적인 해석
4. **${currentYear}년 운세** (2~3문장): 세운과 대운이 올해 미치는 영향
5. **실전 조언** (1~2문장): 구체적이고 실행 가능한 조언
6. **핵심 메시지**: ✨로 시작하는 인상적인 한 줄

500~700자 이내로 답변하세요.`;

    // [P3] 유저 프롬프트: 강화된 summary 데이터를 명시적으로 참조
    let userPrompt = `아래 사주팔자의 전문 분석 데이터를 활용하여 ${topicMap[topic]}에 대해 해석해주세요.

【사주팔자 전문 분석】
${sajuResult.summary}
성별: ${gender === 'male' ? '남성' : '여성'}`;

    // U2: 자유 질문 삽입
    if (question) {
      userPrompt += `\n\n【사용자의 추가 질문】\n${question}\n→ 이 질문의 맥락을 ${topic} 해석에 자연스럽게 반영해주세요.`;
    }

    userPrompt += `\n\n【현재 연도】: ${currentYear}년\n【해석 주제】: ${topic}

위 분석 데이터에 포함된 십성 배치, 지장간, 12운성, 충/합, 세운, 대운 정보를 모두 활용하여 깊이 있는 해석을 해주세요.`;

    return callAPI(systemPrompt, userPrompt, 2, 0, 3000);  // U5: 사주 토큰 3000
  }

  // ============================================================
  // [P2 + P4] 타로 해석 — 강화된 프롬프트
  // ============================================================

  async function getTarotReading(tarotDrawResult, topic, question = '') {
    const currentYear = new Date().getFullYear();

    // [P2] 시스템 프롬프트: 패턴 분석 데이터를 활용하도록 지시
    const systemPrompt = `당신은 유럽에서 30년간 타로점을 봐온 전설적인 타로 마스터입니다. 카드의 상징과 직관을 결합한 깊이 있는 해석으로 유명합니다.
현재 ${currentYear}년 기준으로 해석합니다.

【핵심 분석 도구 — 아래 패턴 데이터가 제공되면 반드시 활용하세요】
1. 메이저/마이너 비율 → 운명적 메시지의 강도 판단 (메이저 많으면 큰 전환기)
2. 수트 패턴 → 어떤 원소 에너지가 지배적인지 (불=열정, 물=감정, 바람=사고, 흙=현실)
3. 부재 원소 → 빠진 원소가 있으면 해당 영역의 에너지 부족을 짚어주세요
4. 숫자 패턴 → 같은 숫자가 반복되면 수비학적 메시지 강조
5. 원소 상성 (Elemental Dignity) → 인접 카드 간 우호/적대/중립 관계
6. 코트 카드 → 페이지/기사/여왕/왕이 나타나면 인물 에너지 해석

【해석 원칙】
- 각 카드의 전통적 상징(원소, 수비학, 카발라)을 활용하세요
- 메이저 아르카나는 인생의 큰 흐름과 영적 메시지, 마이너는 일상적 상황으로 구분
- 정방향/역방향에 따른 에너지 차이를 명확히
- 카드 간 "대화"를 읽으세요: 원소 상성 데이터를 활용하여 인접 카드의 시너지/긴장을 설명
- 수트가 집중된 원소의 의미를 강조하고, 부재 원소의 약점도 언급하세요
- 코트 카드가 있으면 "누군가의 등장/영향"으로 해석하세요
- 스프레드 위치(과거→현재→미래 등)에 따른 시간 흐름을 해석하세요

【답변 구조】
1. **스프레드 개관** (1~2문장): 메이저/마이너 비율과 전체 에너지 톤
2. **카드별 해석** (각 카드 2~3문장): 각 위치의 카드 + 상징적 이미지 묘사
3. **패턴 분석** (2~3문장): 수트/숫자/원소 상성이 만들어내는 숨은 메시지
4. **카드 간 스토리** (2~3문장): 카드들의 대화가 그려내는 서사
5. **실전 조언** (1~2문장): 구체적이고 실행 가능한 행동 지침
6. **핵심 메시지**: 🌟로 시작하는 인상적인 한 줄

카드의 상징적 이미지를 생생하게 묘사하여 읽는 사람이 그림을 떠올릴 수 있게 하세요.
500~700자 이내로 답변하세요.`;

    const tarotSummary = TarotEngine.buildSummary(tarotDrawResult);

    // [P4] 유저 프롬프트: 패턴 분석 섹션 참조 명시
    let userPrompt = `아래 타로 카드 스프레드와 패턴 분석 데이터를 활용하여 ${topic}에 대해 알려주세요. (${currentYear}년 기준)

${tarotSummary}`;

    // U2: 자유 질문 삽입
    if (question) {
      userPrompt += `\n\n【질문자가 특히 궁금해하는 것】\n${question}\n→ 카드 해석 시 이 질문에 대한 답을 자연스럽게 녹여주세요.`;
    }

    userPrompt += `\n\n위 데이터에 포함된 【메이저/마이너 비율】, 【수트 패턴】, 【숫자 패턴】, 【카드 간 원소 관계】, 【코트 카드】 정보를 모두 활용하여 깊이 있는 해석을 해주세요.`;

    // U5: 타로 토큰 — 7장 스프레드는 더 긴 응답 필요
    const tokens = tarotDrawResult.reading.length >= 7 ? 4000 : 3000;
    return callAPI(systemPrompt, userPrompt, 2, 0, tokens);
  }

  // ============================================================
  // 최종 판정 — 강화된 비교 프롬프트
  // ============================================================

  async function getFinalJudgment(rounds, votes) {
    const systemPrompt = `당신은 동서양 점술을 모두 섭렵한 비교 점술학 최고 권위자입니다.
사주(동양)와 타로(서양)의 해석 방법론, 정확도, 구체성을 종합 비교하여 최종 판정을 내립니다.

【평가 기준】
- 해석의 깊이: 전문 분석 도구(사주: 십성/지장간/충합/12운성 vs 타로: 원소 상성/수트 패턴)를 얼마나 활용했는가
- 논리적 일관성: 카드/명식 간의 관계를 얼마나 설득력 있게 엮었는가
- 실용성: 구체적이고 실행 가능한 조언이 있었는가
- 공감력: 읽는 사람이 "내 얘기다"라고 느낄 수 있었는가

각 라운드별 해석의 깊이, 논리성, 실용성을 객관적으로 평가하세요.
반드시 아래 형식을 지켜주세요.`;

    let userPrompt = '아래 3라운드 결과를 보고 최종 판정을 내려주세요.\n\n';

    rounds.forEach((round, i) => {
      const voteResult = votes[i] === 'saju' ? '사주' : '타로';
      userPrompt += `【Round ${i + 1} - ${round.topic}】\n`;
      userPrompt += `사주 해석: ${round.saju.reading.text}\n`;
      userPrompt += `타로 해석: ${round.tarot.reading.text}\n`;
      userPrompt += `유저 투표: ${voteResult}\n\n`;
    });

    userPrompt += `【응답 형식 — 반드시 이 형식을 따르세요】
WINNER: 사주 또는 타로 (반드시 하나만)
REASON: 3라운드를 종합한 판정 이유 (100자 이내, 각 라운드의 해석 품질을 비교 근거로 제시)
MESSAGE: 동양과 서양의 지혜를 아우르는 인상적인 마무리 한 줄`;

    const result = await callAPI(systemPrompt, userPrompt, 2, 0, 2000);  // U5: 판정 토큰 2000

    // 응답 파싱
    if (!result.fallback) {
      const text = result.text;
      let winner = 'draw';
      let reason = '';
      let message = '';

      const winnerMatch = text.match(/WINNER:\s*(사주|타로)/);
      const reasonMatch = text.match(/REASON:\s*(.+)/);
      const messageMatch = text.match(/MESSAGE:\s*(.+)/);

      if (winnerMatch) winner = winnerMatch[1] === '사주' ? 'saju' : 'tarot';
      if (reasonMatch) reason = reasonMatch[1].trim();
      if (messageMatch) message = messageMatch[1].trim();

      return {
        fallback: false,
        winner,
        reason: reason || text.substring(0, 50),
        message: message || '운명의 대결이 끝났습니다!',
        fullText: text
      };
    }

    return {
      fallback: true,
      winner: 'draw',
      reason: 'AI 판정 불가',
      message: result.text,
      fullText: ''
    };
  }

  return {
    getSajuReading,
    getTarotReading,
    getFinalJudgment
  };
})();
