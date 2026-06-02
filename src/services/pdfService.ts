import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// WASM decoders for JBIG2/OpenJPEG (needed for scanned PDFs)
const WASM_URL = '/pdfjs/';

/** Build standard getDocument options with WASM decoder support */
function docOptions(data: ArrayBuffer) {
  return {
    data: new Uint8Array(data.slice(0)),
    wasmUrl: WASM_URL,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
  };
}

/**
 * Helper: safely clean up a PDF document proxy.
 * pdfjs-dist v6 moved destroy() — use cleanup() as fallback.
 */
function releasePdf(pdf: pdfjsLib.PDFDocumentProxy): void {
  try {
    if (typeof pdf.cleanup === 'function') {
      pdf.cleanup();
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

/**
 * Get the total page count of a PDF document.
 */
export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const pdf = await pdfjsLib.getDocument(docOptions(data)).promise;
  const count = pdf.numPages;
  releasePdf(pdf);
  return count;
}

/**
 * Extract text content from every page of a PDF.
 * Returns an array of strings, one per page.
 * Calls onProgress(pageNumber) after each page is processed.
 */
export async function extractTextFromPdf(
  data: ArrayBuffer,
  onProgress?: (pageNumber: number) => void
): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument(docOptions(data)).promise;
  const totalPages = pdf.numPages;
  const texts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => {
        if ('str' in item) return item.str;
        return '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    texts.push(pageText);
    onProgress?.(i);
  }

  releasePdf(pdf);
  return texts;
}

/**
 * Render a specific page of a PDF to a canvas and return it as a data URL.
 * Used for generating page thumbnails.
 */
export async function renderPageThumbnail(
  data: ArrayBuffer,
  pageNumber: number,
  maxWidth: number = 150
): Promise<string> {
  const pdf = await pdfjsLib.getDocument(docOptions(data)).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    releasePdf(pdf);
    return '';
  }

  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  releasePdf(pdf);
  return dataUrl;
}

/**
 * Render a full page to a canvas element (for the left panel PDF viewer).
 * Returns the canvas so the caller can insert it into the DOM.
 */
export async function renderPageToCanvas(
  data: ArrayBuffer,
  pageNumber: number,
  containerWidth: number
): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument(docOptions(data)).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  const scale = containerWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    releasePdf(pdf);
    return canvas;
  }

  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
  }).promise;

  releasePdf(pdf);
  return canvas;
}

/**
 * Detect whether a PDF is likely a scanned document (image-based).
 * Returns true if more than half the pages have very little extractable text.
 */
export async function isScannedPdf(data: ArrayBuffer): Promise<boolean> {
  const texts = await extractTextFromPdf(data);
  const emptyPages = texts.filter((t) => t.trim().length < 20).length;
  return emptyPages > texts.length * 0.5;
}
