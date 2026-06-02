// ─────────────────────────────────────────────────────────────
// Tarjama — Translation Panel (Right Panel)
// Continuous flowing Arabic translation across all pages,
// similar to Google Docs. Each page section is independently
// editable and shows its page number as a divider.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { PageData } from '../../types';

// ── Single Page Editor ──────────────────────────────────────

interface PageEditorProps {
  page: PageData;
  onUpdate: (pageNumber: number, html: string) => void;
  onManualEdit: (pageNumber: number) => void;
}

function PageEditor({ page, onUpdate, onManualEdit }: PageEditorProps) {
  const isExternalUpdate = useRef(false);
  const hasUserTyped = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: page.translatedText || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        dir: 'rtl',
        lang: 'ar',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdate.current) return;

      const html = ed.getHTML();
      onUpdate(page.pageNumber, html);

      if (!hasUserTyped.current) {
        hasUserTyped.current = true;
        onManualEdit(page.pageNumber);
      }
    },
  });

  // Sync external content changes (new translation arrives)
  useEffect(() => {
    if (!editor) return;
    const currentContent = editor.getHTML();
    if (currentContent === page.translatedText) return;

    // Only sync if user hasn't manually edited this page
    if (hasUserTyped.current) return;

    isExternalUpdate.current = true;
    editor.commands.setContent(page.translatedText || '', false);
    isExternalUpdate.current = false;
  }, [page.translatedText, editor]);

  const statusLabel = (() => {
    switch (page.status) {
      case 'untranslated':
        return null;
      case 'in_progress':
        return { text: 'Translating…', color: 'var(--warning)' };
      case 'translated':
        return { text: 'Translated', color: 'var(--success)' };
      case 'edited':
        return { text: 'Edited', color: 'var(--info)' };
      case 'reviewed':
        return { text: 'Reviewed', color: 'var(--success)' };
      case 'flagged':
        return { text: 'Flagged', color: 'var(--error)' };
      default:
        return null;
    }
  })();

  const isEmpty = !page.translatedText || page.translatedText === '<p></p>';

  return (
    <div
      data-page={page.pageNumber}
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-primary)',
      }}
    >
      {/* Page divider header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--font-medium)',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-arabic)', direction: 'rtl' }}>
          صفحة {page.pageNumber}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {statusLabel && (
            <span className={`badge badge-${page.status === 'flagged' ? 'error' : page.status === 'edited' ? 'info' : page.status === 'in_progress' ? 'warning' : 'success'}`}>
              {statusLabel.text}
            </span>
          )}
          <span>Page {page.pageNumber}</span>
        </div>
      </div>

      {/* Editor or placeholder */}
      {page.status === 'in_progress' ? (
        <div
          style={{
            padding: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            minHeight: '200px',
            color: 'var(--text-muted)',
          }}
        >
          <div className="spinner" />
          <span style={{ fontSize: 'var(--text-sm)' }}>Translating page {page.pageNumber}…</span>
        </div>
      ) : isEmpty && page.status === 'untranslated' ? (
        <div
          style={{
            padding: 'var(--space-8) var(--space-6)',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-arabic)',
            direction: 'rtl',
          }}
        >
          الترجمة العربية ستظهر هنا…
        </div>
      ) : (
        <div style={{ minHeight: '100px' }}>
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          )}
        </div>
      )}

      {/* Quality flags */}
      {page.qualityFlags.length > 0 && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-1)',
          }}
        >
          {page.qualityFlags.map((flag, idx) => (
            <span
              key={idx}
              className={`badge badge-${flag.severity === 'error' ? 'error' : 'warning'}`}
              title={flag.message}
            >
              {flag.type === 'abbreviation' ? '⚠ Possible abbreviation' :
               flag.type === 'sentence_mismatch' ? '⚠ Sentence count mismatch' :
               '⚠ Paragraph mismatch'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Translation Panel ──────────────────────────────────

interface TranslationEditorProps {
  pages: PageData[];
  onUpdatePage: (pageNumber: number, html: string) => void;
  onManualEdit: (pageNumber: number) => void;
}

export default function TranslationEditor({
  pages,
  onUpdatePage,
  onManualEdit,
}: TranslationEditorProps) {
  return (
    <div
      className="workspace-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-4)',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Translation
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-arabic)',
            direction: 'rtl',
          }}
        >
          العربية
        </span>
      </div>

      {/* Scrollable continuous translation */}
      <div
        id="translation-scroll-panel"
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-tertiary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
          }}
        >
          {pages.map((page) => (
            <PageEditor
              key={page.pageNumber}
              page={page}
              onUpdate={onUpdatePage}
              onManualEdit={onManualEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
