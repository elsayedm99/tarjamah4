// ─────────────────────────────────────────────────────────────
// Tarjama — Toolbar Component
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';

// ── Props ───────────────────────────────────────────────────

interface ToolbarProps {
  onTranslateSelected: () => void;
  onAutoTranslate: () => void;
  onStopTranslation: () => void;
  isTranslating: boolean;
}

// ── Component ───────────────────────────────────────────────

export default function Toolbar({
  onTranslateSelected,
  onAutoTranslate,
  onStopTranslation,
  isTranslating,
}: ToolbarProps) {
  const {
    selectedPages,
    scrollSyncEnabled,
    toggleScrollSync,
    autoTranslateState,
    openSettingsModal,
    currentProject,
  } = useWorkspaceStore();

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Build page range display string
  const pageRangeDisplay = (() => {
    if (selectedPages.length === 0) return 'No pages selected';
    if (selectedPages.length === 1) return `Page ${selectedPages[0]}`;

    // Check for contiguous range
    const sorted = [...selectedPages].sort((a, b) => a - b);
    const isContiguous = sorted.every(
      (val, i) => i === 0 || val === sorted[i - 1] + 1,
    );

    if (isContiguous) {
      return `Pages ${sorted[0]}–${sorted[sorted.length - 1]}`;
    }

    // Show first few and count
    if (sorted.length <= 3) {
      return `Pages ${sorted.join(', ')}`;
    }
    return `${sorted.length} pages selected`;
  })();

  return (
    <div className="workspace-toolbar">
      {/* Left: Back + Branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <Link
          to="/"
          className="btn btn-ghost btn-icon btn-sm"
          title="Back to home"
          aria-label="Back to home"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>

        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--accent)',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ fontFamily: 'var(--font-arabic)' }}>ترجمة</span>{' '}
          Tarjama
        </span>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '24px',
            background: 'var(--border-primary)',
          }}
        />

        {/* Project name */}
        {currentProject && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={currentProject.fileName}
          >
            {currentProject.fileName}
          </span>
        )}
      </div>

      {/* Center: Page range + Scroll sync */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        {/* Page range display */}
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {pageRangeDisplay}
        </span>

        {/* Scroll sync toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <label className="toggle" title="Toggle scroll sync">
            <input
              type="checkbox"
              checked={scrollSyncEnabled}
              onChange={toggleScrollSync}
            />
            <span className="toggle-slider" />
          </label>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            Sync
          </span>
        </div>
      </div>

      {/* Right: Action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        {/* Translate selected / Stop */}
        {isTranslating ? (
          <button
            className="btn btn-sm"
            onClick={onStopTranslation}
            title="Stop translation (Esc)"
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onTranslateSelected()}
            disabled={selectedPages.length === 0}
            title="Translate selected pages (Ctrl+Enter)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
            Translate
          </button>
        )}

        {/* Auto-translate toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <label className="toggle" title="Auto-translate toggle">
            <input
              type="checkbox"
              checked={autoTranslateState === 'running'}
              onChange={onAutoTranslate}
              disabled={isTranslating}
            />
            <span className="toggle-slider" />
          </label>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            Auto
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '24px',
            background: 'var(--border-primary)',
          }}
        />

        {/* Export dropdown */}
        <div className="dropdown" style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExportDropdownOpen(!exportDropdownOpen);
            }}
            title="Export document"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>

          {exportDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99,
                }}
                onClick={() => setExportDropdownOpen(false)}
              />
              <div className="dropdown-menu" style={{ zIndex: 100 }}>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExportDropdownOpen(false);
                    if (!currentProject) return;
                    try {
                      const { exportToDocx } = await import('../../services/exportService');
                      await exportToDocx(currentProject.name, currentProject.pages, {
                        includeSource: false,
                        includePageNumbers: true,
                      });
                    } catch (err) {
                      console.error('DOCX export failed:', err);
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 15l2 2 4-4" />
                  </svg>
                  Export as DOCX
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExportDropdownOpen(false);
                    if (!currentProject) return;
                    try {
                      const { exportToDocx } = await import('../../services/exportService');
                      await exportToDocx(currentProject.name, currentProject.pages, {
                        includeSource: true,
                        includePageNumbers: true,
                      });
                    } catch (err) {
                      console.error('DOCX (bilingual) export failed:', err);
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  DOCX (bilingual)
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExportDropdownOpen(false);
                    if (!currentProject) return;
                    try {
                      const { exportToPdf } = await import('../../services/exportService');
                      await exportToPdf(currentProject.name, currentProject.pages);
                    } catch (err) {
                      console.error('PDF export failed:', err);
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Export as PDF
                </button>
              </div>
            </>
          )}
        </div>

        {/* Settings gear */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={openSettingsModal}
          title="Settings (Ctrl+,)"
          aria-label="Open settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
