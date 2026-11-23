importScripts('../shared/speed-utils.js');

const { formatBadge } = globalThis.HboMaxSpeedUtils;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'SPEED_STATE_UPDATED') {
    return;
  }

  const tabId = sender && sender.tab && sender.tab.id;
  if (typeof tabId !== 'number') {
    return;
  }

  if (message.hasVideo) {
    const text = formatBadge(message.speed);
    chrome.action.setBadgeText({ tabId, text }).catch(() => {});
    if (text) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#6D28D9' }).catch(() => {});
      if (typeof chrome.action.setBadgeTextColor === 'function') {
        chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }).catch(() => {});
      }
    }
  } else {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
});
