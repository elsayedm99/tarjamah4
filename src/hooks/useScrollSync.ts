// ─────────────────────────────────────────────────────────────
// Tarjama — useScrollSync hook
// Syncs scroll position between PDF viewer and Translation editor.
// When the user scrolls one panel, the other panel scrolls to
// show the matching page.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

/**
 * Find which page is most visible in a scroll container.
 * Returns the page number (data-page attribute) of the element
 * closest to the top of the viewport.
 */
function getVisiblePageNumber(container: HTMLElement): number | null {
  const pageElements = container.querySelectorAll<HTMLElement>('[data-page]');
  if (pageElements.length === 0) return null;

  const containerTop = container.scrollTop;
  const containerMid = containerTop + container.clientHeight * 0.3; // 30% from top

  let closestPage: number | null = null;
  let closestDist = Infinity;

  pageElements.forEach((el) => {
    const elTop = el.offsetTop;
    const dist = Math.abs(elTop - containerMid);
    if (dist < closestDist) {
      closestDist = dist;
      closestPage = parseInt(el.getAttribute('data-page') || '0', 10);
    }
  });

  return closestPage;
}

/**
 * Scroll a container so that a specific page element is visible.
 */
function scrollToPage(container: HTMLElement, pageNumber: number): void {
  const target = container.querySelector<HTMLElement>(
    `[data-page="${pageNumber}"]`
  );
  if (!target) return;

  // Smooth scroll the target into view within the container
  const containerTop = container.getBoundingClientRect().top;
  const targetTop = target.getBoundingClientRect().top;
  const offset = targetTop - containerTop - 8; // 8px top padding

  container.scrollBy({ top: offset, behavior: 'smooth' });
}

/**
 * Hook that synchronizes scroll between two panels.
 *
 * @param enabled  - Whether sync is active
 * @param pdfPanelId  - DOM id of the PDF scroll panel
 * @param translationPanelId - DOM id of the translation scroll panel
 */
export function useScrollSync(
  enabled: boolean,
  pdfPanelId: string = 'pdf-scroll-panel',
  translationPanelId: string = 'translation-scroll-panel',
) {
  // Track which panel is being scrolled by the user (to prevent loops)
  const scrollSourceRef = useRef<'pdf' | 'translation' | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedPageRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const pdfPanel = document.getElementById(pdfPanelId);
    const transPanel = document.getElementById(translationPanelId);

    if (!pdfPanel || !transPanel) return;

    function handleScroll(
      sourcePanel: HTMLElement,
      targetPanel: HTMLElement,
      source: 'pdf' | 'translation',
    ) {
      // If this scroll was triggered by sync (not user), ignore it
      if (scrollSourceRef.current && scrollSourceRef.current !== source) return;

      // Mark the source
      scrollSourceRef.current = source;

      // Clear previous timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce: wait for scrolling to settle
      scrollTimeoutRef.current = setTimeout(() => {
        const visiblePage = getVisiblePageNumber(sourcePanel);
        if (visiblePage && visiblePage !== lastSyncedPageRef.current) {
          lastSyncedPageRef.current = visiblePage;
          scrollToPage(targetPanel, visiblePage);
        }

        // Reset source after sync completes
        setTimeout(() => {
          scrollSourceRef.current = null;
        }, 500);
      }, 100);
    }

    const handlePdfScroll = () => handleScroll(pdfPanel, transPanel, 'pdf');
    const handleTransScroll = () => handleScroll(transPanel, pdfPanel, 'translation');

    pdfPanel.addEventListener('scroll', handlePdfScroll, { passive: true });
    transPanel.addEventListener('scroll', handleTransScroll, { passive: true });

    return () => {
      pdfPanel.removeEventListener('scroll', handlePdfScroll);
      transPanel.removeEventListener('scroll', handleTransScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, pdfPanelId, translationPanelId]);
}
