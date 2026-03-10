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
      const callLabel = systemPrompt.substring(0, 30).replace(/\n/g, ' ');
      const startTime = performance.now();
      console.log(`[API] 호출 시작: "${callLabel}..." (maxTokens: ${tokenLimit})`);
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
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      const msg = data.choices?.[0]?.message;
      const text = msg?.content || msg?.reasoning || '';
      const usage = data.usage;
      console.log(`[API] 호출 완료: "${callLabel}..." ${elapsed}s (입력: ${usage?.prompt_tokens || '?'}토큰, 출력: ${usage?.completion_tokens || '?'}토큰)`);
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

    const topicEmoji = { '연애운': '💞', '재물운': '💰', '종합운세': '🌏' };

    // 자유 질문이 있으면 질문 중심으로 해석, 없으면 주제 중심
    const hasQuestion = !!question;

    const systemPrompt = `당신은 50년 경력의 사주 명리학 대가이자, 따뜻한 상담으로 유명한 선생님입니다.
점을 보러 오는 사람은 불안하거나 궁금한 마음이 있어서 오는 거예요. 그 마음을 먼저 알아주세요.
현재 ${currentYear}년 기준으로 해석합니다.

【활용할 분석 데이터】
일간 오행/음양, 십성 배치(궁성 포함), 지장간, 충/합, 12운성, 세운, 대운, 신강/신약, 특수살, 절기 생월
→ 제공된 데이터를 근거로 삼되, 일반인이 바로 이해할 수 있게 풀어서 설명하세요.

【전문가 수준 보정 — 명리학 대가로서 판단하여 적용하세요】
1. 궁성(宮星): 십성이 어느 궁(조상궁/부모궁/배우자궁/자녀궁)에 있는지에 따라 해석을 달리하세요.
   예: 편재가 배우자궁 → 배우자 통해 재물 / 편재가 자녀궁 → 말년 재물
2. 조후(調候): 절기 생월 정보를 참고하여, 일간이 태어난 계절에 어떤 오행이 필요한지 판단하세요.
   예: 여름생 壬水 → 금수가 용신 / 겨울생 丙火 → 목화가 용신
3. 합화(合化): 육합이 있으면 합화 가능성을 판단하세요. 합화가 성립한다고 보면 오행 변화를 해석에 반영하세요.
   예: 子丑 합화토 → 수 기운이 약해지고 토가 강해짐
→ 세 가지 모두 "더 정확한 해석에 도움이 된다"고 판단되면 적극 활용하고, 해석에 자연스럽게 녹여주세요.
→ 단, 일반인에게는 보정 과정을 장황하게 설명하지 말고, 보정 결과를 반영한 해석만 전달하세요.

【공감과 소통의 원칙 — 가장 중요】
- 분석 결과를 나열하지 말고, "이 사람의 이야기"로 풀어주세요
- "이런 경향이 있으시죠?", "혹시 이런 경험 있으셨나요?" 같은 공감 표현
- 안 좋은 요소도 위협적으로 말하지 말고 "주의하면 되는 부분"으로
- 좋은 요소는 "당신의 강점"으로 구체적으로 칭찬
- 마지막은 반드시 용기와 희망을 주는 메시지로

【말투와 톤】
- 친구에게 설명하듯 대화체로 ("~거든요", "~이에요", "~인 거죠")
- 사주 용어는 반드시 바로 뒤에 쉬운 설명을 붙이세요
  예: "비견이 많아요 → 독립성이 강하고, 스스로 해결하려는 성향이에요. 혼자 다 하려고 애쓰신 적 많지 않으셨어요?"
  예: "편재가 있어요 → 큰 돈을 다루는 감각이 있다는 뜻이에요. 사업이나 투자 쪽에 끌리신 적 있을 거예요"
- 이모지를 자연스럽게 사용 (과하지 않게, 섹션 제목이나 강조 포인트에)

【답변 구조 — 반드시 이 형식을 따르세요】
${hasQuestion ? `# ${topicEmoji[topic]} ${topic} — "${question}" 분석

## 당신의 사주 구조
일간의 성격, 오행 비율이 만드는 에너지 밸런스, 핵심 십성이 어떤 기질을 만드는지 4~6줄로 풀어주세요.
"이런 분이시죠?" 하는 공감 포인트를 반드시 포함하세요.

## 이 고민의 사주적 뿌리
사주 구조가 이 고민/질문과 어떻게 연결되는지 8~12줄로 설명
- 구체적인 사주 요소(십성, 오행, 충/합, 12운성)를 근거로 제시
- "왜 이런 상황이 생기는지"를 사주 구조로 설명
- 지장간이나 합화 등 심층 요소가 있으면 활용

## 사주가 알려주는 해결 방향
5~7줄의 구체적 조언 (사주 근거 + 실전 행동)
- 사주의 강점을 활용하는 방법
- 약점을 보완하는 실질적 전략

## ${currentYear}년 운의 흐름과 타이밍
세운과 대운이 이 문제에 미치는 영향 4~6줄
- 올해 특히 유리한 시기와 조심할 시기
- 대운의 큰 그림에서 현재 위치` :

`# ${topicEmoji[topic]} ${topic} 분석

## 당신의 사주 구조
일간 특성, 오행 비율, 핵심 십성이 만드는 기질을 4~6줄로 요약
"이런 분이시죠?" 하는 공감 포인트 반드시 포함

## ${topic}에 영향을 주는 사주 요소
관련 십성, 오행, 충/합, 12운성 등을 근거로 8~12줄 해석
- 좋은 요소와 주의할 요소를 구분
- 각 요소가 실생활에서 어떻게 나타나는지 구체적으로 설명
- 지장간, 12신살 등 심층 요소도 해석에 활용

## ${currentYear}년 ${topic} 흐름과 타이밍
세운과 대운이 올해 미치는 영향 5~7줄
- 올해 특히 좋은 시기와 조심할 시기
- 대운의 큰 그림에서 현재 위치

## 실전 조언
구체적이고 실행 가능한 조언 4~6줄
- 사주의 강점을 활용하는 방법
- 약점을 보완하는 실질적 전략`}

## 💫 핵심 한 줄
인상적인 마무리 메시지 (✨로 시작)

1500~2500자로 충분히 길고 상세하게 답변하세요. 짧게 끊지 말고, 각 섹션을 풍부하게 풀어주세요.
마크다운 문법(#, ##, **, -, 이모지)을 적극 활용하세요.`;

    let userPrompt = `아래 사주팔자 분석 데이터를 바탕으로 ${topicMap[topic]}에 대해 해석해주세요.

【사주팔자 분석 데이터】
${sajuResult.summary}
성별: ${gender === 'male' ? '남성' : '여성'}`;

    if (question) {
      userPrompt += `\n\n【사용자 고민/질문 — 이것이 핵심입니다】\n"${question}"\n→ 이 질문을 사주 구조와 깊게 연결하여, 왜 이런 상황이 생기는지 사주적 근거를 들어 분석하고 구체적 조언을 주세요.`;
    }

    userPrompt += `\n\n【현재 연도】: ${currentYear}년\n【해석 주제】: ${topic}`;

    return callAPI(systemPrompt, userPrompt, 2, 0, 6000);
  }

  // ============================================================
  // [P2 + P4] 타로 해석 — 강화된 프롬프트
  // ============================================================

  async function getTarotReading(tarotDrawResult, topic, question = '', advancedData = null) {
    const currentYear = new Date().getFullYear();
    const topicEmoji = { '연애운': '💞', '재물운': '💰', '종합운세': '🔮' };
    const hasQuestion = !!question;

    const systemPrompt = `당신은 동네에서 소문난 타로 할머니예요. 40년간 사람들의 이야기를 들으며 카드를 읽어왔어요.
카드를 읽는 것보다 사람의 마음을 읽는 게 먼저예요. 점을 보러 온 사람의 마음을 먼저 어루만져주세요.
현재 ${currentYear}년 기준으로 해석합니다.

【활용할 분석 데이터】
메이저/마이너 비율, 수트 패턴, 부재 원소, 숫자 패턴, 원소 상성, 코트 카드, 탄생 카드, 점성술 대응, 역방향 심화(차단/그림자/과잉), 카드 조합, 타이밍 암시
→ 카드 데이터를 근거로 삼되, 타로를 모르는 사람도 바로 이해할 수 있게 풀어서 설명하세요.

【전문가 수준 해석 — 타로 대가로서 판단하여 적용하세요】
1. 스프레드 포지션 심화: 같은 카드라도 위치(과거/현재/미래/조언 등)에 따라 의미가 달라집니다. 위치별 맥락을 깊게 반영하세요.
2. 퀸테센스(Quintessence): 뽑힌 카드들의 숫자를 합산하여 숨겨진 메이저 아르카나를 도출하세요. 이것이 "이 리딩의 본질적 메시지"입니다.
3. 원소 상성 심화(Elemental Dignity): 인접 카드의 원소 관계(우호/적대/중립)가 카드의 힘을 강화하거나 약화시킵니다. 이를 해석에 반영하세요.
4. 부재 원소: 4원소(불/물/바람/흙) 중 빠진 원소가 있으면, 그 영역의 에너지가 부족하다는 숨겨진 메시지입니다.
5. 코트 카드 인물 해석: 페이지/기사/여왕/왕이 나오면 실제 인물 에너지(나이대, 성향, 역할)로 해석하세요.
→ 이 기법들을 "더 깊은 해석에 도움이 된다"고 판단되면 적극 활용하되, 일반인에게는 기법 이름을 나열하지 말고 해석 결과만 자연스럽게 전달하세요.

【공감과 소통의 원칙 — 가장 중요】
- "카드가 이렇게 나왔으니 이래요"가 아니라, "요즘 이런 마음이셨죠?"로 시작하세요
- 카드를 사람의 상황과 감정에 연결해서 이야기로 풀어주세요
- "이 카드가 말하는 건요..." 처럼 카드가 대화하는 느낌으로
- 무서운 카드(탑, 죽음 등)도 "변화의 시작", "새로운 출발"로 긍정적으로 풀어주세요
- 마지막은 반드시 따뜻한 응원과 구체적 조언으로

【말투와 톤】
- 따뜻하고 다정한 대화체 ("~거든요", "~이에요", "~한 거예요")
- 카드 이름은 한국어명 + 바로 의미 풀어주기
  예: "운명의 수레바퀴가 떡 하니 나왔어요 → 지금 인생의 큰 흐름이 바뀌고 있다는 거예요. 요즘 뭔가 달라진 느낌 있으시죠?"
  예: "검의 3 역방향이에요 → 아팠던 마음이 서서히 나아지고 있다는 신호예요. 조금만 더 힘내세요"
- 카드 이미지를 생생하게 묘사해서 그림이 떠오르게
- 이모지를 자연스럽게 사용

【답변 구조 — 반드시 이 형식을 따르세요】
${hasQuestion ? `# ${topicEmoji[topic] || '🔮'} ${topic} — "${question}" 카드가 말하는 것

## 카드 에너지 요약
메이저/마이너 비율, 원소 에너지 밸런스, 전체 톤 3~5줄
이 스프레드의 "분위기"를 한 문장으로 잡아주세요

## 카드별 이야기
각 카드를 위치(과거→현재→미래)와 연결하여 깊이 설명
- 카드 이미지를 생생하게 묘사 ("이 카드 그림을 보세요...")
- 각 카드가 이 질문에 대해 무엇을 말하는지 5~8줄
- 역방향이면 어떤 에너지가 막혀있는지 설명

## 이 질문에 대한 카드의 답
카드들이 만들어내는 스토리로 질문에 답 8~12줄
- 카드 간 관계(원소 상성, 숫자 패턴)를 근거로
- 퀸테센스 카드의 숨겨진 메시지를 활용
- 부재 원소가 있다면 그 의미를 풀어서

## 카드가 제안하는 행동
구체적이고 실행 가능한 조언 4~6줄` :

`# ${topicEmoji[topic] || '🔮'} ${topic} — 카드가 그리는 그림

## 카드 에너지 요약
메이저/마이너 비율, 원소 에너지 밸런스, 전체 톤 3~5줄
이 스프레드의 "분위기"를 한 문장으로 잡아주세요

## 카드별 이야기
각 카드의 의미를 위치(과거→현재→미래)와 연결하여 설명
- 카드 이미지를 생생하게 묘사 ("이 카드 그림을 보세요...")
- 각 카드가 ${topic}에 대해 무엇을 말하는지 5~8줄
- 역방향이면 어떤 에너지가 막혀있는지 설명

## 카드들의 대화 — 숨겨진 메시지
카드 간 관계, 수트/숫자 패턴, 퀸테센스가 만들어내는 서사 5~8줄
부재 원소가 있다면 그 의미를 풀어서

## 카드가 제안하는 행동
구체적이고 실행 가능한 조언 4~6줄`}

## 🌟 핵심 한 줄
인상적인 마무리 메시지 (🌟로 시작)

1500~2500자로 충분히 길고 상세하게 답변하세요. 짧게 끊지 말고, 각 섹션을 풍부하게 풀어주세요.
마크다운 문법(#, ##, **, -, 이모지)을 적극 활용하세요.`;

    const tarotSummary = TarotEngine.buildSummary(tarotDrawResult, advancedData);

    let userPrompt = `아래 타로 카드 스프레드와 패턴 분석 데이터를 바탕으로 ${topic}에 대해 해석해주세요. (${currentYear}년 기준)

${tarotSummary}`;

    if (question) {
      userPrompt += `\n\n【사용자 고민/질문 — 이것이 핵심입니다】\n"${question}"\n→ 카드가 이 질문에 대해 무엇을 말하는지 깊게 풀어주세요.`;
    }

    return callAPI(systemPrompt, userPrompt, 2, 0, 6000);
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
