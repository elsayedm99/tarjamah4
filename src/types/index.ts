// ─────────────────────────────────────────────────────────────
// Tarjama — Type Definitions
// ─────────────────────────────────────────────────────────────

// ── LLM Provider Types ──────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: { input: number; output: number };
}

export interface ModelOption {
  id: string;
  name: string;
  provider: LLMProvider;
}

// ── Project & Document Types ────────────────────────────────

export interface Project {
  id: string;
  name: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  totalPages: number;
  createdAt: number;
  updatedAt: number;
  pages: PageData[];
  glossary: GlossaryEntry[];
  documentContext: DocumentContext | null;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  /** Number of pages to send per translation batch (1–3) */
  batchSize: number;
  autoTranslateEnabled: boolean;
}

export interface PageData {
  pageNumber: number;
  sourceText: string;
  translatedText: string;
  status: PageStatus;
  paragraphs: ParagraphPair[];
  isManuallyEdited: boolean;
  isReviewed: boolean;
  qualityFlags: QualityFlag[];
  thumbnailDataUrl?: string;
}

export type PageStatus =
  | 'untranslated'
  | 'in_progress'
  | 'translated'
  | 'edited'
  | 'reviewed'
  | 'flagged';

export interface ParagraphPair {
  id: string;
  sourceIndex: number;
  sourceText: string;
  translatedText: string;
  isManuallyEdited: boolean;
  isReviewed: boolean;
}

export interface QualityFlag {
  type: 'abbreviation' | 'sentence_mismatch' | 'paragraph_mismatch';
  severity: 'warning' | 'error';
  message: string;
  sourceSentenceCount?: number;
  targetSentenceCount?: number;
}

// ── Document Context ────────────────────────────────────────

export interface DocumentContext {
  caseNumber?: string;
  courtName?: string;
  judgeName?: string;
  applicantName?: string;
  respondentName?: string;
  date?: string;
  /** First 2 pages summarised – injected into every prompt for coherence */
  rawSummary: string;
}

// ── Glossary ────────────────────────────────────────────────

export interface GlossaryEntry {
  id: string;
  english: string;
  arabic: string;
  /** Locked terms are enforced strictly in every translation prompt */
  isLocked: boolean;
  source: 'default' | 'user' | 'auto_extracted';
}

// ── Export Types ─────────────────────────────────────────────

export type ExportFormat = 'docx' | 'pdf';
export type BilingualLayout = 'side_by_side' | 'interleaved' | 'none';

export interface ExportOptions {
  format: ExportFormat;
  bilingualLayout: BilingualLayout;
  includeCertification: boolean;
  certification?: CertificationDetails;
}

export interface CertificationDetails {
  translatorName: string;
  credentials: string;
  registrationNumber: string;
  caseReference: string;
  declarationText: string;
  date: string;
}

// ── Translation Batch ───────────────────────────────────────

export interface TranslationBatch {
  id: string;
  pageNumbers: number[];
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
}

// ── App Settings ────────────────────────────────────────────

export interface AppSettings {
  llmConfig: LLMConfig;
  theme: 'dark' | 'light';
  certification: CertificationDetails | null;
}

// ── Translation Request / Response ──────────────────────────

export interface TranslationRequest {
  sourceText: string;
  documentContext: DocumentContext | null;
  /** Last 2–3 sentences of prior translation for continuity */
  previousTranslation: string;
  glossary: GlossaryEntry[];
}

export interface TranslationResult {
  translatedText: string;
  paragraphs: ParagraphPair[];
  qualityFlags: QualityFlag[];
}
