/**
 * popup.js
 * Manages the popup UI: navigation, summary generation, settings, and history.
 */

// ── State ──────────────────────────────────────────────────────────────────

let currentSummary = null;
let currentSummaryId = null;
let currentPageTitle = '';
let currentPageUrl = '';

// ── DOM References ─────────────────────────────────────────────────────────

const views = {
  main: document.getElementById('main-view'),
  settings: document.getElementById('settings-view'),
  history: document.getElementById('history-view')
};

const els = {
  pageTitle:      document.getElementById('page-title'),
  btnGenerate:    document.getElementById('btn-generate'),
  statusBar:      document.getElementById('status-bar'),
  statusSpinner:  document.getElementById('status-spinner'),
  statusText:     document.getElementById('status-text'),
  summaryCard:    document.getElementById('summary-card'),
  mainIdea:       document.getElementById('summary-main-idea'),
  contributions:  document.getElementById('summary-contributions'),
  methods:        document.getElementById('summary-methods'),
  btnSave:        document.getElementById('btn-save'),
  btnCopy:        document.getElementById('btn-copy'),
  btnNew:         document.getElementById('btn-new'),

  // Settings
  apiKeyInput:    document.getElementById('api-key-input'),
  btnSaveKey:     document.getElementById('btn-save-key'),
  settingsStatus: document.getElementById('settings-status'),

  // History
  historyList:    document.getElementById('history-list'),
  btnClearHist:   document.getElementById('btn-clear-history'),

  // Nav
  btnNavHistory:  document.getElementById('btn-nav-history'),
  btnNavSettings: document.getElementById('btn-nav-settings'),
  btnBackSettings:document.getElementById('btn-back-from-settings'),
  btnBackHistory: document.getElementById('btn-back-from-history'),
};

// ── Navigation ─────────────────────────────────────────────────────────────

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
}

els.btnNavSettings.addEventListener('click', () => {
  loadApiKey();
  showView('settings');
});

els.btnNavHistory.addEventListener('click', () => {
  loadHistory();
  showView('history');
});

els.btnBackSettings.addEventListener('click', () => showView('main'));
els.btnBackHistory.addEventListener('click',  () => showView('main'));

// ── Status Helpers ─────────────────────────────────────────────────────────

function setStatus(type, text) {
  els.statusBar.className = `status-bar visible ${type}`;
  els.statusText.textContent = text;
  els.statusSpinner.style.display = type === 'loading' ? 'block' : 'none';
}

function clearStatus() {
  els.statusBar.className = 'status-bar';
}

// ── Init: load current tab info ────────────────────────────────────────────

async function initCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentPageTitle = tab.title || 'Untitled';
      currentPageUrl = tab.url || '';
      els.pageTitle.textContent = currentPageTitle;
    }
  } catch {
    els.pageTitle.textContent = 'Unknown page';
  }
}

initCurrentTab();

// ── Generate Summary ───────────────────────────────────────────────────────

els.btnGenerate.addEventListener('click', async () => {
  els.btnGenerate.disabled = true;
  els.summaryCard.classList.remove('visible');
  clearStatus();
  setStatus('loading', 'Extracting abstract...');

  try {
    // Step 1: Extract abstract via content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Cannot access the current tab.');

    // Ensure content script is injected (handles edge cases where it didn't auto-inject)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {}); // ignore if already injected

    const extractResult = await chrome.tabs.sendMessage(tab.id, { action: 'extractAbstract' });

    if (!extractResult?.success) {
      throw new Error(extractResult?.error || 'No abstract found on this page. Try a research article page.');
    }

    setStatus('loading', 'Summarizing with AI...');

    // Step 2: Send to background for API call
    const summaryResult = await chrome.runtime.sendMessage({
      action: 'summarize',
      text: extractResult.text,
      pageTitle: currentPageTitle,
      pageUrl: currentPageUrl
    });

    if (!summaryResult?.success) {
      throw new Error(summaryResult?.error || 'Summarization failed.');
    }

    currentSummary = summaryResult.summary;

    // Get the ID from history (background just saved it)
    const histData = await chrome.storage.local.get('history');
    currentSummaryId = histData.history?.[0]?.id ?? null;

    clearStatus();
    renderSummary(currentSummary);
    els.btnSave.classList.remove('saved');
    els.btnSave.textContent = '💾 Save';

  } catch (err) {
    setStatus('error', err.message);
  } finally {
    els.btnGenerate.disabled = false;
  }
});

// ── Render Summary ─────────────────────────────────────────────────────────

function renderSummary(summary) {
  els.mainIdea.textContent = summary.mainIdea || '—';

  els.contributions.innerHTML = '';
  const contributions = Array.isArray(summary.keyContributions)
    ? summary.keyContributions
    : [String(summary.keyContributions)];

  contributions.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    els.contributions.appendChild(li);
  });

  els.methods.textContent = summary.methods || '—';
  els.summaryCard.classList.add('visible');
}

// ── Save / Copy / New ──────────────────────────────────────────────────────

els.btnSave.addEventListener('click', async () => {
  if (!currentSummaryId) return;
  try {
    await chrome.runtime.sendMessage({ action: 'saveSummary', id: currentSummaryId });
    els.btnSave.textContent = '✓ Saved';
    els.btnSave.classList.add('saved');
  } catch {
    // ignore
  }
});

els.btnCopy.addEventListener('click', () => {
  if (!currentSummary) return;
  const lines = [
    '=== Paper Summary ===',
    '',
    'MAIN IDEA',
    currentSummary.mainIdea,
    '',
    'KEY CONTRIBUTIONS',
    ...(Array.isArray(currentSummary.keyContributions)
      ? currentSummary.keyContributions.map(c => `• ${c}`)
      : [`• ${currentSummary.keyContributions}`]),
    '',
    'METHODS',
    currentSummary.methods
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const orig = els.btnCopy.textContent;
    els.btnCopy.textContent = '✓ Copied';
    setTimeout(() => { els.btnCopy.textContent = orig; }, 1500);
  });
});

els.btnNew.addEventListener('click', () => {
  els.summaryCard.classList.remove('visible');
  clearStatus();
  currentSummary = null;
  currentSummaryId = null;
});

// ── Settings ───────────────────────────────────────────────────────────────

async function loadApiKey() {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (apiKey) {
    els.apiKeyInput.value = apiKey;
  }
}

function showSettingsStatus(type, text) {
  els.settingsStatus.className = `settings-status visible ${type}`;
  els.settingsStatus.textContent = text;
  setTimeout(() => {
    els.settingsStatus.className = 'settings-status';
  }, 3000);
}

els.btnSaveKey.addEventListener('click', async () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    showSettingsStatus('error', 'Please enter an API key.');
    return;
  }
  if (!key.startsWith('gsk_')) {
    showSettingsStatus('error', 'Key should start with "gsk_". Check your key.');
    return;
  }
  await chrome.storage.sync.set({ apiKey: key });
  showSettingsStatus('success', 'API key saved successfully.');
});

// Toggle key visibility on double-click
els.apiKeyInput.addEventListener('dblclick', () => {
  els.apiKeyInput.type = els.apiKeyInput.type === 'password' ? 'text' : 'password';
});

// ── History ────────────────────────────────────────────────────────────────

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get('history');

  if (history.length === 0) {
    els.historyList.innerHTML = '<div class="history-empty">No summaries yet.</div>';
    return;
  }

  els.historyList.innerHTML = '';
  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const date = new Date(entry.savedAt).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    item.innerHTML = `
      <div class="history-item-title">${escapeHtml(entry.title)}</div>
      <div class="history-item-meta">${date}${entry.pinned ? ' · Saved' : ''}</div>
      <div class="history-item-idea">${escapeHtml(entry.summary?.mainIdea || '')}</div>
    `;

    item.addEventListener('click', () => {
      currentSummary = entry.summary;
      currentSummaryId = entry.id;
      currentPageTitle = entry.title;
      currentPageUrl = entry.url;
      els.pageTitle.textContent = entry.title;
      renderSummary(entry.summary);
      showView('main');
    });

    els.historyList.appendChild(item);
  });
}

els.btnClearHist.addEventListener('click', async () => {
  if (!confirm('Clear all saved summaries?')) return;
  await chrome.storage.local.set({ history: [] });
  loadHistory();
});

// ── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
