// ─────────────────────────────────────────────────────────────
// Tarjama — Verification Service (Quality Checks)
// ─────────────────────────────────────────────────────────────

import { countSentences, countParagraphs } from '../utils/helpers';
import type { QualityFlag } from '../types';

/**
 * Threshold for flagging sentence count divergence.
 * If the Arabic translation has fewer than this ratio of the English
 * sentence count, it's flagged as a possible abbreviation.
 */
const ABBREVIATION_THRESHOLD = 0.7;

/**
 * Threshold for flagging sentence count mismatch as a warning.
 * Differences above this ratio (in either direction) trigger a warning.
 */
const SENTENCE_MISMATCH_THRESHOLD = 0.2;

/**
 * Runs quality checks on a source–translation pair and returns
 * an array of quality flags indicating potential issues.
 *
 * Checks performed:
 * 1. Paragraph count mismatch — source and translation should have equal paragraphs
 * 2. Sentence count mismatch — significant divergence is flagged
 * 3. Abbreviation detection — if Arabic has far fewer sentences, content may be missing
 *
 * @param sourceText     - The original English source text
 * @param translatedText - The Arabic translation
 * @returns Array of quality flags (may be empty if all checks pass)
 */
export function checkTranslationQuality(
  sourceText: string,
  translatedText: string,
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (!sourceText?.trim() || !translatedText?.trim()) {
    return flags;
  }

  // ── Paragraph count check ──────────────────────────────────
  const sourceParagraphCount = countParagraphs(sourceText);
  const targetParagraphCount = countParagraphs(translatedText);

  if (sourceParagraphCount !== targetParagraphCount) {
    flags.push({
      type: 'paragraph_mismatch',
      severity: sourceParagraphCount > 0 && targetParagraphCount === 0
        ? 'error'
        : 'warning',
      message:
        `Paragraph count mismatch: source has ${sourceParagraphCount} paragraph(s), ` +
        `translation has ${targetParagraphCount}. ` +
        'The LLM may have merged or split paragraphs.',
    });
  }

  // ── Sentence count check ───────────────────────────────────
  const sourceSentenceCount = countSentences(sourceText);
  const targetSentenceCount = countSentences(translatedText);

  if (sourceSentenceCount > 0 && targetSentenceCount > 0) {
    const ratio = targetSentenceCount / sourceSentenceCount;
    const difference = Math.abs(sourceSentenceCount - targetSentenceCount);

    // Check for possible abbreviation (Arabic significantly shorter)
    if (ratio < ABBREVIATION_THRESHOLD) {
      flags.push({
        type: 'abbreviation',
        severity: 'error',
        message:
          `Possible abbreviation detected: source has ${sourceSentenceCount} sentence(s) ` +
          `but translation has only ${targetSentenceCount}. ` +
          'The translation may be missing content.',
        sourceSentenceCount,
        targetSentenceCount,
      });
    }
    // Check for general sentence count mismatch (either direction)
    else if (
      difference > 1 &&
      Math.abs(1 - ratio) > SENTENCE_MISMATCH_THRESHOLD
    ) {
      flags.push({
        type: 'sentence_mismatch',
        severity: 'warning',
        message:
          `Sentence count differs: source has ${sourceSentenceCount} sentence(s), ` +
          `translation has ${targetSentenceCount}. ` +
          'This may be acceptable for Arabic syntax, but review is recommended.',
        sourceSentenceCount,
        targetSentenceCount,
      });
    }
  }

  return flags;
}
