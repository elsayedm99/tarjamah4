// ─────────────────────────────────────────────────────────────
// Tarjama — Workspace Page
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSettingsStore } from '../store/settingsStore';
import Sidebar from '../components/workspace/Sidebar';
import PdfViewer from '../components/workspace/PdfViewer';
import TranslationEditor from '../components/workspace/TranslationEditor';
import Toolbar from '../components/workspace/Toolbar';
import { SettingsModal } from '../components/settings/SettingsModal';
import { useScrollSync } from '../hooks/useScrollSync';

// ── Component ───────────────────────────────────────────────

export default function WorkspacePage() {
  const navigate = useNavigate();

  // ── Store hooks ──────────────────────────────────────────
  const {
    currentProject,
    selectedPages,
    activePageNumber,
    autoTranslateState,
    scrollSyncEnabled,
    settingsModalOpen,
    setActivePage,
    togglePage,
    selectPages,
    setAutoTranslate,
    updatePageTranslation,
    updatePageStatus,
    markPageEdited,
    closeSettingsModal,
  } = useWorkspaceStore();

  const { llmConfig } = useSettingsStore();

  // ── Local state ──────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({
    current: 0,
    total: 0,
  });

  // Track last-clicked page for shift-select range
  const lastClickedPageRef = useRef<number>(1);

  // ── Scroll sync between panels ──────────────────────────
  useScrollSync(scrollSyncEnabled);

  // ── Auto-save to localStorage ──────────────────────────
  useEffect(() => {
    if (!currentProject) return;
    const timer = setTimeout(() => {
      import('../services/projectHistoryService').then(({ saveFullProject }) => {
        saveFullProject(currentProject);
      });
    }, 5000); // debounce 5s
    return () => clearTimeout(timer);
  }, [currentProject]);

  // ── Redirect if no project ──────────────────────────────
  useEffect(() => {
    if (!currentProject) {
      navigate('/', { replace: true });
    }
  }, [currentProject, navigate]);

  // ── Page selection handlers ─────────────────────────────
  const handleSelectPage = useCallback(
    (pageNumber: number) => {
      setActivePage(pageNumber);
      selectPages([pageNumber]);
      lastClickedPageRef.current = pageNumber;
    },
    [setActivePage, selectPages],
  );

  const handleShiftSelectPage = useCallback(
    (pageNumber: number) => {
      if (!currentProject) return;
      const lastClicked = lastClickedPageRef.current;
      const start = Math.min(lastClicked, pageNumber);
      const end = Math.max(lastClicked, pageNumber);
      const range: number[] = [];
      for (let i = start; i <= end; i++) range.push(i);
      selectPages(range);
      setActivePage(pageNumber);
    },
    [currentProject, selectPages, setActivePage],
  );

  const handleSelectAll = useCallback(() => {
    if (!currentProject) return;
    selectPages(currentProject.pages.map((p) => p.pageNumber));
  }, [currentProject, selectPages]);

  const handleDeselectAll = useCallback(() => {
    selectPages([]);
  }, [selectPages]);

  const handleTogglePage = useCallback(
    (pageNumber: number) => {
      togglePage(pageNumber);
    },
    [togglePage],
  );

  // ── Translate selected pages (manual button) ─────────────
  const handleTranslateSelected = useCallback(async (explicitPages?: number[]) => {
    if (!currentProject) return;

    const pageNums = explicitPages ?? selectedPages;
    if (pageNums.length === 0) {
      toast.error('No pages selected. Click pages in the sidebar or left panel first.');
      return;
    }

    if (!llmConfig.apiKey) {
      toast.error('Please set your API key in Settings before translating.');
      return;
    }

    setIsTranslating(true);
    setTranslationProgress({ current: 0, total: pageNums.length });

    try {
      const { translatePages } = await import('../services/translationService');

      const pagesToTranslate = currentProject.pages.filter((p) =>
        pageNums.includes(p.pageNumber),
      );

      const sortedNums = [...pageNums].sort((a, b) => a - b);
      const firstPageNum = sortedNums[0];
      const previousPage =
        firstPageNum > 1
          ? currentProject.pages.find((p) => p.pageNumber === firstPageNum - 1)
          : null;
      const previousTranslation = previousPage?.translatedText
        ? previousPage.translatedText.slice(-300)
        : '';

      let completedCount = 0;

      for (const pageNum of pageNums) {
        updatePageStatus(pageNum, 'in_progress');
      }

      await translatePages(
        pagesToTranslate,
        llmConfig,
        currentProject.glossary,
        currentProject.documentContext,
        previousTranslation,
        (pageNumber, translatedText, paragraphs, qualityFlags) => {
          completedCount++;
          setTranslationProgress({ current: completedCount, total: pageNums.length });
          updatePageTranslation(pageNumber, translatedText, paragraphs, qualityFlags);
          toast.success(`Page ${pageNumber} translated`);
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      toast.error(message);
    } finally {
      setIsTranslating(false);
    }
  }, [currentProject, selectedPages, llmConfig, updatePageStatus, updatePageTranslation]);

  // ── Auto-translate handler (batch-based) ────────────────
  // Processes pages in small batches with pause/stop support.
  // Reads fresh state from Zustand between batches so the user
  // can toggle it off at any time.
  const handleAutoTranslate = useCallback(async () => {
    // If already running, stop
    if (autoTranslateState === 'running') {
      setAutoTranslate('idle');
      toast.info('Auto-translate stopped');
      return;
    }

    if (!llmConfig.apiKey) {
      toast.error('Please set your API key in Settings before auto-translating.');
      return;
    }

    if (!currentProject) return;

    const untranslated = currentProject.pages
      .filter((p) => p.status === 'untranslated')
      .map((p) => p.pageNumber)
      .sort((a, b) => a - b);

    if (untranslated.length === 0) {
      toast.info('All pages are already translated');
      return;
    }

    const batchSize = currentProject.settings?.batchSize ?? 2;

    setAutoTranslate('running');
    setIsTranslating(true);
    setTranslationProgress({ current: 0, total: untranslated.length });
    selectPages(untranslated);

    toast.success(
      `Auto-translating ${untranslated.length} pages in batches of ${batchSize}…`
    );

    let completedTotal = 0;

    try {
      const { translatePages } = await import('../services/translationService');

      // Process in batches
      for (let i = 0; i < untranslated.length; i += batchSize) {
        // ── Check if user stopped ──
        const currentState = useWorkspaceStore.getState().autoTranslateState;
        if (currentState !== 'running') {
          toast.info(`Auto-translate stopped at page ${untranslated[i]}. ${completedTotal} pages completed.`);
          break;
        }

        const batchPageNums = untranslated.slice(i, i + batchSize);

        // Get fresh project state for this batch
        const freshProject = useWorkspaceStore.getState().currentProject;
        if (!freshProject) break;

        const batchPages = freshProject.pages.filter((p) =>
          batchPageNums.includes(p.pageNumber),
        );

        // Get continuity from the page before this batch
        const firstInBatch = batchPageNums[0];
        const prevPage = freshProject.pages.find((p) => p.pageNumber === firstInBatch - 1);
        const prevTranslation = prevPage?.translatedText
          ? prevPage.translatedText.slice(-300)
          : '';

        // Mark batch as in_progress
        for (const pn of batchPageNums) {
          updatePageStatus(pn, 'in_progress');
        }

        // Translate this batch
        await translatePages(
          batchPages,
          llmConfig,
          freshProject.glossary,
          freshProject.documentContext,
          prevTranslation,
          (pageNumber, translatedText, paragraphs, qualityFlags) => {
            completedTotal++;
            setTranslationProgress({ current: completedTotal, total: untranslated.length });
            updatePageTranslation(pageNumber, translatedText, paragraphs, qualityFlags);
          },
        );

        toast.success(
          `Batch done — pages ${batchPageNums[0]}–${batchPageNums[batchPageNums.length - 1]}. ` +
          `(${completedTotal}/${untranslated.length})`
        );

        // Small delay between batches to avoid rate limits
        if (i + batchSize < untranslated.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (completedTotal === untranslated.length) {
        toast.success(`All ${untranslated.length} pages translated!`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      toast.error(`Auto-translate error on batch: ${message}. ${completedTotal} pages completed so far.`);
    } finally {
      setIsTranslating(false);
      setAutoTranslate('idle');
    }
  }, [
    autoTranslateState,
    setAutoTranslate,
    llmConfig,
    currentProject,
    selectPages,
    updatePageStatus,
    updatePageTranslation,
  ]);

  // ── Editor update handler (per-page) ─────────────────────
  const handlePageUpdate = useCallback(
    (pageNumber: number, html: string) => {
      if (!currentProject) return;
      const page = currentProject.pages.find((p) => p.pageNumber === pageNumber);
      if (!page) return;

      updatePageTranslation(
        pageNumber,
        html,
        page.paragraphs,
        page.qualityFlags,
      );
    },
    [currentProject, updatePageTranslation],
  );

  const handleManualEdit = useCallback(
    (pageNumber: number) => {
      markPageEdited(pageNumber);
    },
    [markPageEdited],
  );

  // ── Stop translation handler ─────────────────────────────
  const handleStopTranslation = useCallback(() => {
    setAutoTranslate('idle');
    setIsTranslating(false);
    toast.info('Translation stopped.');
  }, [setAutoTranslate]);

  // ── Escape key to stop ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTranslating) {
        handleStopTranslation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTranslating, handleStopTranslation]);

  // ── Guard render ────────────────────────────────────────
  if (!currentProject) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>Loading workspace…</p>
      </div>
    );
  }

  const pages = currentProject.pages;

  return (
    <div className="workspace">
      {/* Sidebar */}
      <Sidebar
        pages={pages}
        selectedPages={selectedPages}
        activePage={activePageNumber}
        onSelectPage={handleSelectPage}
        onTogglePage={handleTogglePage}
        onShiftSelectPage={handleShiftSelectPage}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div className="workspace-main">
        {/* Toolbar */}
        <Toolbar
          onTranslateSelected={handleTranslateSelected}
          onAutoTranslate={handleAutoTranslate}
          onStopTranslation={handleStopTranslation}
          isTranslating={isTranslating}
        />

        {/* Translation progress bar */}
        {isTranslating && translationProgress.total > 0 && (
          <div
            style={{
              padding: '0 var(--space-4)',
              paddingTop: 'var(--space-2)',
              background: 'var(--bg-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-1)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                Translating…
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {translationProgress.current}/{translationProgress.total}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(translationProgress.current / translationProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Panels: PDF Viewer | Translation Editor */}
        <div className="workspace-panels">
          {/* Left panel — Original document (continuous scroll) */}
          <PdfViewer
            pages={pages}
            selectedPages={selectedPages}
            activePage={activePageNumber}
            onSelectPage={handleSelectPage}
            onTogglePage={handleTogglePage}
            onShiftSelectPage={handleShiftSelectPage}
          />

          {/* Resizable divider */}
          <div className="workspace-divider" />

          {/* Right panel — Translation (continuous scroll) */}
          <TranslationEditor
            pages={pages}
            onUpdatePage={handlePageUpdate}
            onManualEdit={handleManualEdit}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsModalOpen} onClose={closeSettingsModal} />
    </div>
  );
}

