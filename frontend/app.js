// ═══════════════════════════════════════════
// PAGE ROUTING
// ═══════════════════════════════════════════
function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn')[['home','scanner','history'].indexOf(name)].classList.add('active');
}

// ═══════════════════════════════════════════
// CONTRACT RENDERER — builds the PDF-style page
// ═══════════════════════════════════════════
function renderContractPage(contract, containerEl, issueListEl, chipOk, chipWarn, chipBad, suggestionTextEl, copyBtn) {
  // Count statuses
  let ok=0, warn=0, bad=0;
  const issues = [];
  contract.sections.forEach(sec => sec.clauses.forEach(c => {
    if(c.status==='ok') ok++;
    else if(c.status==='warn'){warn++;issues.push(c);}
    else if(c.status==='bad'){bad++;issues.push(c);}
  }));

  chipOk.textContent = `✓ ${ok} safe`;
  chipWarn.textContent = `⚠ ${warn} warn`;
  chipBad.textContent = `✕ ${bad} critical`;

  // Build contract page HTML
  let html = `
    <div class="doc-title">${contract.title}</div>
    <div class="doc-subtitle">${contract.subtitle}</div>
    <hr>
    <div class="doc-meta">
      ${contract.meta.map(m=>`<strong>${m.split(':')[0]}:</strong>${m.substring(m.indexOf(':')+1)}<br>`).join('')}
    </div>
    <hr>
  `;

  contract.sections.forEach(sec => {
    html += `<div class="sec-title">${sec.title}</div>`;
    sec.clauses.forEach(c => {
      const hlClass = c.status==='bad'?'hl-red':c.status==='warn'?'hl-amber':'';
      const inner = hlClass
        ? `<span class="${hlClass}" onclick="pickIssue('${c.id}','${containerEl.id}','${issueListEl.id}','${suggestionTextEl.id}','${copyBtn.id}')" title="${c.issue||''}">${c.id} ${c.text}</span>`
        : `<span>${c.id} ${c.text}</span>`;
      html += `<div class="clause-line" id="${containerEl.id}-clause-${c.id.replace('.','_')}">${inner}</div>`;
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
    <div class="doc-footer">This document is generated for testing purposes only. Not legally binding.</div>
  `;

  containerEl.innerHTML = html;

  // Build issues list
  issueListEl.innerHTML = issues.map(c => `
    <div class="issue-item" id="${issueListEl.id}-issue-${c.id.replace('.','_')}"
      onclick="pickIssue('${c.id}','${containerEl.id}','${issueListEl.id}','${suggestionTextEl.id}','${copyBtn.id}')">
      <div class="issue-top">
        <div class="issue-badge ${c.status}">${c.id}</div>
        <div class="issue-name">${c.issue}</div>
      </div>
      <div class="issue-desc">${c.law} — ${c.desc.substring(0,90)}…</div>
    </div>
  `).join('');
}

function pickIssue(clauseId, containerElId, issueListElId, suggestionTextElId, copyBtnId) {
  // Find contract
  const allClauses = CONTRACTS.flatMap(ct => ct.sections.flatMap(s=>s.clauses));
  const clause = allClauses.find(c=>c.id===clauseId);
  if(!clause) return;

  // Highlight in document
  const container = document.getElementById(containerElId);
  container.querySelectorAll('.clause-line').forEach(el=>el.style.outline='none');
  const clauseEl = document.getElementById(`${containerElId}-clause-${clauseId.replace('.','_')}`);
  if(clauseEl){clauseEl.style.outline='2px solid var(--accent)';clauseEl.style.borderRadius='3px';clauseEl.scrollIntoView({behavior:'smooth',block:'center'});}

  // Highlight in issue list
  const issueList = document.getElementById(issueListElId);
  issueList.querySelectorAll('.issue-item').forEach(el=>el.classList.remove('active'));
  const issueEl = document.getElementById(`${issueListElId}-issue-${clauseId.replace('.','_')}`);
  if(issueEl){issueEl.classList.add('active');issueEl.scrollIntoView({behavior:'smooth',block:'nearest'});}

  // Show suggestion
  const sEl = document.getElementById(suggestionTextElId);
  if(sEl) sEl.textContent = clause.suggestion || 'No suggestion available.';

  const btn = document.getElementById(copyBtnId);
  if(btn && clause.suggestion){
    btn.onclick = () => {
      navigator.clipboard.writeText(clause.suggestion).catch(()=>{});
      btn.textContent='Copied!';
      setTimeout(()=>btn.textContent='Copy suggestion',2000);
    };
  }
}

// ═══════════════════════════════════════════
// SCANNER
// ═══════════════════════════════════════════
function handleFile(input) {
  if(!input.files[0]) return;
  const f = input.files[0];
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size/1024).toFixed(1)+' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag');
  const f = e.dataTransfer.files[0]; if(!f) return;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size/1024).toFixed(1)+' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}
function removeFile() {
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('scan-btn').disabled = true;
  document.getElementById('file-input').value='';
}
function togglePill(el){el.classList.toggle('active')}

const SCAN_HISTORY_KEY = 'contractsense.scanHistory';

function getScanHistory() {
  try {
    return JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveScanToHistory(contract) {
  const history = [contract, ...getScanHistory()];
  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
  buildHistoryList();
}

function createDemoAnalysisForUpload() {
  const demo = JSON.parse(JSON.stringify(CONTRACTS[0]));
  const now = new Date();
  demo.id = now.getTime();
  demo.filename = document.getElementById('file-name').textContent || 'Uploaded contract';
  demo.company = 'Uploaded contract';
  demo.date = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  demo.time = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  return demo;
}

function startScan() {
  const btn = document.getElementById('scan-btn');
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  btn.disabled=true; bar.classList.add('show');
  const steps=['Extracting text…','Checking Employment Act 1955…','Checking PDPA 2010…','Checking Companies Act 2016…','Generating report…'];
  let i=0;
  const iv = setInterval(()=>{
    fill.style.width=((i+1)/steps.length*100)+'%';
    label.textContent=steps[i]; i++;
    if(i>=steps.length){clearInterval(iv);setTimeout(showResults,400);}
  },600);
}

function showResults() {
  document.getElementById('upload-view').style.display='none';
  document.getElementById('progress-bar').classList.remove('show');
  // Prototype only: reuse one prepared analysis shape for any uploaded file.
  // In production this object should come from the backend analysis API.
  const contract = createDemoAnalysisForUpload();
  document.getElementById('results-filename').textContent = contract.filename;
  document.getElementById('results-view').classList.add('show');
  renderContractPage(
    contract,
    document.getElementById('contract-page-content'),
    document.getElementById('issues-list'),
    document.getElementById('chip-ok'),
    document.getElementById('chip-warn'),
    document.getElementById('chip-bad'),
    document.getElementById('suggestion-text'),
    document.getElementById('copy-btn')
  );
  // Also update top bar chips
  const allC = contract.sections.flatMap(s=>s.clauses);
  document.getElementById('s-chip-ok').textContent=`✓ ${allC.filter(c=>c.status==='ok').length} safe`;
  document.getElementById('s-chip-warn').textContent=`⚠ ${allC.filter(c=>c.status==='warn').length} warn`;
  document.getElementById('s-chip-bad').textContent=`✕ ${allC.filter(c=>c.status==='bad').length} critical`;
  saveScanToHistory(contract);
}

function resetScanner() {
  document.getElementById('results-view').classList.remove('show');
  document.getElementById('safe-result').classList.remove('show');
  document.getElementById('upload-view').style.display='block';
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('scan-btn').disabled=true;
  document.getElementById('progress-fill').style.width='0%';
  document.getElementById('progress-label').textContent='';
  document.getElementById('file-input').value='';
}

// ═══════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════
function buildHistoryList(filter='all') {
  const body = document.getElementById('history-table-body');
  const rows = getScanHistory().filter(c => filter==='all' || c.status===filter || (filter==='issues' && c.status==='critical'));
  if(!rows.length) {
    body.innerHTML = `
      <div class="table-row">
        <span class="company-col">No saved scans yet. Upload and scan a contract to create history.</span>
      </div>
    `;
    return;
  }
  body.innerHTML = rows.map(c => `
    <div class="table-row">
      <div class="date-col">${c.date}<div class="time">${c.time}</div></div>
      <span class="contract-link" onclick="openHistoryDetail(${c.id})">${c.filename}</span>
      <span class="company-col">${c.company}</span>
      <span><div class="status-badge ${c.status}">${c.status==='safe'?'✓ Safe':c.status==='issues'?'⚠ Issues':'✕ Critical'}</div></span>
      <span><button class="view-btn" onclick="openHistoryDetail(${c.id})">View</button></span>
    </div>
  `).join('');
}

function filterHistory(btn, filter) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  buildHistoryList(filter);
}

function openHistoryDetail(id) {
  const contract = getScanHistory().find(c=>c.id===id);
  if(!contract) return;
  document.getElementById('hd-title').textContent = contract.filename;
  const allC = contract.sections.flatMap(s=>s.clauses);
  const ok=allC.filter(c=>c.status==='ok').length;
  const warn=allC.filter(c=>c.status==='warn').length;
  const bad=allC.filter(c=>c.status==='bad').length;
  document.getElementById('hd-chips').innerHTML=`
    <div class="chip ok">✓ ${ok}</div>
    <div class="chip warn">⚠ ${warn}</div>
    <div class="chip bad">✕ ${bad}</div>
  `;
  document.getElementById('hd-issue-chips').innerHTML=`
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
    document.getElementById('h-copy-btn')
  );
  document.getElementById('history-detail').classList.add('show');
}

function closeHistoryDetail() {
  document.getElementById('history-detail').classList.remove('show');
}

// ═══════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════
function toggleChat(){document.getElementById('chat-box').classList.toggle('open')}
function toggleBig(){document.getElementById('chat-box').classList.toggle('big')}
const aiReplies=[
  "Under Employment Act 1955 s.60A, overtime must be compensated at 1.5× the hourly rate. A clause paying at 'standard rate' is non-compliant.",
  "PDPA 2010 requires that personal data is only processed for the specific purpose disclosed at collection. Blanket third-party sharing clauses are void.",
  "A non-compete lasting more than 12–18 months and covering a broad geographic area is typically unenforceable under s.28 of the Contracts Act 1950.",
  "Minimum annual leave under s.60E of the Employment Act is 8 days for under 2 years, 12 days for 2–5 years, and 16 days for over 5 years.",
  "Termination notice must be at least 4 weeks for employees with 2+ years of service under s.12 of the Employment Act 1955.",
];
let ri=0;
function sendMsg(){
  const inp=document.getElementById('chat-input');
  const val=inp.value.trim(); if(!val) return;
  const msgs=document.getElementById('chat-messages');
  msgs.innerHTML+=`<div class="msg user"><div class="msg-avatar">👤</div><div class="msg-bubble">${val}</div></div>`;
  inp.value=''; msgs.scrollTop=msgs.scrollHeight;
  setTimeout(()=>{
    msgs.innerHTML+=`<div class="msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble">${aiReplies[ri%aiReplies.length]}</div></div>`;
    ri++; msgs.scrollTop=msgs.scrollHeight;
  },900);
}

// Init
buildHistoryList();
