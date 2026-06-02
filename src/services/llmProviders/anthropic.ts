// ─────────────────────────────────────────────────────────────
// Tarjama — Anthropic LLM Provider
// ─────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

/**
 * Maps HTTP status codes to human-readable error messages.
 */
function getErrorMessage(status: number, body: string): string {
  switch (status) {
    case 401:
      return 'Authentication failed: Invalid Anthropic API key. Please check your API key in settings.';
    case 429:
      return 'Rate limit exceeded: Too many requests to Anthropic. Please wait a moment and try again.';
    case 529:
      return 'Anthropic API is temporarily overloaded. Please try again in a few moments.';
    default: {
      try {
        const parsed = JSON.parse(body);
        return `Anthropic API error (${status}): ${parsed?.error?.message || body}`;
      } catch {
        return `Anthropic API error (${status}): ${body}`;
      }
    }
  }
}

/**
 * Translates text using the Anthropic Messages API (non-streaming).
 *
 * Uses direct browser access headers to bypass CORS restrictions.
 */
export async function translateWithAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, responseText));
  }

  const data = JSON.parse(responseText);

  // Extract text from the content blocks
  const textBlocks = data.content?.filter(
    (block: { type: string }) => block.type === 'text',
  );

  if (!textBlocks || textBlocks.length === 0) {
    throw new Error('Anthropic returned an empty response with no text content.');
  }

  return textBlocks
    .map((block: { text: string }) => block.text)
    .join('');
}

/**
 * Translates text using the Anthropic Messages API with SSE streaming.
 *
 * Calls `onChunk` with each incremental text delta as it arrives.
 * Returns the full assembled translation once the stream completes.
 */
export async function translateWithAnthropicStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(getErrorMessage(response.status, errorBody));
  }

  if (!response.body) {
    throw new Error('Anthropic returned no response body for streaming request.');
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
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.type === 'content_block_delta' && event.delta?.text) {
            const chunk = event.delta.text;
            fullText += chunk;
            onChunk(chunk);
          }

          // Handle stream-level errors
          if (event.type === 'error') {
            throw new Error(
              `Anthropic stream error: ${event.error?.message || JSON.stringify(event.error)}`,
            );
          }
        } catch (parseError) {
          // Skip malformed JSON lines — SSE can have comments or empty data
          if (parseError instanceof SyntaxError) continue;
          throw parseError;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new Error('Anthropic streaming returned an empty response.');
  }

  return fullText;
}
