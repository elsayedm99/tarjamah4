// ─────────────────────────────────────────────────────────────
// Tarjama — Page Thumbnail Component
// ─────────────────────────────────────────────────────────────

import type { PageData, PageStatus } from '../../types';

// ── Props ───────────────────────────────────────────────────

interface PageThumbnailProps {
  page: PageData;
  isSelected: boolean;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

// ── Status → Color Map ─────────────────────────────────────

function getStatusColor(status: PageStatus): string {
  switch (status) {
    case 'untranslated':
      return 'var(--color-navy-500)';
    case 'in_progress':
      return 'var(--warning)';
    case 'translated':
      return 'var(--success)';
    case 'edited':
      return 'var(--info)';
    case 'reviewed':
      return 'var(--success)';
    case 'flagged':
      return 'var(--error)';
    default:
      return 'var(--color-navy-500)';
  }
}

// ── Component ───────────────────────────────────────────────

export default function PageThumbnail({
  page,
  isSelected,
  isActive,
  onClick,
}: PageThumbnailProps) {
  const handleClick = (e: React.MouseEvent) => {
    onClick(e);
  };

  const classNames = [
    'page-thumbnail',
    isSelected ? 'selected' : '',
    isActive ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Page ${page.pageNumber}`}
      aria-selected={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        aspectRatio: '3 / 4',
        background: isActive
          ? 'var(--bg-tertiary)'
          : 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Thumbnail image or placeholder */}
      {page.thumbnailDataUrl ? (
        <img
          src={page.thumbnailDataUrl}
          alt={`Page ${page.pageNumber}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          draggable={false}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            padding: 'var(--space-2)',
            textAlign: 'center',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
      )}

      {/* Status badge overlay */}
      <div
        className="page-thumbnail-status"
        title={page.status}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: getStatusColor(page.status),
            display: 'block',
            boxShadow:
              page.status === 'reviewed'
                ? `0 0 0 2px var(--success-muted)`
                : page.status === 'in_progress'
                  ? `0 0 4px ${getStatusColor(page.status)}`
                  : 'none',
          }}
        />
      </div>

      {/* Page number at the bottom */}
      <div className="page-thumbnail-number">{page.pageNumber}</div>
    </div>
  );
}
