const $ = id => document.getElementById(id);
let currentData = null;
let courseFiles = [];

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('pane-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'history') renderHistory();
    if (tab.dataset.tab === 'settings') loadSavedKeyDisplay();
  });
});
ehehe
// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // ── Save API key button ───────────────────────────────────────────────────
  $('saveKeyBtn').addEventListener('click', async () => {
    const key = $('apiKey').value.trim();
    const statusEl = $('keyStatus');
    const displayEl = $('savedKeyDisplay');

    if (!key) {
      statusEl.textContent = '⚠ Please paste your API key first.';
      statusEl.className = 'key-status error';
      return;
    }

    if (!key.startsWith('sk-ant-')) {
      statusEl.textContent = '⚠ Key should start with sk-ant- — double check you copied it fully.';
      statusEl.className = 'key-status error';
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey: key });
      $('apiKey').value = '';
      $('apiKey').placeholder = '••••••••••••••••••••';
      displayEl.textContent = 'Saved: ' + key.slice(0, 14) + '••••••••••••••••••';
      statusEl.textContent = '✓ API key saved successfully!';
      statusEl.className = 'key-status success';
      setTimeout(() => { statusEl.className = 'key-status'; }, 3000);
    } catch (e) {
      statusEl.textContent = '✗ Failed to save: ' + e.message;
      statusEl.className = 'key-status error';
    }
  });

  // Also allow pressing Enter in the key field
  $('apiKey').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('saveKeyBtn').click();
  });

  // ── Check current tab ─────────────────────────────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  // Restore saved outcomes
  const { savedOutcomes = {} } = await chrome.storage.local.get('savedOutcomes');
  if (savedOutcomes[url]) $('outcomes').value = savedOutcomes[url];

  const isCanvas = url.includes('instructure.com') || url.includes('canvas.net') || url.includes('uncp.edu');
  const isDiscussion = url.includes('/discussion_topics/');

  if (!isCanvas) { setStatus('red', 'Not on a Canvas page'); return; }
  if (!isDiscussion) { setStatus('amber', 'Navigate to a <b>Discussion</b> page to analyze'); return; }

  // Scrape posts
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_DISCUSSION' });
    if (res?.success && res.data?.posts?.length > 0) {
      currentData = res.data;
      const n = res.data.posts.length;
      setStatus('green', `<span class="cnt">${n} post${n > 1 ? 's' : ''}</span> found — ready to analyze`);
      $('analyzeBtn').disabled = false;
    } else {
      setStatus('amber', 'No posts found — scroll to load all posts');
      $('analyzeBtn').disabled = false;
    }
  } catch {
    setStatus('amber', 'Refresh the discussion page and try again');
    return;
  }

  // Load course files
  loadCourseFiles(tab);
});

// ── Load saved key display ────────────────────────────────────────────────────
async function loadSavedKeyDisplay() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  const displayEl = $('savedKeyDisplay');
  if (apiKey) {
    displayEl.textContent = 'Current key: ' + apiKey.slice(0, 14) + '••••••••••••••••••';
  } else {
    displayEl.textContent = 'No key saved yet.';
  }
}

// ── Load course files into popup ──────────────────────────────────────────────
async function loadCourseFiles(tab) {
  const wrap = $('filesWrap');
  if (!wrap) return;

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'FETCH_COURSE_FILES' });
    if (!res?.success) { showFilesError('Could not load course files.'); return; }

    courseFiles = res.files || [];
    const modules = res.modules || [];
    const pageCount = modules.reduce((a, m) => a + m.items.filter(i => i.type === 'Page').length, 0);
    $('pagesCount').textContent = pageCount > 0 ? `(${pageCount} pages)` : '';

    if (courseFiles.length === 0) {
      wrap.innerHTML = '<div class="files-empty">No files found in this course.</div>';
      return;
    }

    const iconFor = name => {
      const ext = (name || '').split('.').pop().toLowerCase();
      if (ext === 'pdf') return '📄';
      if (['ppt', 'pptx'].includes(ext)) return '📊';
      if (['doc', 'docx'].includes(ext)) return '📝';
      if (['xls', 'xlsx'].includes(ext)) return '📈';
      return '📎';
    };

    const fmtSize = b => {
      if (!b) return '';
      if (b < 1024) return b + 'B';
      if (b < 1048576) return (b / 1024).toFixed(0) + 'KB';
      return (b / 1048576).toFixed(1) + 'MB';
    };

    wrap.innerHTML = courseFiles.map(f => `
      <div class="file-row" data-id="${f.id}">
        <input class="file-cb" type="checkbox" data-id="${f.id}"/>
        <span class="file-icon">${iconFor(f.name)}</span>
        <span class="file-name" title="${f.name}">${f.name}</span>
        <span class="file-size">${fmtSize(f.size)}</span>
      </div>
    `).join('');

    wrap.querySelectorAll('.file-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.type !== 'checkbox') {
          const cb = row.querySelector('.file-cb');
          cb.checked = !cb.checked;
          updateFileCount();
        } else {
          updateFileCount();
        }
      });
    });

  } catch (e) {
    showFilesError('Error: ' + e.message);
  }
}

function updateFileCount() {
  const n = document.querySelectorAll('.file-cb:checked').length;
  $('fileCount').textContent = n > 0 ? `${n} selected` : '';
}

function showFilesError(msg) {
  const wrap = $('filesWrap');
  if (wrap) wrap.innerHTML = `<div class="files-empty" style="color:#ef444488">${msg}</div>`;
}

// ── Analyze ───────────────────────────────────────────────────────────────────
$('analyzeBtn').addEventListener('click', async () => {
  // Check API key first
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    showErr('No API key found. Go to the ⚙ Settings tab, paste your key and click Save.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const outcomes = $('outcomes').value.trim();

  if (outcomes) {
    const { savedOutcomes = {} } = await chrome.storage.local.get('savedOutcomes');
    savedOutcomes[tab.url] = outcomes;
    await chrome.storage.local.set({ savedOutcomes });
  }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_DISCUSSION' });
    if (res?.success) currentData = res.data;
  } catch {}

  if (!currentData?.posts?.length) {
    showErr('Could not read posts. Scroll to load all posts first.');
    return;
  }

  const selectedFileIds = Array.from(document.querySelectorAll('.file-cb:checked')).map(c => c.dataset.id);
  const includePages = $('includePages').checked;

  $('analyzeBtn').disabled = true;
  $('loading').style.display = 'block';
  $('preview').style.display = 'none';
  $('err').style.display = 'none';
  $('loadingMsg').textContent = selectedFileIds.length > 0 || includePages
    ? 'Fetching course materials…' : 'Reading student posts…';

  let materials = null;
  if (selectedFileIds.length > 0 || includePages) {
    try {
      const matRes = await chrome.tabs.sendMessage(tab.id, {
        action: 'FETCH_MATERIALS',
        selectedFileIds,
        includePages,
      });
      if (matRes?.success) materials = matRes.materials;
    } catch {}
    $('loadingMsg').textContent = 'Analyzing with AI…';
  }

  // Tell content script to run analysis — it handles everything including opening dashboard
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(activeTab.id, {
    action: 'RUN_ANALYSIS',
    outcomes,
    selectedFileIds,
    includePages,
  });

  $('loading').style.display = 'none';
  $('analyzeBtn').disabled = false;
  $('preview').style.display = 'block';
  $('pComp').textContent = '…';
  $('pPart').textContent = '…';
  $('pNeed').textContent = '…';
  $('flaggedList').innerHTML = '<div style="font-size:11px;color:#94a3b8;margin-top:4px">⏳ Analysis running — report will open in a new tab</div>';
});

$('viewReport').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

// ── History ───────────────────────────────────────────────────────────────────
async function renderHistory() {
  const { discussionHistory = [] } = await chrome.storage.local.get('discussionHistory');
  const container = $('historyContent');

  if (discussionHistory.length === 0) {
    container.innerHTML = '<div class="hist-empty">No discussions analyzed yet.</div>';
    return;
  }

  container.innerHTML = discussionHistory.map((h, i) => `
    <div class="hist-item" data-idx="${i}">
      <div class="hist-course">${h.courseTitle}</div>
      <div class="hist-title">${h.discussionTitle}</div>
      <div class="hist-meta">
        <span class="hist-badge hb-blue">📊 ${h.overallComprehension}%</span>
        <span class="hist-badge hb-green">👥 ${h.totalParticipants} students</span>
        ${h.needHelpCount > 0 ? `<span class="hist-badge hb-red">⚠ ${h.needHelpCount} need help</span>` : ''}
        ${h.usedFiles?.length > 0 ? `<span class="hist-badge hb-amber">📎 ${h.usedFiles.length} files</span>` : ''}
      </div>
      <div class="hist-date">${formatDate(h.analyzedAt)}</div>
    </div>
  `).join('') + `<button class="clear-hist" id="clearHist">Clear History</button>`;

  container.querySelectorAll('.hist-item').forEach(el => {
    el.addEventListener('click', async () => {
      const h = discussionHistory[parseInt(el.dataset.idx)];
      await chrome.storage.local.set({ lastResult: h.result, lastData: h.data, lastMaterials: h.materials || null });
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });
  });

  $('clearHist')?.addEventListener('click', async () => {
    await chrome.storage.local.remove('discussionHistory');
    renderHistory();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(color, html) {
  $('dot').className = 'dot ' + color;
  $('stxt').innerHTML = html;
}

function showErr(msg) {
  $('err').textContent = msg;
  $('err').style.display = 'block';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
