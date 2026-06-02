// ─────────────────────────────────────────────────────────────
// Tarjama — Constants
// ─────────────────────────────────────────────────────────────

import type { GlossaryEntry, ModelOption } from '../types';

// ── Batch Size ──────────────────────────────────────────────

export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 3;
export const DEFAULT_BATCH_SIZE = 1;

// ── Max Retry Count ─────────────────────────────────────────

export const MAX_RETRY_COUNT = 3;

// ── System Prompt Builder ───────────────────────────────────

/**
 * Builds the full system prompt injected into every translation request.
 *
 * @param glossary  – Active glossary entries (locked entries are enforced)
 * @param context   – Optional document-level context string
 * @param prevText  – Last 2-3 translated sentences for continuity
 */
export function buildSystemPrompt(
  glossary: GlossaryEntry[],
  context: string = '',
  prevText: string = '',
): string {
  const lockedTerms = glossary.filter((g) => g.isLocked);
  const suggestedTerms = glossary.filter((g) => !g.isLocked);

  const glossaryBlock = lockedTerms.length
    ? `
## Mandatory Terminology (MUST be used exactly as specified)
${lockedTerms.map((g) => `- "${g.english}" → "${g.arabic}"`).join('\n')}`
    : '';

  const suggestedBlock = suggestedTerms.length
    ? `
## Suggested Terminology (prefer these translations when applicable)
${suggestedTerms.map((g) => `- "${g.english}" → "${g.arabic}"`).join('\n')}`
    : '';

  const contextBlock = context
    ? `
## Document Context
${context}`
    : '';

  const continuityBlock = prevText
    ? `
## Previous Translation (last sentences for continuity — do NOT repeat these)
${prevText}`
    : '';

  return `You are a professional legal translator specialising in translating Irish court documents from English to Arabic.

## Core Rules
1. Translate the provided English text into Modern Standard Arabic (فصحى).
2. Maintain the exact paragraph structure of the source text. Every source paragraph must map to exactly one translated paragraph, in the same order.
3. Preserve all legal terminology with precision. Use the mandatory terminology listed below without exception.
4. Do NOT add, remove, or merge paragraphs. Do NOT add explanatory notes, headers, or footnotes that are not in the source.
5. Maintain the formal register appropriate for court documents.
6. Keep proper nouns (names of persons, places, and institutions) in their original English form unless a well-established Arabic equivalent exists.
7. Preserve all numbers, dates, case references, and statutory citations exactly as they appear in the source.
8. For abbreviations (e.g., "S.I.", "J.", "C.J."), provide the Arabic translation followed by the original abbreviation in parentheses on first occurrence.
9. Ensure grammatical agreement (gender, number, case) in all Arabic output.
10. Output ONLY the Arabic translation — no commentary, no markup, no annotations.
${glossaryBlock}
${suggestedBlock}
${contextBlock}
${continuityBlock}`.trim();
}

// ── Default Irish Legal Glossary ────────────────────────────

let _glossaryIdCounter = 0;
function glossaryEntry(
  english: string,
  arabic: string,
  isLocked = true,
): GlossaryEntry {
  _glossaryIdCounter += 1;
  return {
    id: `default_${_glossaryIdCounter}`,
    english,
    arabic,
    isLocked,
    source: 'default' as const,
  };
}

export const DEFAULT_GLOSSARY: GlossaryEntry[] = [
  // Courts & institutions
  glossaryEntry('High Court', 'المحكمة العليا'),
  glossaryEntry('Supreme Court', 'المحكمة العليا العظمى'),
  glossaryEntry('Court of Appeal', 'محكمة الاستئناف'),
  glossaryEntry('Circuit Court', 'المحكمة الدائرية'),
  glossaryEntry('District Court', 'محكمة المقاطعة'),
  glossaryEntry('Central Criminal Court', 'المحكمة الجنائية المركزية'),

  // Judicial titles
  glossaryEntry('Chief Justice', 'رئيس القضاة'),
  glossaryEntry('Judge', 'القاضي'),
  glossaryEntry('Mr. Justice', 'السيد القاضي'),
  glossaryEntry('Ms. Justice', 'السيدة القاضية'),
  glossaryEntry('Registrar', 'مسجّل المحكمة'),

  // Parties
  glossaryEntry('Applicant', 'مقدّم الطلب'),
  glossaryEntry('Respondent', 'المدّعى عليه'),
  glossaryEntry('Plaintiff', 'المدّعي'),
  glossaryEntry('Defendant', 'المتهم'),
  glossaryEntry('Appellant', 'المستأنف'),
  glossaryEntry('Notice Party', 'الطرف المبلّغ'),

  // Procedural terms
  glossaryEntry('Judicial Review', 'المراجعة القضائية'),
  glossaryEntry('Affidavit', 'إفادة مشفوعة بالقسم'),
  glossaryEntry('Statutory Instrument', 'الصكّ القانوني'),
  glossaryEntry('Order of Certiorari', 'أمر النقض'),
  glossaryEntry('Leave to Appeal', 'إذن بالاستئناف'),
  glossaryEntry('Injunction', 'أمر قضائي'),
  glossaryEntry('Stay of Proceedings', 'وقف الإجراءات'),
  glossaryEntry('Submission', 'مرافعة'),
  glossaryEntry('Ruling', 'حكم'),
  glossaryEntry('Judgment', 'قرار المحكمة'),

  // Legislation
  glossaryEntry('Act of the Oireachtas', 'قانون صادر عن البرلمان الأيرلندي'),
  glossaryEntry('Constitution of Ireland', 'دستور أيرلندا'),
  glossaryEntry('Bunreacht na hÉireann', 'الدستور الأيرلندي'),

  // Substantive law
  glossaryEntry('International Protection', 'الحماية الدولية'),
  glossaryEntry('Subsidiary Protection', 'الحماية الفرعية'),
  glossaryEntry('Deportation Order', 'أمر الترحيل'),
  glossaryEntry('Refugee Status', 'صفة اللاجئ'),
  glossaryEntry('Leave to Remain', 'إذن بالإقامة'),
];

// ── Available Models ────────────────────────────────────────

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },

  // Anthropic
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },

  // Gemini
  { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', provider: 'gemini' },
  { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
];

/** Returns the default model ID for a given provider */
export function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-sonnet-4-20250514';
    case 'gemini':
      return 'gemini-2.5-flash-preview-05-20';
    default:
      return 'gpt-4o';
  }
}

/** Returns models available for a specific provider */
export function getModelsForProvider(provider: string): ModelOption[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider);
}

// ── Keyboard Shortcuts ──────────────────────────────────────

export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  description: string;
  action: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Translation
  {
    key: 'Enter',
    modifiers: ['ctrl'],
    description: 'Translate selected pages',
    action: 'translate_selected',
  },
  {
    key: 'Enter',
    modifiers: ['ctrl', 'shift'],
    description: 'Translate all untranslated pages',
    action: 'translate_all',
  },

  // Navigation
  {
    key: 'ArrowDown',
    modifiers: ['alt'],
    description: 'Next page',
    action: 'next_page',
  },
  {
    key: 'ArrowUp',
    modifiers: ['alt'],
    description: 'Previous page',
    action: 'prev_page',
  },

  // Selection
  {
    key: 'a',
    modifiers: ['ctrl'],
    description: 'Select all pages',
    action: 'select_all',
  },
  {
    key: 'u',
    modifiers: ['ctrl'],
    description: 'Select untranslated pages',
    action: 'select_untranslated',
  },

  // Editing
  {
    key: 'e',
    modifiers: ['ctrl'],
    description: 'Toggle edit mode on active paragraph',
    action: 'toggle_edit',
  },
  {
    key: 's',
    modifiers: ['ctrl'],
    description: 'Save current edits',
    action: 'save',
  },
  {
    key: 'z',
    modifiers: ['ctrl'],
    description: 'Undo last edit',
    action: 'undo',
  },

  // Panels / modals
  {
    key: ',',
    modifiers: ['ctrl'],
    description: 'Open settings',
    action: 'open_settings',
  },
  {
    key: 'g',
    modifiers: ['ctrl'],
    description: 'Open glossary',
    action: 'open_glossary',
  },
  {
    key: 'e',
    modifiers: ['ctrl', 'shift'],
    description: 'Open export dialog',
    action: 'open_export',
  },
  {
    key: 'Escape',
    modifiers: [],
    description: 'Close modal / deselect',
    action: 'close_modal',
  },

  // View
  {
    key: 'l',
    modifiers: ['ctrl'],
    description: 'Toggle scroll sync',
    action: 'toggle_scroll_sync',
  },
];

// ── Provider API Endpoints ──────────────────────────────────

export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

// ── Theme CSS Custom Properties ─────────────────────────────

export const THEME = {
  dark: {
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-tertiary': '#334155',
    '--bg-hover': '#475569',
    '--text-primary': '#ffffff',
    '--text-secondary': '#94a3b8',
    '--text-muted': '#64748b',
    '--accent': '#d4a843',
    '--accent-hover': '#e0b85a',
    '--accent-muted': 'rgba(212, 168, 67, 0.15)',
    '--border': '#334155',
    '--border-subtle': '#1e293b',
    '--success': '#22c55e',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8fafc',
    '--bg-tertiary': '#f1f5f9',
    '--bg-hover': '#e2e8f0',
    '--text-primary': '#0f172a',
    '--text-secondary': '#475569',
    '--text-muted': '#94a3b8',
    '--accent': '#b8922e',
    '--accent-hover': '#9a7a24',
    '--accent-muted': 'rgba(184, 146, 46, 0.1)',
    '--border': '#e2e8f0',
    '--border-subtle': '#f1f5f9',
    '--success': '#16a34a',
    '--warning': '#d97706',
    '--error': '#dc2626',
    '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.07)',
  },
} as const;
