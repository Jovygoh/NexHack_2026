// ═══════════════════════════════════════════
// CONFIG — change this to your backend URL
// ═══════════════════════════════════════════
const API_BASE = 'https://nexhack-2026.onrender.com';

// ═══════════════════════════════════════════
// BACKEND STATUS CHECKER
// ═══════════════════════════════════════════
async function checkBackend() {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');

  dot.className   = 'status-dot checking';
  label.textContent = 'Checking...';

  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      dot.className     = 'status-dot online';
      label.textContent = 'Backend online';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    dot.className     = 'status-dot offline';
    // Give a helpful reason
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      label.textContent = 'Backend timeout';
    } else if (err.message.includes('fetch')) {
      label.textContent = 'Backend offline';
    } else {
      label.textContent = `Error: ${err.message}`;
    }
  }
}

// Check on load, then every 15 seconds
window.addEventListener('DOMContentLoaded', () => {
  checkBackend();
  setInterval(checkBackend, 15000);
});

function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn')[['home','scanner','history'].indexOf(name)].classList.add('active');
}

// ═══════════════════════════════════════════
// CONTRACT RENDERER — builds PDF-style page
// Maps backend "findings" → visual clauses
// ═══════════════════════════════════════════
function renderContractPage(contract, containerEl, issueListEl, chipOk, chipWarn, chipBad, suggestionTextEl, copyBtn) {
  let ok=0, warn=0, bad=0;
  const issues = [];

  contract.sections.forEach(sec => sec.clauses.forEach(c => {
    if (c.status === 'ok') ok++;
    else if (c.status === 'warn') { warn++; issues.push(c); }
    else if (c.status === 'bad')  { bad++;  issues.push(c); }
  }));

  chipOk.textContent  = `✓ ${ok} safe`;
  chipWarn.textContent = `⚠ ${warn} warn`;
  chipBad.textContent  = `✕ ${bad} critical`;

  // Build contract page HTML — only show header rows that have real content,
  // so when the document has no extractable title/meta, nothing fake or
  // empty is displayed. This keeps the view to just the real document text.
  let html = '';
  if (contract.title) html += `<div class="doc-title">${contract.title}</div>`;
  if (contract.subtitle) html += `<div class="doc-subtitle">${contract.subtitle}</div>`;
  if (contract.title || contract.subtitle) html += `<hr>`;
  if (contract.meta && contract.meta.length) {
    html += `<div class="doc-meta">
      ${contract.meta.map(m => `<strong>${m.split(':')[0]}:</strong>${m.substring(m.indexOf(':')+1)}<br>`).join('')}
    </div><hr>`;
  }

  contract.sections.forEach(sec => {
    if (sec.title) html += `<div class="sec-title">${sec.title}</div>`;
    sec.clauses.forEach(c => {
      const hlClass = c.status === 'bad' ? 'hl-red' : c.status === 'warn' ? 'hl-amber' : '';
      const safeId  = c.id.replace(/\./g, '_');
      const inner   = hlClass
        ? `<span class="${hlClass}"
             onclick="pickIssue('${c.id}','${containerEl.id}','${issueListEl.id}','${suggestionTextEl.id}','${copyBtn.id}')"
             title="${(c.issue||'').replace(/'/g,"&#39;")}">
             ${c.text}
           </span>`
        : `<span>${c.text}</span>`;
      html += `<div class="clause-line" id="${containerEl.id}-clause-${safeId}">${inner}</div>`;
    });
  });

  // Signature block
  html += `
    <div class="sig-block">
      <div class="sig-col">
        <div class="sig-line"></div>
        <strong>${contract.sig[0]}</strong><br>Authorised Signatory<br>Date: ___________
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <strong>${contract.sig[1]}</strong><br>Authorised Signatory<br>Date: ___________
      </div>
    </div>
    <div class="doc-footer">This document is for compliance screening only. Not legal advice.</div>
  `;

  containerEl.innerHTML = html;

  // Build issues list
  issueListEl.innerHTML = issues.map(c => {
    const safeId = c.id.replace(/\./g, '_');
    const lawText = c.law ? `${c.law} — ` : '';
    const descSnippet = (c.desc || '').substring(0, 90);
    return `
      <div class="issue-item" id="${issueListEl.id}-issue-${safeId}"
        onclick="pickIssue('${c.id}','${containerEl.id}','${issueListEl.id}','${suggestionTextEl.id}','${copyBtn.id}')">
        <div class="issue-top">
          <div class="issue-badge ${c.status}">${c.id}</div>
          <div class="issue-name">${c.issue || c.title || ''}</div>
        </div>
        <div class="issue-desc">${lawText}${descSnippet}${descSnippet.length >= 90 ? '…' : ''}</div>
      </div>
    `;
  }).join('');
}

// Renders only the issues sidebar (no text document body) for PDF-native mode.
// `pdfHandle` is the handle returned by renderPdfNative — passed down so
// clicking an issue scrolls and highlights the matching box on the real PDF.
function renderIssuesList(contract, issueListEl, chipOk, chipWarn, chipBad, suggestionTextEl, copyBtn, pdfHandle) {
  const issues = [];
  let ok = 0, warn = 0, bad = 0;
  contract.sections.forEach(sec => sec.clauses.forEach(c => {
    if (c.status === 'ok') ok++;
    else if (c.status === 'warn') { warn++; issues.push(c); }
    else if (c.status === 'bad')  { bad++;  issues.push(c); }
  }));
  chipOk.textContent   = `✓ ${ok} safe`;
  chipWarn.textContent = `⚠ ${warn} warn`;
  chipBad.textContent  = `✕ ${bad} critical`;

  issueListEl.innerHTML = issues.map(c => {
    const safeId = (c.findingId || c.id).replace(/[^a-zA-Z0-9]/g, '_');
    const descSnippet = (c.desc || '').substring(0, 90);
    return `
      <div class="issue-item" id="${issueListEl.id}-issue-${safeId}"
        data-finding-id="${c.findingId || ''}"
        onclick="onIssueClick(this, '${issueListEl.id}', '${suggestionTextEl.id}', '${copyBtn.id}')">
        <div class="issue-top">
          <div class="issue-badge ${c.status}">${c.id}</div>
          <div class="issue-name">${c.issue || ''}</div>
        </div>
        <div class="issue-desc">${descSnippet}${descSnippet.length >= 90 ? '…' : ''}</div>
      </div>
    `;
  }).join('');
}

// Called when user clicks an issue item in PDF-native mode.
// Reads the finding_id from the element's data attribute, highlights
// the corresponding boxes on the real PDF, and shows the suggestion.
function onIssueClick(el, issueListElId, suggestionTextElId, copyBtnId) {
  const findingId = el.dataset.findingId;
  const contract  = _activeContract;
  if (!contract || !findingId) return;

  // Highlight in issues sidebar
  const issueList = document.getElementById(issueListElId);
  issueList.querySelectorAll('.issue-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');

  // Scroll + activate the highlight on the real PDF
  if (contract._pdfViewerHandle) {
    contract._pdfViewerHandle.scrollToFinding(findingId);
  }

  // Find the clause to get its suggestion
  const clause = contract.sections.flatMap(s => s.clauses).find(c => c.findingId === findingId);
  if (!clause) return;

  const sEl = document.getElementById(suggestionTextElId);
  if (sEl) sEl.textContent = clause.suggestion || 'No suggestion available.';

  const btn = document.getElementById(copyBtnId);
  if (btn && clause.suggestion) {
    btn.onclick = () => {
      navigator.clipboard.writeText(clause.suggestion).catch(() => {});
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy suggestion', 2000);
    };
  }
}

// Activate a finding by ID from a PDF highlight click (bottom-up: PDF → sidebar).
function activateFindingById(findingId, contract, issueListEl, suggestionTextEl, copyBtn, pdfHandle) {
  const safeId = findingId.replace(/[^a-zA-Z0-9]/g, '_');
  const el = document.getElementById(`${issueListEl.id}-issue-${safeId}`);

  issueListEl.querySelectorAll('.issue-item').forEach(i => i.classList.remove('active'));
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (pdfHandle) pdfHandle.scrollToFinding(findingId);

  const clause = contract.sections.flatMap(s => s.clauses).find(c => c.findingId === findingId);
  if (!clause) return;
  if (suggestionTextEl) suggestionTextEl.textContent = clause.suggestion || 'No suggestion available.';
  if (copyBtn && clause.suggestion) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(clause.suggestion).catch(() => {});
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy suggestion', 2000);
    };
  }
}

function pickIssue(clauseId, containerElId, issueListElId, suggestionTextElId, copyBtnId) {
  // Search active contract (scanner or history)
  const allClauses = _activeContract
    ? _activeContract.sections.flatMap(s => s.clauses)
    : CONTRACTS.flatMap(ct => ct.sections.flatMap(s => s.clauses));
  const clause = allClauses.find(c => c.id === clauseId);
  if (!clause) return;

  // Highlight clause in document
  const container = document.getElementById(containerElId);
  container.querySelectorAll('.clause-line').forEach(el => el.style.outline = 'none');
  const safeId   = clauseId.replace(/\./g, '_');
  const clauseEl = document.getElementById(`${containerElId}-clause-${safeId}`);
  if (clauseEl) {
    clauseEl.style.outline      = '2px solid var(--accent)';
    clauseEl.style.borderRadius = '3px';
    clauseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Highlight in issue list
  const issueList = document.getElementById(issueListElId);
  issueList.querySelectorAll('.issue-item').forEach(el => el.classList.remove('active'));
  const issueEl = document.getElementById(`${issueListElId}-issue-${safeId}`);
  if (issueEl) { issueEl.classList.add('active'); issueEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

  // Show suggestion
  const sEl = document.getElementById(suggestionTextElId);
  if (sEl) sEl.textContent = clause.suggestion || 'No suggestion available.';

  const btn = document.getElementById(copyBtnId);
  if (btn && clause.suggestion) {
    btn.onclick = () => {
      navigator.clipboard.writeText(clause.suggestion).catch(() => {});
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy suggestion', 2000);
    };
  }
}

// Holds the contract currently shown in the scanner result
let _activeContract = null;

// ═══════════════════════════════════════════
// BACKEND RESPONSE → FRONTEND CONTRACT FORMAT
// Maps ClauseFinding[] from /api/contracts/analyze
// into the sections/clauses shape our renderer expects
// ═══════════════════════════════════════════
function mapApiResponseToContract(apiResponse, file) {
  const now    = new Date();
  const date   = now.toLocaleDateString('en-MY', { day:'2-digit', month:'short', year:'numeric' });
  const time   = now.toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' });

  // Group findings by category, preserving the order categories first appear in
  // (this matches the original document's section order, since the backend
  // now walks the contract section-by-section, clause-by-clause).
  const findingMap = {};
  const categoryOrder = [];
  (apiResponse.findings || []).forEach(f => {
    if (!findingMap[f.category]) {
      findingMap[f.category] = [];
      categoryOrder.push(f.category);
    }
    findingMap[f.category].push(f);
  });

  // Build sections from grouped findings, using the REAL clause id
  // (e.g. "1.1", "2.3") extracted from the start of each excerpt when present.
  // For documents with no numbered-clause structure (e.g. plain prose,
  // study notes, unstructured text), fall back to a clean internal counter —
  // never the raw backend rule id (e.g. "broad-liability-waiver-1"), which
  // is meant for tracking only and should never appear in the UI.
  // `findingId` is kept separately (the backend's original finding.id) so
  // it can be used to link clicks to the matching PDF highlight box.
  let fallbackCounter = 0;
  const sections = categoryOrder.map(category => ({
    title: category,
    clauses: findingMap[category].map(f => {
      const idMatch = f.excerpt.match(/^(\d{1,2}\.\d{1,2})\s+/);
      fallbackCounter++;
      const realId   = idMatch ? idMatch[1] : `c${fallbackCounter}`;
      const cleanText = idMatch ? f.excerpt.slice(idMatch[0].length) : f.excerpt;
      return {
        id:         realId,
        findingId:  f.id,
        text:       cleanText,
        status:     severityToStatus(f.severity),
        issue:      f.severity === 'low' ? null : f.title,
        law:        null,
        desc:       f.explanation || null,
        suggestion: f.recommendation || null,
      };
    })
  }));

  // If no findings at all, show a single "all clear" section
  if (sections.length === 0) {
    sections.push({
      title: 'Review Summary',
      clauses: [{
        id: '1',
        findingId: null,
        text: 'No risky or hidden clauses were detected in this contract.',
        status: 'ok',
        issue: null, law: null, desc: null, suggestion: null,
      }]
    });
  }

  // Determine overall status for history
  const overallStatus = apiResponse.risk_level === 'critical' || apiResponse.risk_level === 'high'
    ? 'critical'
    : apiResponse.risk_level === 'medium'
    ? 'issues'
    : 'safe';

  // Derive the document title from the document's OWN text — never from
  // the uploaded filename. Many real documents open with a heading line
  // (e.g. "NON-DISCLOSURE AGREEMENT", "EMPLOYMENT CONTRACT"); use that if
  // it looks like a real title. Otherwise, don't fabricate one.
  const rawText = apiResponse.contract_text || '';
  const extractedTitle = extractDocumentTitle(rawText);

  return {
    id:       Date.now(),
    filename: apiResponse.file_name || file.name,
    company:  '—',        // backend doesn't extract company name; can be added later
    date,
    time,
    status:   overallStatus,
    title:    extractedTitle, // may be '' — renderer hides the title row when empty
    subtitle: '',
    meta:     [], // no fabricated File/Scanned/Summary header — just the real document
    sig:      ['Authorised Signatory', 'Authorised Signatory'],
    sections,
    llmReview: apiResponse.llm_review || null,
    // Kept for the AI chat — sends the full contract + raw findings as context
    rawText,
    apiFindings: apiResponse.findings || [],
    // PDF-native rendering: present only when the upload was a PDF the
    // backend could extract word coordinates from. When present, the
    // viewer renders the REAL PDF via PDF.js with highlight overlays
    // instead of the reconstructed HTML text renderer.
    pdfBase64:      apiResponse.pdf_base64 || null,
    pageSizes:      apiResponse.page_sizes || null,
    highlightBoxes: apiResponse.highlight_boxes || null,
  };
}

// Pulls a plausible title from the start of the real document text.
// Looks for a short, mostly-uppercase first line/sentence (typical of
// document headings like "EMPLOYMENT CONTRACT" or "NON-DISCLOSURE
// AGREEMENT"). Returns '' if nothing reasonable is found — callers should
// not fabricate a fallback from the filename.
function extractDocumentTitle(text) {
  if (!text) return '';
  const firstChunk = text.trim().slice(0, 200);
  // Try to grab the first run of words before a long lowercase sentence starts
  const match = firstChunk.match(/^([A-Z][A-Z0-9 ,&'\-]{4,60})(?=[A-Z][a-z]|\s\d|$)/);
  if (match) return match[1].trim();
  return '';
}

function severityToStatus(severity) {
  if (severity === 'critical' || severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'ok';
}

// Detects when the backend's "reply" text is actually a raw error message
// (e.g. OpenAI quota/billing errors, missing API key) so the UI can show
// a short, friendly message instead of dumping the full error text.
function isAiErrorText(text) {
  return /^(error|ai capabilities are not available|openai client library)/i.test((text || '').trim());
}

// ═══════════════════════════════════════════
// SCANNER — FILE UPLOAD
// ═══════════════════════════════════════════
let _selectedFile = null;

function handleFile(input) {
  if (!input.files[0]) return;
  _selectedFile = input.files[0];
  document.getElementById('file-name').textContent = _selectedFile.name;
  document.getElementById('file-size').textContent = (_selectedFile.size / 1024).toFixed(1) + ' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag');
  const f = e.dataTransfer.files[0]; if (!f) return;
  _selectedFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size / 1024).toFixed(1) + ' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}

function removeFile() {
  _selectedFile = null;
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('scan-btn').disabled = true;
  document.getElementById('file-input').value = '';
}

function togglePill(el) { el.classList.toggle('active'); }

// ═══════════════════════════════════════════
// SCANNER — CALL REAL BACKEND API
// ═══════════════════════════════════════════
async function startScan() {
  if (!_selectedFile) return;

  const btn   = document.getElementById('scan-btn');
  const bar   = document.getElementById('progress-bar');
  const fill  = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  btn.disabled = true;
  bar.classList.add('show');

  // Animate progress while waiting for API
  const steps = [
    'Uploading contract…',
    'Extracting text…',
    'Checking Malaysian laws…',
    'Analysing risk clauses…',
    'Generating report…',
  ];
  let stepIdx = 0;
  fill.style.width = '5%';
  label.textContent = steps[0];

  const progressTimer = setInterval(() => {
    if (stepIdx < steps.length - 1) {
      stepIdx++;
      fill.style.width = `${(stepIdx / steps.length) * 85}%`;
      label.textContent = steps[stepIdx];
    }
  }, 800);

  try {
    // Build form data — matches FastAPI endpoint
    const formData = new FormData();
    formData.append('file', _selectedFile);
    formData.append('jurisdiction', 'Malaysia');
    formData.append('language', 'English');

    const response = await fetch(`${API_BASE}/api/contracts/analyze`, {
      method: 'POST',
      body: formData,
    });

    clearInterval(progressTimer);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Server error ${response.status}`);
    }

    const apiData = await response.json();

    fill.style.width = '100%';
    label.textContent = 'Done!';

    await new Promise(r => setTimeout(r, 400));

    const contract = mapApiResponseToContract(apiData, _selectedFile);
    _activeContract = contract;
    _chatHistory = []; // fresh conversation context for this contract

    // Save to history (persisted to localStorage so it survives refresh)
    SCAN_HISTORY.unshift(contract);
    saveScanHistory();
    buildHistoryList();

    showResults(contract);

  } catch (err) {
    clearInterval(progressTimer);
    fill.style.width  = '100%';
    fill.style.background = '#E84040';
    label.textContent = `Error: ${err.message}`;
    btn.disabled = false;
    console.error('Scan failed:', err);
  }
}

function showResults(contract) {
  document.getElementById('upload-view').style.display = 'none';
  document.getElementById('progress-bar').classList.remove('show');
  document.getElementById('progress-fill').style.background = '';

  const hasIssues = contract.sections.some(s => s.clauses.some(c => c.status !== 'ok'));

  if (!hasIssues) {
    document.getElementById('safe-result').classList.add('show');
    return;
  }

  document.getElementById('results-filename').textContent = contract.filename;
  document.getElementById('results-view').classList.add('show');

  const allC = contract.sections.flatMap(s => s.clauses);
  document.getElementById('s-chip-ok').textContent   = `✓ ${allC.filter(c=>c.status==='ok').length} safe`;
  document.getElementById('s-chip-warn').textContent = `⚠ ${allC.filter(c=>c.status==='warn').length} warn`;
  document.getElementById('s-chip-bad').textContent  = `✕ ${allC.filter(c=>c.status==='bad').length} critical`;

  if (contract.pdfBase64) {
    // PDF-native mode: render the REAL PDF via PDF.js with coordinate highlights
    document.getElementById('contract-page-content').style.display = 'none';
    const pdfViewerEl = document.getElementById('pdf-viewer');
    pdfViewerEl.style.display = 'flex';

    renderPdfNative(
      pdfViewerEl,
      contract.pdfBase64,
      contract.pageSizes,
      contract.highlightBoxes,
    ).then(handle => {
      contract._pdfViewerHandle = handle;

      // Wire up PDF highlight click → sidebar + suggestion
      window.onPdfHighlightClick = (findingId) => {
        activateFindingById(findingId, contract,
          document.getElementById('issues-list'),
          document.getElementById('suggestion-text'),
          document.getElementById('copy-btn'),
          handle,
        );
      };
    });

    // Build issues list only (no HTML text document to render)
    renderIssuesList(
      contract,
      document.getElementById('issues-list'),
      document.getElementById('chip-ok'),
      document.getElementById('chip-warn'),
      document.getElementById('chip-bad'),
      document.getElementById('suggestion-text'),
      document.getElementById('copy-btn'),
      null, // no text container
    );

  } else {
    // Fallback text mode: for non-PDF uploads (txt, docx) or PDFs where
    // coordinate extraction failed — same old reconstructed-HTML approach
    document.getElementById('pdf-viewer').style.display = 'none';
    const textEl = document.getElementById('contract-page-content');
    textEl.style.display = '';
    renderContractPage(
      contract,
      textEl,
      document.getElementById('issues-list'),
      document.getElementById('chip-ok'),
      document.getElementById('chip-warn'),
      document.getElementById('chip-bad'),
      document.getElementById('suggestion-text'),
      document.getElementById('copy-btn'),
    );
  }

  // Show LLM review in suggestion box if available
  if (contract.llmReview) {
    const reviewText = contract.llmReview.review || '';
    document.getElementById('suggestion-text').textContent = isAiErrorText(reviewText)
      ? 'Error. Please try again.'
      : reviewText;
  }
}

function resetScanner() {
  _activeContract = null;
  _selectedFile   = null;
  document.getElementById('results-view').classList.remove('show');
  document.getElementById('safe-result').classList.remove('show');
  document.getElementById('upload-view').style.display = 'block';
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('scan-btn').disabled = true;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-label').textContent = '';
  document.getElementById('file-input').value = '';
}

// ═══════════════════════════════════════════
// HISTORY — persisted in localStorage so scans survive page refresh
// ═══════════════════════════════════════════
const HISTORY_STORAGE_KEY = 'contractsense_scan_history_v1';

function loadScanHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) return saved;
    }
  } catch (e) {
    console.error('Failed to load scan history from localStorage:', e);
  }
  // First-ever visit (or corrupted storage) — seed with the demo contracts
  return [...CONTRACTS];
}

function saveScanHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(SCAN_HISTORY));
  } catch (e) {
    // Storage can fail if quota is exceeded (very large contracts/history) —
    // don't crash the app, just warn in console.
    console.error('Failed to save scan history to localStorage:', e);
  }
}

let SCAN_HISTORY = loadScanHistory();

function buildHistoryList(filter = 'all') {
  const body = document.getElementById('history-table-body');
  const rows = SCAN_HISTORY.filter(c => filter === 'all' || c.status === filter);
  body.innerHTML = rows.map(c => `
    <div class="table-row">
      <div class="date-col">${c.date}<div class="time">${c.time}</div></div>
      <span class="contract-link" onclick="openHistoryDetail(${c.id})">${c.filename}</span>
      <span class="company-col">${c.company}</span>
      <span><div class="status-badge ${c.status}">${
        c.status === 'safe' ? '✓ Safe' : c.status === 'issues' ? '⚠ Issues' : '✕ Critical'
      }</div></span>
      <span><button class="view-btn" onclick="openHistoryDetail(${c.id})">View</button></span>
    </div>
  `).join('');
}

function filterHistory(btn, filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buildHistoryList(filter);
}

function clearScanHistory() {
  if (!confirm('Clear all scan history? This cannot be undone.')) return;
  SCAN_HISTORY = [];
  saveScanHistory();
  buildHistoryList();
}

function openHistoryDetail(id) {
  const contract = SCAN_HISTORY.find(c => c.id === id);
  if (!contract) return;

  _activeContract = contract;
  _chatHistory = []; // fresh conversation context for this contract

  document.getElementById('hd-title').textContent = contract.filename;

  const allC = contract.sections.flatMap(s => s.clauses);
  const ok   = allC.filter(c => c.status === 'ok').length;
  const warn = allC.filter(c => c.status === 'warn').length;
  const bad  = allC.filter(c => c.status === 'bad').length;

  document.getElementById('hd-chips').innerHTML = `
    <div class="chip ok">✓ ${ok}</div>
    <div class="chip warn">⚠ ${warn}</div>
    <div class="chip bad">✕ ${bad}</div>
  `;
  document.getElementById('hd-issue-chips').innerHTML = `
    <div class="chip ok">✓ ${ok} safe</div>
    <div class="chip warn">⚠ ${warn} warn</div>
    <div class="chip bad">✕ ${bad} critical</div>
  `;

  if (contract.pdfBase64) {
    // PDF-native mode for history too
    document.getElementById('history-page-content').style.display = 'none';
    const pdfViewerEl = document.getElementById('history-pdf-viewer');
    pdfViewerEl.style.display = 'flex';

    renderPdfNative(
      pdfViewerEl,
      contract.pdfBase64,
      contract.pageSizes,
      contract.highlightBoxes,
    ).then(handle => {
      contract._pdfViewerHandle = handle;
      window.onPdfHighlightClick = (findingId) => {
        activateFindingById(findingId, contract,
          document.getElementById('history-issues-list'),
          document.getElementById('history-suggestion-text'),
          document.getElementById('h-copy-btn'),
          handle,
        );
      };
    });

    renderIssuesList(
      contract,
      document.getElementById('history-issues-list'),
      document.getElementById('hd-chips').children[0],
      document.getElementById('hd-chips').children[1],
      document.getElementById('hd-chips').children[2],
      document.getElementById('history-suggestion-text'),
      document.getElementById('h-copy-btn'),
      null,
    );
  } else {
    // Fallback text mode for non-PDF history contracts
    document.getElementById('history-pdf-viewer').style.display = 'none';
    const textEl = document.getElementById('history-page-content');
    textEl.style.display = '';
    renderContractPage(
      contract,
      textEl,
      document.getElementById('history-issues-list'),
      document.getElementById('hd-chips').children[0],
      document.getElementById('hd-chips').children[1],
      document.getElementById('hd-chips').children[2],
      document.getElementById('history-suggestion-text'),
      document.getElementById('h-copy-btn'),
    );
  }

  document.getElementById('history-detail').classList.add('show');
}

function closeHistoryDetail() {
  _activeContract = null;
  document.getElementById('history-detail').classList.remove('show');
}

// ═══════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// SIDEBAR TOGGLE — hide/show issues panel for a larger contract view
// ═══════════════════════════════════════════
function toggleSidebar(context) {
  const btnLabelId = context === 'scanner' ? 'scanner-sidebar-toggle-label' : 'history-sidebar-toggle-label';
  const btnId = context === 'scanner' ? 'scanner-sidebar-toggle' : 'history-sidebar-toggle';

  const panel = document.querySelector(
    context === 'scanner' ? '.results-layout .issues-panel' : '.hd-issues-panel'
  );
  const label = document.getElementById(btnLabelId);
  const btn   = document.getElementById(btnId);
  if (!panel) return;

  const collapsed = panel.classList.toggle('collapsed');
  if (btn) btn.classList.toggle('collapsed', collapsed);
  if (label) label.textContent = collapsed ? 'Show panel' : 'Hide panel';
}

function toggleChat() { document.getElementById('chat-box').classList.toggle('open'); }
function toggleBig()  { document.getElementById('chat-box').classList.toggle('big'); }

// Keeps the running conversation in the {role, content} shape the backend expects
let _chatHistory = [];

async function sendMsg() {
  const inp = document.getElementById('chat-input');
  const val = inp.value.trim();
  if (!val) return;

  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="msg user"><div class="msg-avatar">👤</div><div class="msg-bubble">${escapeHtml(val)}</div></div>`;
  inp.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  // Typing indicator
  const typingId = `typing-${Date.now()}`;
  msgs.innerHTML += `<div class="msg ai" id="${typingId}"><div class="msg-avatar">🤖</div><div class="msg-bubble">Thinking…</div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  // Build context from whichever contract is currently open (scanner result or history).
  // If no contract is loaded, send empty context — the AI can still answer
  // general Malaysian law questions from its own knowledge.
  const contractText = _activeContract?.rawText || '';
  const rawFindings  = _activeContract?.apiFindings || [];

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: val,
        contract_text: contractText,
        findings: rawFindings,
        chat_history: _chatHistory,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    const reply = data.reply || 'No response received.';

    // The backend can return a long raw error string as a normal reply
    // (e.g. OpenAI quota/billing errors) — catch that case too and show
    // a short, friendly message instead of dumping the full error.
    const displayReply = isAiErrorText(reply) ? 'Error. Please try again.' : reply;

    document.getElementById(typingId).querySelector('.msg-bubble').textContent = displayReply;

    if (!isAiErrorText(reply)) {
      _chatHistory.push({ role: 'user', content: val });
      _chatHistory.push({ role: 'assistant', content: reply });
    }

  } catch (err) {
    document.getElementById(typingId).querySelector('.msg-bubble').textContent = 'Error. Please try again.';
    console.error('Chat failed:', err);
  }

  msgs.scrollTop = msgs.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
buildHistoryList();
