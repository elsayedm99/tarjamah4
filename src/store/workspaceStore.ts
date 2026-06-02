// ─────────────────────────────────────────────────────────────
// Tarjama — Workspace Store (in-memory, per-session)
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type {
  PageData,
  PageStatus,
  ParagraphPair,
  Project,
  QualityFlag,
  TranslationBatch,
} from '../types';

// ── State Shape ─────────────────────────────────────────────

interface WorkspaceState {
  // Project
  currentProject: Project | null;

  // Raw PDF data for rendering pages in viewer
  pdfData: ArrayBuffer | null;

  // Page selection (multi-select for batch translation)
  selectedPages: number[];

  // View & scroll
  scrollSyncEnabled: boolean;
  activePageNumber: number;

  // Auto-translate state machine
  autoTranslateState: 'idle' | 'running' | 'paused';

  // Translation queue
  translationQueue: TranslationBatch[];

  // Paragraph highlight (for linked scrolling between panels)
  activeHighlightParagraph: string | null;

  // Modal states
  settingsModalOpen: boolean;
  glossaryModalOpen: boolean;
  exportModalOpen: boolean;
}

// ── Actions ─────────────────────────────────────────────────

interface WorkspaceActions {
  // Project
  setProject: (project: Project | null) => void;
  updateProject: (updates: Partial<Project>) => void;
  setPdfData: (data: ArrayBuffer | null) => void;

  // Page selection
  selectPages: (pageNumbers: number[]) => void;
  togglePage: (pageNumber: number) => void;
  selectAllPages: () => void;
  selectUntranslatedPages: () => void;
  clearSelection: () => void;

  // Active page
  setActivePage: (pageNumber: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;

  // Scroll sync
  toggleScrollSync: () => void;
  setScrollSync: (enabled: boolean) => void;

  // Auto-translate
  setAutoTranslate: (state: 'idle' | 'running' | 'paused') => void;

  // Translation queue
  addToQueue: (batch: TranslationBatch) => void;
  removeFromQueue: (batchId: string) => void;
  updateBatchStatus: (
    batchId: string,
    status: TranslationBatch['status'],
    error?: string,
  ) => void;
  clearQueue: () => void;

  // Page translation updates
  updatePageTranslation: (
    pageNumber: number,
    translatedText: string,
    paragraphs: ParagraphPair[],
    qualityFlags: QualityFlag[],
  ) => void;
  updatePageStatus: (pageNumber: number, status: PageStatus) => void;
  updatePageSourceText: (pageNumber: number, sourceText: string) => void;
  markPageEdited: (pageNumber: number) => void;
  markPageReviewed: (pageNumber: number) => void;

  // Paragraph-level updates
  updateParagraphTranslation: (
    pageNumber: number,
    paragraphId: string,
    translatedText: string,
  ) => void;
  markParagraphReviewed: (pageNumber: number, paragraphId: string) => void;

  // Paragraph highlight
  setHighlightParagraph: (paragraphId: string | null) => void;

  // Modals
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openGlossaryModal: () => void;
  closeGlossaryModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  closeAllModals: () => void;

  // Reset
  resetWorkspace: () => void;
}

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_WORKSPACE: WorkspaceState = {
  currentProject: null,
  pdfData: null,
  selectedPages: [],
  scrollSyncEnabled: true,
  activePageNumber: 1,
  autoTranslateState: 'idle',
  translationQueue: [],
  activeHighlightParagraph: null,
  settingsModalOpen: false,
  glossaryModalOpen: false,
  exportModalOpen: false,
};

// ── Helper: update a single page in the project ─────────────

function updatePage(
  project: Project,
  pageNumber: number,
  updater: (page: PageData) => PageData,
): Project {
  return {
    ...project,
    updatedAt: Date.now(),
    pages: project.pages.map((page) =>
      page.pageNumber === pageNumber ? updater(page) : page,
    ),
  };
}

// ── Store ───────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  (set, get) => ({
    ...DEFAULT_WORKSPACE,

    // ── Project ───────────────────────────────────────────

    setProject: (project) =>
      set({
        currentProject: project,
        selectedPages: [],
        activePageNumber: 1,
        translationQueue: [],
        autoTranslateState: 'idle',
        activeHighlightParagraph: null,
      }),

    setPdfData: (data) => set({ pdfData: data }),

    updateProject: (updates) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: {
            ...state.currentProject,
            ...updates,
            updatedAt: Date.now(),
          },
        };
      }),

    // ── Page Selection ────────────────────────────────────

    selectPages: (pageNumbers) => set({ selectedPages: pageNumbers }),

    togglePage: (pageNumber) =>
      set((state) => {
        const isSelected = state.selectedPages.includes(pageNumber);
        return {
          selectedPages: isSelected
            ? state.selectedPages.filter((p) => p !== pageNumber)
            : [...state.selectedPages, pageNumber].sort((a, b) => a - b),
        };
      }),

    selectAllPages: () =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          selectedPages: state.currentProject.pages.map((p) => p.pageNumber),
        };
      }),

    selectUntranslatedPages: () =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          selectedPages: state.currentProject.pages
            .filter((p) => p.status === 'untranslated')
            .map((p) => p.pageNumber),
        };
      }),

    clearSelection: () => set({ selectedPages: [] }),

    // ── Active Page ───────────────────────────────────────

    setActivePage: (pageNumber) => set({ activePageNumber: pageNumber }),

    goToNextPage: () =>
      set((state) => {
        if (!state.currentProject) return state;
        const maxPage = state.currentProject.totalPages;
        return {
          activePageNumber: Math.min(state.activePageNumber + 1, maxPage),
        };
      }),

    goToPrevPage: () =>
      set((state) => ({
        activePageNumber: Math.max(state.activePageNumber - 1, 1),
      })),

    // ── Scroll Sync ───────────────────────────────────────

    toggleScrollSync: () =>
      set((state) => ({ scrollSyncEnabled: !state.scrollSyncEnabled })),

    setScrollSync: (enabled) => set({ scrollSyncEnabled: enabled }),

    // ── Auto-Translate ────────────────────────────────────

    setAutoTranslate: (autoTranslateState) => set({ autoTranslateState }),

    // ── Translation Queue ─────────────────────────────────

    addToQueue: (batch) =>
      set((state) => ({
        translationQueue: [...state.translationQueue, batch],
      })),

    removeFromQueue: (batchId) =>
      set((state) => ({
        translationQueue: state.translationQueue.filter(
          (b) => b.id !== batchId,
        ),
      })),

    updateBatchStatus: (batchId, status, error) =>
      set((state) => ({
        translationQueue: state.translationQueue.map((b) =>
          b.id === batchId
            ? {
                ...b,
                status,
                ...(error !== undefined ? { error } : {}),
                retryCount:
                  status === 'failed' ? b.retryCount + 1 : b.retryCount,
              }
            : b,
        ),
      })),

    clearQueue: () =>
      set({ translationQueue: [], autoTranslateState: 'idle' }),

    // ── Page Translation Updates ──────────────────────────

    updatePageTranslation: (pageNumber, translatedText, paragraphs, qualityFlags) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({
              ...page,
              translatedText,
              paragraphs,
              qualityFlags,
              status: qualityFlags.some((f) => f.severity === 'error')
                ? 'flagged'
                : 'translated',
            }),
          ),
        };
      }),

    updatePageStatus: (pageNumber, status) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({ ...page, status }),
          ),
        };
      }),

    updatePageSourceText: (pageNumber, sourceText) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({ ...page, sourceText }),
          ),
        };
      }),

    markPageEdited: (pageNumber) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({
              ...page,
              isManuallyEdited: true,
              status: 'edited',
            }),
          ),
        };
      }),

    markPageReviewed: (pageNumber) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({
              ...page,
              isReviewed: true,
              status: 'reviewed',
            }),
          ),
        };
      }),

    // ── Paragraph-level Updates ───────────────────────────

    updateParagraphTranslation: (pageNumber, paragraphId, translatedText) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({
              ...page,
              isManuallyEdited: true,
              status: 'edited',
              paragraphs: page.paragraphs.map((para) =>
                para.id === paragraphId
                  ? { ...para, translatedText, isManuallyEdited: true }
                  : para,
              ),
            }),
          ),
        };
      }),

    markParagraphReviewed: (pageNumber, paragraphId) =>
      set((state) => {
        if (!state.currentProject) return state;
        return {
          currentProject: updatePage(
            state.currentProject,
            pageNumber,
            (page) => ({
              ...page,
              paragraphs: page.paragraphs.map((para) =>
                para.id === paragraphId
                  ? { ...para, isReviewed: true }
                  : para,
              ),
            }),
          ),
        };
      }),

    // ── Paragraph Highlight ───────────────────────────────

    setHighlightParagraph: (paragraphId) =>
      set({ activeHighlightParagraph: paragraphId }),

    // ── Modals ────────────────────────────────────────────

    openSettingsModal: () => set({ settingsModalOpen: true }),
    closeSettingsModal: () => set({ settingsModalOpen: false }),
    openGlossaryModal: () => set({ glossaryModalOpen: true }),
    closeGlossaryModal: () => set({ glossaryModalOpen: false }),
    openExportModal: () => set({ exportModalOpen: true }),
    closeExportModal: () => set({ exportModalOpen: false }),
    closeAllModals: () =>
      set({
        settingsModalOpen: false,
        glossaryModalOpen: false,
        exportModalOpen: false,
      }),

    // ── Reset ─────────────────────────────────────────────

    resetWorkspace: () => set({ ...DEFAULT_WORKSPACE }),
  }),
);
