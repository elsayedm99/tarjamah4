// ─────────────────────────────────────────────────────────────
// Tarjama — PDF Viewer (Left Panel)
// Renders actual PDF pages as a continuous scrollable document,
// similar to Google Docs. Pages are lazily rendered using
// IntersectionObserver for performance.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageData } from '../../types';
import { useWorkspaceStore } from '../../store/workspaceStore';

// Configure the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// WASM decoders path for JBIG2/OpenJPEG (needed for scanned PDFs)
const WASM_URL = '/pdfjs/';

// ── Shared PDF document cache ───────────────────────────────
// Avoids loading the full PDF from the ArrayBuffer for every single page.

let cachedPdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let cachedPdfDataId: number = 0; // simple identity check

async function getPdfDocument(pdfData: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const dataId = pdfData.byteLength; // rough identity
  if (cachedPdfDoc && cachedPdfDataId === dataId) {
    return cachedPdfDoc;
  }
  cachedPdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfData.slice(0)),
    wasmUrl: WASM_URL,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
  }).promise;
  cachedPdfDataId = dataId;
  return cachedPdfDoc;
}

// ── Single Page Renderer ────────────────────────────────────

interface PdfPageCanvasProps {
  pdfData: ArrayBuffer;
  pageNumber: number;
  status: PageData['status'];
  isSelected: boolean;
  onClick: () => void;
  onCtrlClick: () => void;
  onShiftClick: () => void;
}

function PdfPageCanvas({
  pdfData,
  pageNumber,
  status,
  isSelected,
  onClick,
  onCtrlClick,
  onShiftClick,
}: PdfPageCanvasProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const renderingRef = useRef(false);

  // Lazy visibility detection
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // only need to detect once
        }
      },
      { rootMargin: '300px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render the page when visible
  useEffect(() => {
    if (!isVisible || imageUrl || renderingRef.current) return;
    renderingRef.current = true;

    const renderPage = async () => {
      try {
        const pdf = await getPdfDocument(pdfData);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 }); // good quality

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas context failed');

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');
        setImageUrl(dataUrl);
      } catch (err) {
        console.error(`Failed to render page ${pageNumber}:`, err);
        setError(err instanceof Error ? err.message : 'Render failed');
      } finally {
        renderingRef.current = false;
      }
    };

    renderPage();
  }, [isVisible, imageUrl, pdfData, pageNumber]);

  // Status color mapping
  const statusColors: Record<string, string> = {
    untranslated: '#6b7280',
    in_progress: 'var(--warning)',
    translated: 'var(--success)',
    edited: 'var(--info)',
    reviewed: 'var(--success)',
    flagged: 'var(--error)',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      onShiftClick();
    } else if (e.ctrlKey || e.metaKey) {
      onCtrlClick();
    } else {
      onClick();
    }
  };

  return (
    <div
      ref={sentinelRef}
      data-page={pageNumber}
      onClick={handleClick}
      style={{
        position: 'relative',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: isSelected
          ? '0 0 0 3px var(--accent), 0 4px 16px rgba(0,0,0,0.15)'
          : '0 2px 8px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Page number + status header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: isSelected ? 'rgba(212, 175, 55, 0.1)' : '#f8f9fa',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '11px',
          color: '#6b7280',
          fontWeight: 500,
        }}
      >
        <span>Page {pageNumber}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColors[status] || '#6b7280',
              display: 'inline-block',
            }}
          />
          <span style={{ textTransform: 'capitalize' }}>
            {status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Page content */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
        />
      ) : error ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#ef4444',
            fontSize: '13px',
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Failed to render: {error}
        </div>
      ) : (
        <div
          style={{
            minHeight: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            color: '#9ca3af',
            fontSize: '13px',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '3px solid #e5e7eb',
              borderTopColor: '#d4af37',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Loading page {pageNumber}…
        </div>
      )}
    </div>
  );
}

// ── Main PDF Viewer ─────────────────────────────────────────

interface PdfViewerProps {
  pages: PageData[];
  selectedPages: number[];
  activePage: number;
  onSelectPage: (pageNumber: number) => void;
  onTogglePage: (pageNumber: number) => void;
  onShiftSelectPage: (pageNumber: number) => void;
}

export default function PdfViewer({
  pages,
  selectedPages,
  activePage,
  onSelectPage,
  onTogglePage,
  onShiftSelectPage,
}: PdfViewerProps) {
  const pdfData = useWorkspaceStore((s) => s.pdfData);

  if (!pdfData) {
    // DOCX or no PDF data — show text-based fallback
    return (
      <div
        className="workspace-panel"
        style={{ overflowY: 'auto', padding: '16px' }}
      >
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          Source Document
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {pages.map((page) => (
            <div
              key={page.pageNumber}
              style={{
                background: 'var(--bg-elevated)',
                border: selectedPages.includes(page.pageNumber)
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border-primary)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
              }}
              onClick={() => onSelectPage(page.pageNumber)}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Page {page.pageNumber}
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {page.sourceText || '(No text extracted)'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="workspace-panel"
      id="pdf-scroll-panel"
      style={{ overflowY: 'auto', background: '#eef0f4' }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        Original Document
      </div>

      {/* Continuous page flow */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '16px',
        }}
      >
        {pages.map((page) => (
          <PdfPageCanvas
            key={page.pageNumber}
            pdfData={pdfData}
            pageNumber={page.pageNumber}
            status={page.status}
            isSelected={selectedPages.includes(page.pageNumber)}
            onClick={() => onSelectPage(page.pageNumber)}
            onCtrlClick={() => onTogglePage(page.pageNumber)}
            onShiftClick={() => onShiftSelectPage(page.pageNumber)}
          />
        ))}
      </div>
    </div>
  );
}
