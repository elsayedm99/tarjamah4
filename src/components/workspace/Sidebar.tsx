// ─────────────────────────────────────────────────────────────
// Tarjama — Sidebar Component
// ─────────────────────────────────────────────────────────────

import type { PageData } from '../../types';
import PageThumbnail from './PageThumbnail';

// ── Props ───────────────────────────────────────────────────

interface SidebarProps {
  pages: PageData[];
  selectedPages: number[];
  activePage: number;
  onSelectPage: (pageNumber: number) => void;
  onTogglePage: (pageNumber: number) => void;
  onShiftSelectPage: (pageNumber: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ── Component ───────────────────────────────────────────────

export default function Sidebar({
  pages,
  selectedPages,
  activePage,
  onSelectPage,
  onTogglePage,
  onShiftSelectPage,
  onSelectAll,
  onDeselectAll,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const translatedCount = pages.filter(
    (p) =>
      p.status === 'translated' ||
      p.status === 'edited' ||
      p.status === 'reviewed',
  ).length;

  const totalCount = pages.length;
  const progress = totalCount > 0 ? (translatedCount / totalCount) * 100 : 0;

  return (
    <aside
      className={`workspace-sidebar ${collapsed ? 'collapsed' : ''}`}
      aria-label="Page navigation sidebar"
    >
      {/* Sidebar header */}
      <div
        style={{
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Pages
          </span>

          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform var(--transition-fast)',
              }}
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>

        {/* Progress summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {translatedCount}/{totalCount} translated
          </span>
        </div>

        {/* Progress bar */}
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Select All / Deselect All */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginTop: 'var(--space-2)',
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '10px', flex: 1, padding: '2px 6px' }}
            onClick={onSelectAll}
          >
            Select All
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '10px', flex: 1, padding: '2px 6px' }}
            onClick={onDeselectAll}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Scrollable thumbnail list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {pages.map((page) => (
          <PageThumbnail
            key={page.pageNumber}
            page={page}
            isSelected={selectedPages.includes(page.pageNumber)}
            isActive={page.pageNumber === activePage}
            onClick={(e: React.MouseEvent) => {
              if (e.shiftKey) {
                onShiftSelectPage(page.pageNumber);
              } else if (e.ctrlKey || e.metaKey) {
                onTogglePage(page.pageNumber);
              } else {
                onSelectPage(page.pageNumber);
              }
            }}
          />
        ))}

        {pages.length === 0 && (
          <div
            style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
            }}
          >
            No pages
          </div>
        )}
      </div>
    </aside>
  );
}
