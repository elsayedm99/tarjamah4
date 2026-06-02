// ─────────────────────────────────────────────────────────────
// Tarjama — Helper Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Generate a unique ID using crypto.randomUUID with a fallback
 * to a timestamp + random suffix for older environments.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random hex
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

/**
 * Simple, fast 53-bit hash (cyrb53) for translation caching.
 * NOT cryptographic — used only for content comparison.
 */
export function hashText(text: string, seed: number = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Counts the number of sentences in a text string.
 * Handles English terminators (. ! ?) and Arabic terminators (. ؟ !).
 * Ignores abbreviations like "S.I.", "Mr.", "No.", etc.
 */
export function countSentences(text: string): number {
  if (!text || !text.trim()) return 0;

  // Common abbreviations that should NOT be treated as sentence endings
  const abbreviations = [
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St',
    'No', 'Vol', 'Rev', 'Gen', 'Corp', 'Inc', 'Ltd', 'Co',
    'vs', 'etc', 'al', 'approx', 'dept', 'est', 'govt',
    'e.g', 'i.e', 'S.I', 'C.J', 'J', 'Nos',
  ];

  // Replace abbreviations with placeholders to avoid false positives
  let processed = text;
  abbreviations.forEach((abbr) => {
    // Match abbreviation followed by period (case-insensitive)
    const regex = new RegExp(`\\b${abbr.replace(/\./g, '\\.')}\\.`, 'gi');
    processed = processed.replace(regex, `${abbr}__ABBR__`);
  });

  // Also handle numbered lists like "1." "2." etc.
  processed = processed.replace(/\b\d+\./g, (match) => match.replace('.', '__ABBR__'));

  // Count sentence-ending punctuation (English + Arabic)
  // . ! ? ؟ (Arabic question mark)
  const sentenceEndings = processed.match(/[.!?؟]+(?:\s|$)/g);
  const count = sentenceEndings ? sentenceEndings.length : 0;

  // If there's text but no sentence endings detected, count as 1 sentence
  return count === 0 && text.trim().length > 0 ? 1 : count;
}

/**
 * Counts the number of non-empty paragraphs in a text.
 */
export function countParagraphs(text: string): number {
  if (!text || !text.trim()) return 0;
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}

/**
 * Detects whether the given text is predominantly right-to-left.
 * Checks for Arabic, Hebrew, Persian, and Urdu character ranges.
 */
export function isRTL(text: string): boolean {
  if (!text || !text.trim()) return false;

  // Unicode ranges for RTL scripts
  // Arabic: \u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFF
  // Hebrew: \u0590-\u05FF, \uFB1D-\uFB4F
  const rtlChars = text.match(
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/g,
  );
  const ltrChars = text.match(/[A-Za-z]/g);

  const rtlCount = rtlChars ? rtlChars.length : 0;
  const ltrCount = ltrChars ? ltrChars.length : 0;

  // If there are any RTL characters and they outnumber LTR characters
  return rtlCount > ltrCount;
}

/**
 * Truncates text to the specified max length, appending "…" if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Formats a byte count into a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1,
  );
  const value = bytes / Math.pow(base, exponent);

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * Formats a Unix timestamp (ms) into a localised date string.
 */
export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/**
 * Extracts the last N sentences from a text for context overlap.
 * Used to pass the tail of a prior translation into the next batch prompt.
 */
export function getLastNSentences(text: string, n: number): string {
  if (!text || !text.trim() || n <= 0) return '';

  // Split on sentence-ending punctuation while keeping the delimiter
  const parts = text.match(/[^.!?؟]+[.!?؟]+/g);

  if (!parts || parts.length === 0) {
    // No sentence endings found — return the whole text if short enough
    return text.trim();
  }

  const lastN = parts.slice(-n);
  return lastN.map((s) => s.trim()).join(' ');
}

/**
 * Splits an array into batches (chunks) of the given size.
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new Error('batchSize must be a positive integer');
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Clamps a number between a minimum and maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce utility — returns a debounced version of the callback.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}
