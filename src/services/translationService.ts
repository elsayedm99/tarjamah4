// ─────────────────────────────────────────────────────────────
// Tarjama — Translation Service
// ─────────────────────────────────────────────────────────────

import { translate } from './llmProviders';
import { buildSystemPrompt } from '../utils/constants';
import {
  countSentences,
  countParagraphs,
  getLastNSentences,
  generateId,
} from '../utils/helpers';
import type {
  GlossaryEntry,
  DocumentContext,
  PageData,
  ParagraphPair,
  QualityFlag,
  LLMConfig,
} from '../types';
import { checkTranslationQuality } from './verificationService';

/** Number of trailing sentences to pass for continuity overlap */
const CONTINUITY_SENTENCES = 3;

/**
 * Splits source and translated text into aligned paragraph pairs.
 *
 * If the paragraph counts don't match, the translated text is mapped
 * to source paragraphs as best as possible — extra translated paragraphs
 * are appended to the last source paragraph, and missing translated
 * paragraphs get an empty string.
 */
function alignParagraphs(
  sourceText: string,
  translatedText: string,
): ParagraphPair[] {
  const sourceParagraphs = sourceText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const translatedParagraphs = translatedText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const pairs: ParagraphPair[] = [];

  for (let i = 0; i < sourceParagraphs.length; i++) {
    let translated: string;

    if (i < translatedParagraphs.length) {
      translated = translatedParagraphs[i];
    } else {
      // Source paragraph has no matching translation
      translated = '';
    }

    // If this is the last source paragraph and there are extra translated
    // paragraphs, concatenate them here
    if (
      i === sourceParagraphs.length - 1 &&
      translatedParagraphs.length > sourceParagraphs.length
    ) {
      const extras = translatedParagraphs.slice(i + 1);
      translated = [translated, ...extras].join('\n\n');
    }

    pairs.push({
      id: generateId(),
      sourceIndex: i,
      sourceText: sourceParagraphs[i],
      translatedText: translated,
      isManuallyEdited: false,
      isReviewed: false,
    });
  }

  return pairs;
}

/**
 * Builds the context string from a DocumentContext object.
 */
function buildContextString(context: DocumentContext | null): string {
  if (!context) return '';

  const parts: string[] = [];

  if (context.caseNumber) parts.push(`Case Number: ${context.caseNumber}`);
  if (context.courtName) parts.push(`Court: ${context.courtName}`);
  if (context.judgeName) parts.push(`Judge: ${context.judgeName}`);
  if (context.applicantName) parts.push(`Applicant: ${context.applicantName}`);
  if (context.respondentName) parts.push(`Respondent: ${context.respondentName}`);
  if (context.date) parts.push(`Date: ${context.date}`);
  if (context.rawSummary) parts.push(`\nDocument Summary:\n${context.rawSummary}`);

  return parts.join('\n');
}

/**
 * Translates an array of pages sequentially, maintaining continuity
 * between pages by passing the last few translated sentences as context.
 *
 * @param pages              - Pages to translate (should have sourceText populated)
 * @param config             - LLM configuration (provider, apiKey, model)
 * @param glossary           - Glossary entries for terminology enforcement
 * @param documentContext    - Optional document-level context
 * @param previousTranslation - Pre-existing translated text for continuity (from pages before this batch)
 * @param onPageComplete     - Callback fired when each page finishes translating
 */
export async function translatePages(
  pages: PageData[],
  config: LLMConfig,
  glossary: GlossaryEntry[],
  documentContext: DocumentContext | null,
  previousTranslation: string,
  onPageComplete: (
    pageNumber: number,
    translatedText: string,
    paragraphs: ParagraphPair[],
    flags: QualityFlag[],
  ) => void,
): Promise<void> {
  let lastTranslatedText = previousTranslation;

  for (const page of pages) {
    if (!page.sourceText || !page.sourceText.trim()) {
      // Skip empty pages — report them as complete with no content
      onPageComplete(page.pageNumber, '', [], []);
      continue;
    }

    // Build the context overlap from the last translation
    const prevOverlap = getLastNSentences(lastTranslatedText, CONTINUITY_SENTENCES);

    // Build the full system prompt with glossary, context, and overlap
    const contextString = buildContextString(documentContext);
    const systemPrompt = buildSystemPrompt(glossary, contextString, prevOverlap);

    // Call the LLM provider
    const translatedText = await translate(
      config.provider,
      config.apiKey,
      config.model,
      systemPrompt,
      page.sourceText,
    );

    // Create aligned paragraph pairs
    const paragraphs = alignParagraphs(page.sourceText, translatedText);

    // Run quality checks
    const flags = checkTranslationQuality(page.sourceText, translatedText);

    // Report this page as complete
    onPageComplete(page.pageNumber, translatedText, paragraphs, flags);

    // Update continuity context for the next page
    lastTranslatedText = translatedText;
  }
}

/**
 * Re-translates a single paragraph with surrounding context.
 *
 * Used when the user wants to retranslate an individual paragraph
 * without re-doing the entire page.
 *
 * @param sourceText         - The source paragraph text to translate
 * @param surroundingContext - Nearby paragraphs for context (prev + next source text)
 * @param config             - LLM configuration
 * @param glossary           - Glossary entries
 * @returns The translated paragraph text
 */
export async function translateSingleParagraph(
  sourceText: string,
  surroundingContext: string,
  config: LLMConfig,
  glossary: GlossaryEntry[],
): Promise<string> {
  const contextBlock = surroundingContext
    ? `\n## Surrounding Context (for reference only — translate ONLY the text below)\n${surroundingContext}`
    : '';

  const systemPrompt = buildSystemPrompt(glossary, contextBlock, '');

  const userPrompt = `Translate the following paragraph:\n\n${sourceText}`;

  const translatedText = await translate(
    config.provider,
    config.apiKey,
    config.model,
    systemPrompt,
    userPrompt,
  );

  return translatedText.trim();
}
