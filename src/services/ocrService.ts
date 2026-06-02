// ─────────────────────────────────────────────────────────────
// Tarjama — OCR Service (Tesseract.js v7)
// Extracts text from scanned PDF pages using client-side OCR.
// Uses a scheduler with multiple workers for parallel processing.
// ─────────────────────────────────────────────────────────────

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// WASM decoders for JBIG2/OpenJPEG
const WASM_URL = '/pdfjs/';

/** How many Tesseract workers to run in parallel */
const NUM_WORKERS = 2;

/** Scale factor for rendering PDF pages before OCR (higher = better quality but slower) */
const OCR_RENDER_SCALE = 2;

/**
 * Renders a single PDF page to a canvas at high resolution for OCR.
 * Accepts an already-loaded PDFDocumentProxy to avoid reloading per page.
 */
async function renderPageForOcr(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(`Failed to get canvas context for page ${pageNumber}`);
  }

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
}

/**
 * Run OCR on all pages of a scanned PDF.
 *
 * @param pdfData      - The raw PDF ArrayBuffer
 * @param totalPages   - Total number of pages
 * @param onProgress   - Called with (completedPages, totalPages, currentPageText) after each page
 * @returns Array of extracted text strings, one per page
 */
export async function ocrPdfPages(
  pdfData: ArrayBuffer,
  totalPages: number,
  onProgress?: (completed: number, total: number, pageText: string) => void,
): Promise<string[]> {
  // Load the PDF document ONCE with WASM decoders for JBIG2
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfData.slice(0)),
    wasmUrl: WASM_URL,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
  }).promise;

  // Create a scheduler with multiple workers for parallel OCR
  const scheduler = Tesseract.createScheduler();

  // Spin up workers
  const workerCount = Math.min(NUM_WORKERS, totalPages);
  const workers: Tesseract.Worker[] = [];

  for (let i = 0; i < workerCount; i++) {
    const worker = await Tesseract.createWorker('eng', undefined, {});
    workers.push(worker);
    scheduler.addWorker(worker);
  }

  // Results array (indexed by page number - 1)
  const results: string[] = new Array(totalPages).fill('');
  let completedCount = 0;

  // Process pages sequentially in batches to avoid overwhelming memory
  // (each page canvas at 2x scale uses significant memory)
  const BATCH_SIZE = 4;

  for (let batchStart = 0; batchStart < totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPages);
    const batchJobs: Promise<void>[] = [];

    for (let pageIdx = batchStart; pageIdx < batchEnd; pageIdx++) {
      const pageNum = pageIdx + 1;

      const job = (async () => {
        try {
          const canvas = await renderPageForOcr(pdf, pageNum);
          const result = await scheduler.addJob('recognize', canvas);
          const text = result.data.text?.trim() || '';

          results[pageIdx] = text;
          completedCount++;
          onProgress?.(completedCount, totalPages, text);
        } catch (err) {
          console.error(`OCR failed for page ${pageNum}:`, err);
          results[pageIdx] = '';
          completedCount++;
          onProgress?.(completedCount, totalPages, '');
        }
      })();

      batchJobs.push(job);
    }

    await Promise.all(batchJobs);
  }

  // Clean up
  await scheduler.terminate();

  return results;
}

/**
 * Run OCR on a single page (useful for re-processing individual pages).
 */
export async function ocrSinglePage(
  pdfData: ArrayBuffer,
  pageNumber: number,
): Promise<string> {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfData.slice(0)),
    wasmUrl: WASM_URL,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
  }).promise;

  const canvas = await renderPageForOcr(pdf, pageNumber);
  const result = await Tesseract.recognize(canvas, 'eng');
  return result.data.text?.trim() || '';
}
