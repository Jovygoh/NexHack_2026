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

  // Build contract page HTML
  let html = `
    <div class="doc-title">${contract.title}</div>
    <div class="doc-subtitle">${contract.subtitle}</div>
    <hr>
    <div class="doc-meta">
      ${contract.meta.map(m => `<strong>${m.split(':')[0]}:</strong>${m.substring(m.indexOf(':')+1)}<br>`).join('')}
    </div>
    <hr>
  `;

  contract.sections.forEach(sec => {
    html += `<div class="sec-title">${sec.title}</div>`;
    sec.clauses.forEach(c => {
      const hlClass = c.status === 'bad' ? 'hl-red' : c.status === 'warn' ? 'hl-amber' : '';
      const safeId  = c.id.replace(/\./g, '_');
      const inner   = hlClass
        ? `<span class="${hlClass}"
             onclick="pickIssue('${c.id}','${containerEl.id}','${issueListEl.id}','${suggestionTextEl.id}','${copyBtn.id}')"
             title="${(c.issue||'').replace(/'/g,"&#39;")}">
             ${c.id} ${c.text}
           </span>`
        : `<span>${c.id} ${c.text}</span>`;
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
  // (e.g. "1.1", "2.3") extracted from the start of each excerpt,
  // instead of a fake sequential counter.
  const sections = categoryOrder.map(category => ({
    title: category,
    clauses: findingMap[category].map(f => {
      const idMatch = f.excerpt.match(/^(\d{1,2}\.\d{1,2})\s+/);
      const realId   = idMatch ? idMatch[1] : f.id;
      const cleanText = idMatch ? f.excerpt.slice(idMatch[0].length) : f.excerpt;
      return {
        id:         realId,
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

  return {
    id:       Date.now(),
    filename: apiResponse.file_name || file.name,
    company:  '—',        // backend doesn't extract company name; can be added later
    date,
    time,
    status:   overallStatus,
    title:    (file.name || 'Contract').replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').toUpperCase(),
    subtitle: `Risk score: ${apiResponse.risk_score}/100 · ${apiResponse.risk_level.toUpperCase()}`,
    meta:     [`File: ${apiResponse.file_name}`, `Scanned: ${date} ${time}`, `Summary: ${apiResponse.summary}`],
    sig:      ['Authorised Signatory', 'Authorised Signatory'],
    sections,
    llmReview: apiResponse.llm_review || null,
  };
}

function severityToStatus(severity) {
  if (severity === 'critical' || severity === 'high') return 'bad';
  if (severity === 'medium') return 'warn';
  return 'ok';
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

    // Save to history (and persist so it survives a refresh)
    SCAN_HISTORY.unshift(contract);
    saveHistory();
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

  renderContractPage(
    contract,
    document.getElementById('contract-page-content'),
    document.getElementById('issues-list'),
    document.getElementById('chip-ok'),
    document.getElementById('chip-warn'),
    document.getElementById('chip-bad'),
    document.getElementById('suggestion-text'),
    document.getElementById('copy-btn'),
  );

  // Show LLM review in suggestion box if available
  if (contract.llmReview) {
    document.getElementById('suggestion-text').textContent = contract.llmReview.review;
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
// HISTORY — persisted in localStorage so it
// survives page refreshes / new tabs.
// Falls back to the demo CONTRACTS on first run.
// ═══════════════════════════════════════════
const HISTORY_STORAGE_KEY = 'contractsense_scan_history_v1';

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read saved history, falling back to demo data:', err);
  }
  return [...CONTRACTS]; // first run / corrupted storage — pre-load demo contracts
}

function saveHistory() {
  try {
    // Keep storage from growing unbounded over many test scans
    const MAX_ENTRIES = 100;
    if (SCAN_HISTORY.length > MAX_ENTRIES) SCAN_HISTORY.length = MAX_ENTRIES;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(SCAN_HISTORY));
  } catch (err) {
    // e.g. storage quota exceeded or disabled — scan still works, just won't persist
    console.warn('Could not save scan history:', err);
  }
}

const SCAN_HISTORY = loadHistory();

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

function openHistoryDetail(id) {
  const contract = SCAN_HISTORY.find(c => c.id === id);
  if (!contract) return;

  _activeContract = contract;

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

  renderContractPage(
    contract,
    document.getElementById('history-page-content'),
    document.getElementById('history-issues-list'),
    document.getElementById('hd-chips').children[0],
    document.getElementById('hd-chips').children[1],
    document.getElementById('hd-chips').children[2],
    document.getElementById('history-suggestion-text'),
    document.getElementById('h-copy-btn'),
  );

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

const _aiReplies = [
  "Under Employment Act 1955 s.60A, overtime must be compensated at 1.5× the hourly rate.",
  "PDPA 2010 requires that personal data is only processed for the specific purpose disclosed at collection.",
  "A non-compete clause exceeding 12–18 months or covering an unreasonably broad area is typically void under s.28 of the Contracts Act 1950.",
  "Minimum annual leave under s.60E: 8 days (<2 yrs), 12 days (2–5 yrs), 16 days (>5 yrs service).",
  "Termination notice must be at least 4 weeks for employees with 2+ years of service under s.12 of the Employment Act 1955.",
];
let _aiIdx = 0;

function sendMsg() {
  const inp = document.getElementById('chat-input');
  const val = inp.value.trim(); if (!val) return;
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="msg user"><div class="msg-avatar">👤</div><div class="msg-bubble">${val}</div></div>`;
  inp.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    msgs.innerHTML += `<div class="msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble">${_aiReplies[_aiIdx % _aiReplies.length]}</div></div>`;
    _aiIdx++;
    msgs.scrollTop = msgs.scrollHeight;
  }, 900);
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
buildHistoryList();
