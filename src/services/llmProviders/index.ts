// ─────────────────────────────────────────────────────────────
// Tarjama — LLM Provider Factory
// ─────────────────────────────────────────────────────────────

import type { LLMProvider } from '../../types';
import { translateWithAnthropic, translateWithAnthropicStream } from './anthropic';
import { translateWithOpenAI, translateWithOpenAIStream } from './openai';
import { translateWithGemini, translateWithGeminiStream } from './gemini';

/**
 * Routes a translation request to the correct LLM provider.
 *
 * @param provider     - Which LLM provider to use
 * @param apiKey       - The API key for the provider
 * @param model        - The model ID to use
 * @param systemPrompt - System-level instructions (glossary, context, rules)
 * @param userPrompt   - The source text to translate
 * @returns The translated text
 */
export async function translate(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return translateWithAnthropic(apiKey, model, systemPrompt, userPrompt);

    case 'openai':
      return translateWithOpenAI(apiKey, model, systemPrompt, userPrompt);

    case 'gemini':
      return translateWithGemini(apiKey, model, systemPrompt, userPrompt);

    default:
      throw new Error(`Unsupported LLM provider: "${provider}". Supported: openai, anthropic, gemini.`);
  }
}

/**
 * Routes a streaming translation request to the correct LLM provider.
 *
 * @param provider     - Which LLM provider to use
 * @param apiKey       - The API key for the provider
 * @param model        - The model ID to use
 * @param systemPrompt - System-level instructions (glossary, context, rules)
 * @param userPrompt   - The source text to translate
 * @param onChunk      - Callback invoked with each incremental text chunk
 * @returns The full translated text
 */
export async function translateStream(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return translateWithAnthropicStream(apiKey, model, systemPrompt, userPrompt, onChunk);

    case 'openai':
      return translateWithOpenAIStream(apiKey, model, systemPrompt, userPrompt, onChunk);

    case 'gemini':
      return translateWithGeminiStream(apiKey, model, systemPrompt, userPrompt, onChunk);

    default:
      throw new Error(`Unsupported LLM provider: "${provider}". Supported: openai, anthropic, gemini.`);
  }
}
