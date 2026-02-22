// background.js — Minimal. Only saves history and opens dashboard.
// The content script handles ALL API calls to Anthropic.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'SAVE_HISTORY') {
    saveToHistory(msg.discussionData, msg.result, msg.materials)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.action === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }, (dashTab) => {
      const listener = (tabId, info) => {
        if (tabId === dashTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.scripting.executeScript({
            target: { tabId: dashTab.id },
            func: (r, m, mat) => {
              window.__ciResult = r;
              window.__ciMeta = m;
              window.__ciMaterials = mat;
              if (typeof window.__ciRender === 'function') window.__ciRender(r, m, mat);
            },
            args: [msg.result, msg.meta, msg.materials || null],
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    sendResponse({ success: true });
    return true;
  }
});

async function saveToHistory(data, result, materials) {
  const { discussionHistory = [] } = await chrome.storage.local.get('discussionHistory');
  const entry = {
    id: Date.now(),
    courseTitle: data.courseTitle,
    discussionTitle: data.discussionTitle,
    url: data.url,
    analyzedAt: new Date().toISOString(),
    totalParticipants: result.totalParticipants || 0,
    overallComprehension: result.overallComprehension || 0,
    needHelpCount: (result.students || []).filter(
      s => s.recommendedAction === 'intervention' || s.recommendedAction === 'followup'
    ).length,
    usedFiles: materials?.selectedFiles?.map(f => f.name) || [],
    result, data, materials: materials || null,
  };
  const filtered = discussionHistory.filter(h => h.url !== data.url);
  await chrome.storage.local.set({ discussionHistory: [entry, ...filtered].slice(0, 20) });
}
