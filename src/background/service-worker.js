importScripts('../shared/speed-utils.js');

const { formatBadge } = globalThis.HboMaxSpeedUtils;

const TRACKED_TABS_KEY = 'hboMaxTrackedTabs';
const trackedTabs = new Map();

async function persistTrackedTabs() {
  if (!chrome.storage || !chrome.storage.session) {
    return;
  }
  try {
    await chrome.storage.session.set({
      [TRACKED_TABS_KEY]: Array.from(trackedTabs.values()),
    });
  } catch {
    // Ignore session storage unavailability.
  }
}

async function restoreTrackedTabs() {
  if (!chrome.storage || !chrome.storage.session) {
    return;
  }
  try {
    const data = await chrome.storage.session.get(TRACKED_TABS_KEY);
    const list = data && Array.isArray(data[TRACKED_TABS_KEY]) ? data[TRACKED_TABS_KEY] : [];
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (entry && typeof entry.tabId === 'number' && !trackedTabs.has(entry.tabId)) {
        trackedTabs.set(entry.tabId, entry);
      }
    }
  } catch {
    // Ignore session storage errors.
  }
}

function updateBadge(tabId, speed, hasVideo) {
  if (typeof tabId !== 'number') {
    return;
  }
  if (hasVideo) {
    const text = formatBadge(speed);
    chrome.action.setBadgeText({ tabId, text }).catch(() => {});
    if (text) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563EB' }).catch(() => {});
      if (typeof chrome.action.setBadgeTextColor === 'function') {
        chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }).catch(() => {});
      }
    }
  } else {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
}

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (trackedTabs.delete(tabId)) {
      persistTrackedTabs();
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'SPEED_STATE_UPDATED') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId !== 'number') {
      return false;
    }

    const existing = trackedTabs.get(tabId);
    const nextEntry = {
      tabId,
      speed: typeof message.speed === 'number' ? message.speed : 1.0,
      hasVideo: Boolean(message.hasVideo),
      url:
        (typeof message.url === 'string' && message.url) ||
        (sender.tab && sender.tab.url) ||
        (existing && existing.url) ||
        '',
      updatedAt: Date.now(),
    };
    trackedTabs.set(tabId, nextEntry);
    persistTrackedTabs();
    updateBadge(tabId, nextEntry.speed, nextEntry.hasVideo);
    return false;
  }

  if (message.type === 'GET_TRACKED_TABS') {
    restoreTrackedTabs().then(() => {
      const list = Array.from(trackedTabs.values()).sort((a, b) => {
        if (a.hasVideo !== b.hasVideo) {
          return a.hasVideo ? -1 : 1;
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      sendResponse({ tabs: list });
    });
    return true;
  }

  if (message.type === 'BROADCAST_SPEED') {
    restoreTrackedTabs().then(async () => {
      const speed = message.speed;
      const results = [];
      for (const entry of Array.from(trackedTabs.values())) {
        try {
          const resp = await chrome.tabs.sendMessage(entry.tabId, {
            type: 'SET_SPEED',
            speed,
          });
          if (resp) {
            results.push({ tabId: entry.tabId, ...resp });
          }
        } catch {
          trackedTabs.delete(entry.tabId);
        }
      }
      await persistTrackedTabs();
      sendResponse({ results });
    });
    return true;
  }

  return false;
});
