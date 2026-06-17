// ═══════════════════════════════════════════
// GLOBAL STATES
// ═══════════════════════════════════════════
const SCAN_HISTORY_KEY = 'contractsense.scanHistory';
const API_BASE_URL = window.CONTRACTSENSE_API_URL || 'http://127.0.0.1:8000';
let selectedContractFile = null;
let activeContractText = "";
let activeFindings = [];
let activeChatHistory = [];
let activeContractObj = null;
// ═══════════════════════════════════════════
// PAGE ROUTING
// ═══════════════════════════════════════════
function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  
  const pageIndex = ['home', 'scanner', 'history', 'database'].indexOf(name);
  if (pageIndex !== -1) {
    document.querySelectorAll('.nav-btn')[pageIndex].classList.add('active');
  }
  
  if (name === 'database') {
    loadReferenceFiles();
  }
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
  // Find contract clause
  let clause = null;
  if (activeContractObj) {
    const activeClauses = activeContractObj.sections.flatMap(s => s.clauses);
    clause = activeClauses.find(c => c.id === clauseId);
  }
  if (!clause) {
    const allClauses = CONTRACTS.flatMap(ct => ct.sections.flatMap(s=>s.clauses));
    clause = allClauses.find(c=>c.id===clauseId);
  }
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
  selectedContractFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size/1024).toFixed(1)+' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag');
  const f = e.dataTransfer.files[0]; if(!f) return;
  selectedContractFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = (f.size/1024).toFixed(1)+' KB';
  document.getElementById('file-preview').classList.add('show');
  document.getElementById('scan-btn').disabled = false;
}

function removeFile() {
  document.getElementById('file-preview').classList.remove('show');
  document.getElementById('scan-btn').disabled = true;
  document.getElementById('file-input').value='';
  selectedContractFile = null;
}
function togglePill(el){el.classList.toggle('active')}

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
function createContractFromBackendAnalysis(analysis) {
  const now = new Date();
  const findings = analysis.findings || [];
  
  // Clean subtitle from LLM review details if available
  let subtitle = `${analysis.summary} Risk score: ${analysis.risk_score}/100.`;
  if (analysis.llm_review && analysis.llm_review.review) {
    subtitle += ` AI Review generated successfully.`;
  }
  // Create findings sections
  const contractClauses = findings.length
    ? findings.map((finding, index) => ({
        id: `${index + 1}.1`,
        text: finding.excerpt || finding.title,
        status: ['critical','high'].includes(finding.severity) ? 'bad' : 'warn',
        issue: finding.title,
        law: finding.category,
        desc: finding.explanation,
        suggestion: finding.recommendation
      }))
    : [
        {
          id: '1.1',
          text: 'No compliance issues or hidden clauses were detected in this contract.',
          status: 'ok'
        }
      ];
  // If LLM Review exists, add it as a separate section in the document
  const sections = [
    {
      title: findings.length ? 'Flagged Compliance Clauses' : 'Compliance Scan Result',
      clauses: contractClauses
    }
  ];
  if (analysis.llm_review && analysis.llm_review.review) {
    // Split LLM review into bullet points or paragraphs for rendering
    const reviewLines = analysis.llm_review.review.split('\n').filter(line => line.strip ? line.strip() : line.trim());
    sections.push({
      title: 'AI Compliance & Negotiation Guidance',
      clauses: reviewLines.map((line, idx) => ({
        id: `AI.${idx + 1}`,
        text: line,
        status: 'ok'
      }))
    });
  }
  return {
    id: now.getTime(),
    filename: analysis.file_name || document.getElementById('file-name').textContent || 'Uploaded contract',
    company: 'Compliance Review',
    date: now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
    status: analysis.risk_level === 'low' ? 'safe' : findings.some(f => ['high','critical'].includes(f.severity)) ? 'critical' : 'issues',
    title: 'COMPLIANCE SCREENING REPORT',
    subtitle: subtitle,
    meta: [
      `File: ${analysis.file_name || 'Uploaded contract'}`,
      `Risk level: ${analysis.risk_level.toUpperCase()}`,
      `Risk score: ${analysis.risk_score}/100`
    ],
    sig: ['ContractSense AI', 'Compliance Auditor'],
    sections: sections
  };
}
async function analyzeSelectedContract() {
  if(!selectedContractFile) throw new Error('Please choose a contract file first.');
  const formData = new FormData();
  formData.append('file', selectedContractFile);
  formData.append('jurisdiction', 'Malaysia');
  formData.append('language', 'en');
  const response = await fetch(`${API_BASE_URL}/api/contracts/analyze`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok) {
    throw new Error(data.detail || 'The contract could not be analyzed.');
  }

  // Store for Chat context
  activeContractText = data.contract_text || "";
  activeFindings = data.findings || [];
  activeChatHistory = [];
  
  // Set chat panel initial message
  const msgs = document.getElementById('chat-messages');
  if (msgs) {
    msgs.innerHTML = `<div class="msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble">Hi! I have scanned your contract. Ask me any questions about it, or ask for explanations on flagged issues!</div></div>`;
  }
  return createContractFromBackendAnalysis(data);
}
function startScan() {
  if(!selectedContractFile) return;
  const btn = document.getElementById('scan-btn');
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  btn.disabled=true; bar.classList.add('show');
const steps=['Extracting text…','Cross-referencing Malaysian Laws…','Checking Company Policy uploads…','Running AI deep review…','Generating report…'];
  let i=0;
  const iv = setInterval(()=>{
    fill.style.width=((i+1)/steps.length*100)+'%';
    label.textContent=steps[i]; i++;
    if(i>=steps.length){clearInterval(iv);setTimeout(showResults,400);}
  },600);
}
async function showResults() {
  const btn = document.getElementById('scan-btn');
  const label = document.getElementById('progress-label');
  let contract;
  try {
    contract = await analyzeSelectedContract();
    activeContractObj = contract;
  } catch(error) {
    label.textContent = error.message;
    btn.disabled = false;
    return;
  }
  document.getElementById('upload-view').style.display='none';
  document.getElementById('progress-bar').classList.remove('show');
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
  selectedContractFile = null;
  activeContractObj = null;
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
  activeContractObj = contract;
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
  activeContractObj = null;
}
// ═══════════════════════════════════════════
// REFERENCE DATABASE
// ═══════════════════════════════════════════
function handleDbFile(input, type) {
  if (!input.files[0]) return;
  uploadDbFile(type, input.files[0]);
}
function handleDbDrop(e, type) {
  e.preventDefault();
  const zoneId = type === 'law' ? 'law-upload-zone' : 'policy-upload-zone';
  document.getElementById(zoneId).classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  uploadDbFile(type, file);
}
async function uploadDbFile(type, file) {
  const zoneId = type === 'law' ? 'law-upload-zone' : 'policy-upload-zone';
  const zone = document.getElementById(zoneId);
  const originalHtml = zone.innerHTML;
  
  zone.innerHTML = `<div class="progress-label" style="margin-top:0">Uploading ${file.name}...</div>`;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/reference/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Upload failed');
    }
    await loadReferenceFiles();
  } catch (error) {
    alert('Failed to upload file: ' + error.message);
  } finally {
    zone.innerHTML = originalHtml;
  }
}
async function loadReferenceFiles() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/reference/files`);
    if (!response.ok) throw new Error('Failed to load reference files');
    const data = await response.json();
    
    renderReferenceFileList(data.laws, 'law-file-list', 'law');
    renderReferenceFileList(data.policies, 'policy-file-list', 'policy');
    
    // Update rule pills dynamically on scanner page
    updateRulePills(data);
  } catch (error) {
    console.error('Error loading reference files:', error);
  }
}
function renderReferenceFileList(files, containerId, type) {
  const container = document.getElementById(containerId);
  if (!files || files.length === 0) {
    container.innerHTML = `<div class="db-empty-msg">No ${type === 'law' ? 'Malaysian law' : 'company policy'} files imported yet.</div>`;
    return;
  }
  
  container.innerHTML = files.map(file => {
    const sizeKB = (file.size_bytes / 1024).toFixed(1);
    const dateStr = new Date(file.created_at * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    return `
      <div class="db-file-item">
        <div class="db-file-meta">
          <div class="db-file-name" title="${file.name}">${file.name}</div>
          <div class="db-file-size">${sizeKB} KB · Imported ${dateStr}</div>
        </div>
        <button class="db-delete-btn" onclick="deleteDbFile('${type}', '${file.name}')" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}
async function deleteDbFile(type, filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/reference/files/${type}/${filename}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Delete request failed');
    await loadReferenceFiles();
  } catch (error) {
    alert('Failed to delete file: ' + error.message);
  }
}
function updateRulePills(data) {
  const pillsContainer = document.querySelector('.rule-pills');
  if (!pillsContainer) return;
  
  let pillsHtml = '';
  
  // Static Core Laws
  pillsHtml += `<div class="rule-pill active" onclick="togglePill(this)"><span class="dot"></span>Employment Act 1955</div>`;
  pillsHtml += `<div class="rule-pill active" onclick="togglePill(this)"><span class="dot"></span>PDPA 2010</div>`;
  pillsHtml += `<div class="rule-pill active" onclick="togglePill(this)"><span class="dot"></span>Companies Act 2016</div>`;
  
  // Custom Dynamic Laws
  if (data.laws && data.laws.length > 0) {
    data.laws.forEach(law => {
      pillsHtml += `<div class="rule-pill active" onclick="togglePill(this)" data-type="law" data-name="${law.name}"><span class="dot"></span>Law: ${law.name}</div>`;
    });
  }
  
  // Custom Dynamic Company Policies
  if (data.policies && data.policies.length > 0) {
    data.policies.forEach(policy => {
      pillsHtml += `<div class="rule-pill active" onclick="togglePill(this)" data-type="policy" data-name="${policy.name}"><span class="dot"></span>Policy: ${policy.name}</div>`;
    });
  } else {
    pillsHtml += `<div class="rule-pill" onclick="togglePill(this)"><span class="dot"></span>Company policy</div>`;
  }
  
  pillsContainer.innerHTML = pillsHtml;
}
// ═══════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════
function toggleChat(){document.getElementById('chat-box').classList.toggle('open')}
function toggleBig(){document.getElementById('chat-box').classList.toggle('big')}
async function sendMsg() {
  const inp = document.getElementById('chat-input');
  const val = inp.value.trim();
  if (!val) return;
  
  const msgs = document.getElementById('chat-messages');
  // Render user message
  msgs.innerHTML += `<div class="msg user"><div class="msg-avatar">👤</div><div class="msg-bubble">${val}</div></div>`;
  inp.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  
  // Render typing indicator
  const typingId = 'typing-' + Date.now();
  msgs.innerHTML += `
    <div class="msg ai" id="${typingId}">
      <div class="msg-avatar">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  msgs.scrollTop = msgs.scrollHeight;
  
  const userMessage = { role: 'user', content: val };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: val,
        contract_text: activeContractText || "No contract scanned yet.",
        findings: activeFindings || [],
        chat_history: activeChatHistory
      })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Chat request failed');
    
    // Remove typing indicator
    const indicator = document.getElementById(typingId);
    if (indicator) indicator.remove();
    
    // Render AI reply
    msgs.innerHTML += `<div class="msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble">${data.reply}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;
    
    // Save to history
    activeChatHistory.push(userMessage);
    activeChatHistory.push({ role: 'assistant', content: data.reply });
  } catch (error) {
    // Remove typing indicator
    const indicator = document.getElementById(typingId);
    if (indicator) indicator.remove();
    
    msgs.innerHTML += `<div class="msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble" style="border-left:3px solid var(--red)">${error.message}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }
}
// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
buildHistoryList();
loadReferenceFiles();
