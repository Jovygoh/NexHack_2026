// ═══════════════════════════════════════════
// PDF-NATIVE VIEWER
// Renders the REAL uploaded PDF using PDF.js (canvas per page) and draws
// highlight boxes as absolutely-positioned overlay divs at the exact
// coordinates the backend computed from the original PDF's word layout.
// This replaces the old approach of reconstructing the document as HTML
// text — the user now sees their actual file, just with colored boxes
// drawn on top of the risky clauses.
// ═══════════════════════════════════════════

if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';
}

const PDF_RENDER_SCALE = 1.4; // canvas resolution multiplier for crisp text

/**
 * Renders a base64 PDF into `viewerEl`, drawing highlight boxes from
 * `highlightBoxes` (each: {finding_id, page, x0, x1, top, bottom, severity}).
 * `pageSizes` is the backend's per-page {width, height} in PDF points,
 * used to compute the scale factor between PDF coordinates and rendered
 * canvas pixels.
 *
 * Returns a Promise that resolves once all pages are rendered, with a
 * handle object exposing `scrollToFinding(findingId)` for click-to-locate
 * from the issues sidebar.
 */
async function renderPdfNative(viewerEl, pdfBase64, pageSizes, highlightBoxes) {
  viewerEl.innerHTML = '<div class="pdf-loading">Loading document…</div>';
  viewerEl.style.display = 'flex';

  if (!window['pdfjsLib']) {
    viewerEl.innerHTML = '<div class="pdf-loading">PDF viewer failed to load.</div>';
    return { scrollToFinding: () => {} };
  }

  let pdfDoc;
  try {
    const raw = atob(pdfBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  } catch (e) {
    console.error('PDF.js failed to load document:', e);
    viewerEl.innerHTML = '<div class="pdf-loading">Could not render this PDF.</div>';
    return { scrollToFinding: () => {} };
  }

  viewerEl.innerHTML = '';

  // Group highlight boxes by page for quick lookup while rendering
  const boxesByPage = {};
  (highlightBoxes || []).forEach(b => {
    if (!boxesByPage[b.page]) boxesByPage[b.page] = [];
    boxesByPage[b.page].push(b);
  });

  const pageCount = pdfDoc.numPages;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pdfPage = await pdfDoc.getPage(pageIndex + 1); // PDF.js is 1-indexed
    const viewport = pdfPage.getViewport({ scale: PDF_RENDER_SCALE });

    const pageWrap = document.createElement('div');
    pageWrap.className = 'pdf-page-wrap';
    pageWrap.style.width = `${viewport.width}px`;
    pageWrap.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageWrap.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    // Backend coordinates are in raw PDF points (page.width/height from
    // pdfplumber), unaffected by our render scale — compute the ratio
    // between rendered canvas pixels and those raw PDF points.
    const pageSize = (pageSizes && pageSizes[pageIndex]) || { width: viewport.width / PDF_RENDER_SCALE, height: viewport.height / PDF_RENDER_SCALE };
    const scaleX = viewport.width / pageSize.width;
    const scaleY = viewport.height / pageSize.height;

    const pageBoxes = boxesByPage[pageIndex] || [];
    pageBoxes.forEach(box => {
      const div = document.createElement('div');
      div.className = `pdf-highlight sev-${box.severity}`;
      div.dataset.findingId = box.finding_id;
      div.style.left   = `${box.x0 * scaleX}px`;
      div.style.top    = `${box.top * scaleY}px`;
      div.style.width  = `${(box.x1 - box.x0) * scaleX}px`;
      div.style.height = `${(box.bottom - box.top) * scaleY}px`;
      div.onclick = () => {
        if (typeof window.onPdfHighlightClick === 'function') {
          window.onPdfHighlightClick(box.finding_id);
        }
      };
      pageWrap.appendChild(div);
    });

    viewerEl.appendChild(pageWrap);
  }

  return {
    scrollToFinding(findingId) {
      const els = viewerEl.querySelectorAll(`[data-finding-id="${CSS.escape(findingId)}"]`);
      if (!els.length) return;
      viewerEl.querySelectorAll('.pdf-highlight.active').forEach(el => el.classList.remove('active'));
      els.forEach(el => el.classList.add('active'));
      els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
}
