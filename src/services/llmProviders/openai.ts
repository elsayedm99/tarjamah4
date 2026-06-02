// ─────────────────────────────────────────────────────────────
// Tarjama — OpenAI LLM Provider
// ─────────────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Maps HTTP status codes to human-readable error messages.
 */
function getErrorMessage(status: number, body: string): string {
  switch (status) {
    case 401:
      return 'Authentication failed: Invalid OpenAI API key. Please check your API key in settings.';
    case 429:
      return 'Rate limit exceeded: Too many requests to OpenAI. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
      return 'OpenAI API is temporarily unavailable. Please try again in a few moments.';
    default: {
      try {
        const parsed = JSON.parse(body);
        return `OpenAI API error (${status}): ${parsed?.error?.message || body}`;
      } catch {
        return `OpenAI API error (${status}): ${body}`;
      }
    }
  }
}

/**
 * Build the headers for an OpenAI request.
 * When using the proxy, the API key is sent as Authorization (the proxy
 * forwards it). For direct calls, same header is used.
 */
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

/**
 * Translates text using the OpenAI Chat Completions API (non-streaming).
 */
export async function translateWithOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, responseText));
  }

  const data = JSON.parse(responseText);
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned an empty response with no content.');
  }

  return content.trim();
}

/**
 * Translates text using the OpenAI Chat Completions API with SSE streaming.
 *
 * Calls `onChunk` with each incremental text delta as it arrives.
 * Returns the full assembled translation once the stream completes.
 */
export async function translateWithOpenAIStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(getErrorMessage(response.status, errorBody));
  }

  if (!response.body) {
    throw new Error('OpenAI returned no response body for streaming request.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          const delta = event.choices?.[0]?.delta?.content;

          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) continue;
          throw parseError;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new Error('OpenAI streaming returned an empty response.');
  }

  return fullText;
}
