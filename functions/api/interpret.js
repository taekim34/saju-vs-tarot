/**
 * Cloudflare Pages Function -- OpenRouter API Proxy
 * Route: POST /api/interpret
 * Environment variables: OPENROUTER_API_KEY, MODEL (set in Cloudflare dashboard)
 *
 * Security: API key is stored server-side only (Cloudflare Workers env).
 * Client sends { systemPrompt, userPrompt, maxTokens } -- no key, no model selection.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // CORS preflight (defensive -- OPTIONS is typically handled separately,
  // but some edge cases may route here)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { systemPrompt, userPrompt, maxTokens } = body;

    // Input validation
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return Response.json(
        { error: 'systemPrompt is required and must be a string' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!userPrompt || typeof userPrompt !== 'string') {
      return Response.json(
        { error: 'userPrompt is required and must be a string' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prompt length guard -- reject excessively large payloads
    const MAX_PROMPT_LENGTH = 50000;
    if (systemPrompt.length > MAX_PROMPT_LENGTH || userPrompt.length > MAX_PROMPT_LENGTH) {
      return Response.json(
        { error: 'Prompt exceeds maximum allowed length' },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured in environment');
      return Response.json(
        { error: 'API key not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const model = env.MODEL || 'deepseek/deepseek-v3.2:floor';
    const tokenLimit = Math.min(Number(maxTokens) || 4096, 8192); // cap at 8192

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': request.headers.get('Origin') || 'https://saju-vs-tarot.pages.dev',
        'X-Title': 'Saju-vs-Tarot'
      },
      body: JSON.stringify({
        model,
        max_tokens: tokenLimit,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    // Proxy the OpenRouter response status as-is (429 etc. for client retry logic)
    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: corsHeaders
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return Response.json(
      { error: 'Proxy error', message: err.message },
      { status: 502, headers: corsHeaders }
    );
  }
}
