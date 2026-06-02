// ─────────────────────────────────────────────────────────────
// Tarjama — Gemini LLM Provider
// ─────────────────────────────────────────────────────────────

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Builds the full Gemini generateContent endpoint URL.
 * API key is sent via header, NOT in the URL (security best practice).
 */
function buildUrl(model: string, stream: boolean = false): string {
  const method = stream ? 'streamGenerateContent' : 'generateContent';
  return `${GEMINI_BASE_URL}/models/${model}:${method}`;
}

/**
 * Build headers with API key for Gemini requests.
 */
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

/**
 * Maps HTTP status codes to human-readable error messages.
 */
function getErrorMessage(status: number, body: string): string {
  switch (status) {
    case 400:
      return 'Bad request to Gemini API. The model may not support the requested configuration.';
    case 401:
    case 403:
      return 'Authentication failed: Invalid Gemini API key. Please check your API key in settings.';
    case 429:
      return 'Rate limit exceeded: Too many requests to Gemini. Please wait a moment and try again.';
    case 500:
    case 503:
      return 'Gemini API is temporarily unavailable. Please try again in a few moments.';
    default: {
      try {
        const parsed = JSON.parse(body);
        const msg = parsed?.error?.message || body;
        return `Gemini API error (${status}): ${msg}`;
      } catch {
        return `Gemini API error (${status}): ${body}`;
      }
    }
  }
}

/**
 * Extracts the generated text from a Gemini response object.
 */
function extractText(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = data.candidates as any[] | undefined;

  if (!candidates || candidates.length === 0) {
    // Check for prompt feedback (safety block, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feedback = data.promptFeedback as any;
    if (feedback?.blockReason) {
      throw new Error(
        `Gemini blocked the request: ${feedback.blockReason}. ` +
        'Try adjusting safety settings or rephrasing the input.',
      );
    }
    throw new Error('Gemini returned an empty response with no candidates.');
  }

  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error('Gemini response candidate contained no content parts.');
  }

  return parts
    .map((part: { text?: string }) => part.text || '')
    .join('');
}

/**
 * Translates text using the Gemini generateContent API (non-streaming).
 */
export async function translateWithGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = buildUrl(model, false);

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, responseText));
  }

  const data = JSON.parse(responseText);
  const text = extractText(data);

  if (!text.trim()) {
    throw new Error('Gemini returned an empty translation.');
  }

  return text.trim();
}

/**
 * Translates text using the Gemini streamGenerateContent API with streaming.
 *
 * Calls `onChunk` with each incremental text delta as it arrives.
 * Returns the full assembled translation once the stream completes.
 */
export async function translateWithGeminiStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  const url = buildUrl(model, true) + '?alt=sse';

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(getErrorMessage(response.status, errorBody));
  }

  if (!response.body) {
    throw new Error('Gemini returned no response body for streaming request.');
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
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          const parts = event.candidates?.[0]?.content?.parts;

          if (parts) {
            for (const part of parts) {
              if (part.text) {
                fullText += part.text;
                onChunk(part.text);
              }
            }
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
    throw new Error('Gemini streaming returned an empty response.');
  }

  return fullText;
}
