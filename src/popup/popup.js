(function () {
  'use strict';

  const {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    FAVORITE_PRESETS,
    clampSpeed,
    formatSpeed,
    stepSpeed,
    normalizeSettings,
    isSupportedHost,
    getServiceForUrl,
    SERVICE_NAMES,
  } = globalThis.HboMaxSpeedUtils;

  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const liveSpeedEl = document.getElementById('live-speed');
  const favoritesGrid = document.getElementById('favorites-grid');
  const speedSlider = document.getElementById('speed-slider');
  const stepDownBtn = document.getElementById('step-down-btn');
  const stepUpBtn = document.getElementById('step-up-btn');
  const resetBtn = document.getElementById('reset-btn');
  const toggleRemember = document.getElementById('toggle-remember');
  const toggleOverlay = document.getElementById('toggle-overlay');
  const toggleKeyboard = document.getElementById('toggle-keyboard');

  const presetButtons = new Map();

  let activeTabId = null;
  let activeTabSupported = false;
  let activeTabDebug = '';
  let activeServiceName = '';
  let hasVideo = false;
  let settings = normalizeSettings(DEFAULT_SETTINGS);
  let currentSpeed = settings.speed;

  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }

  async function loadStoredSettings() {
    try {
      const localResult = await withTimeout(chrome.storage.local.get(STORAGE_KEY), 600, null);
      if (localResult && localResult[STORAGE_KEY]) {
        return normalizeSettings(localResult[STORAGE_KEY]);
      }
    } catch {
      // Fallback to sync storage.
    }
    try {
      const result = await withTimeout(chrome.storage.sync.get(STORAGE_KEY), 600, null);
      if (result && result[STORAGE_KEY]) {
        return normalizeSettings(result[STORAGE_KEY]);
      }
    } catch {
      // Ignore storage read failures.
    }
    return normalizeSettings(DEFAULT_SETTINGS);
  }

  async function saveStoredSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    const payload = { [STORAGE_KEY]: normalized };
    try {
      await withTimeout(chrome.storage.local.set(payload), 600, null);
    } catch {
      // Ignore local storage write failures.
    }
    try {
      await withTimeout(chrome.storage.sync.set(payload), 600, null);
    } catch {
      // Sync storage may be unavailable in de-Googled Chromium browsers.
    }
  }

  async function sendTabMessage(tabId, message) {
    try {
      return await withTimeout(chrome.tabs.sendMessage(tabId, message), 800, null);
    } catch {
      return null;
    }
  }

  async function sendRuntimeMessage(message) {
    try {
      return await withTimeout(chrome.runtime.sendMessage(message), 800, null);
    } catch {
      return null;
    }
  }

  async function ensureContentScriptsInjected(tabId) {
    if (!chrome.scripting || typeof chrome.scripting.executeScript !== 'function') {
      return false;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: [
          'src/shared/speed-utils.js',
          'src/content/video-controller.js',
          'src/content/overlay-ui.js',
          'src/content/main.js',
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  function buildPresetButtons() {
    FAVORITE_PRESETS.forEach((rate) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-btn';
      btn.textContent = formatSpeed(rate);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => applySpeed(rate));
      favoritesGrid.appendChild(btn);
      presetButtons.set(rate, btn);
    });
  }

  function render() {
    const clamped = clampSpeed(currentSpeed);
    const label = formatSpeed(clamped);
    liveSpeedEl.textContent = label;
    liveSpeedEl.classList.toggle('is-pending', !(activeTabSupported && hasVideo));
    resetBtn.disabled = Math.abs(clamped - 1.0) <= 0.001;

    speedSlider.value = String(clamped);
    const min = Number(speedSlider.min);
    const max = Number(speedSlider.max);
    speedSlider.style.setProperty('--fill', `${((clamped - min) / (max - min)) * 100}%`);
    speedSlider.setAttribute('aria-valuetext', label);

    presetButtons.forEach((btn, rate) => {
      const on = Math.abs(clamped - rate) <= 0.001;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    toggleRemember.checked = settings.rememberSpeed;
    toggleOverlay.checked = settings.showOverlay;
    toggleKeyboard.checked = settings.keyboardEnabled;

    statusPill.classList.remove('is-active', 'is-ready');
    statusPill.removeAttribute('title');
    if (activeTabSupported && hasVideo) {
      statusPill.classList.add('is-active');
      statusText.textContent = activeServiceName ? `Playing on ${activeServiceName}` : `Playing at ${label}`;
    } else if (activeTabSupported) {
      statusPill.classList.add('is-ready');
      statusText.textContent = 'Start a video to apply';
    } else {
      statusText.textContent = 'Open a streaming site';
      statusPill.title = `Works on ${SERVICE_NAMES.join(', ')}. Your speed is saved for next time.${
        activeTabDebug ? ` (${activeTabDebug})` : ''
      }`;
    }
  }

  async function applySpeed(rate) {
    const next = clampSpeed(rate);
    currentSpeed = next;
    settings = normalizeSettings({
      ...settings,
      speed: next,
      lastNonDefaultSpeed: Math.abs(next - 1.0) > 0.001 ? next : settings.lastNonDefaultSpeed,
    });
    render();

    await saveStoredSettings(settings);

    if (activeTabSupported && activeTabId !== null) {
      let response = await sendTabMessage(activeTabId, {
        type: 'SET_SPEED',
        speed: next,
      });
      if (!response && (await ensureContentScriptsInjected(activeTabId))) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        response = await sendTabMessage(activeTabId, {
          type: 'SET_SPEED',
          speed: next,
        });
      }
      if (response) {
        hasVideo = Boolean(response.hasVideo);
        if (response.settings) {
          settings = normalizeSettings(response.settings);
        }
        render();
        return;
      }
    }

    const broadcast = await sendRuntimeMessage({ type: 'BROADCAST_SPEED', speed: next });
    if (broadcast && Array.isArray(broadcast.results) && broadcast.results.length > 0) {
      const hit = broadcast.results.find((r) => r.hasVideo) || broadcast.results[0];
      activeTabId = hit.tabId;
      activeTabSupported = true;
      activeTabDebug = '';
      activeServiceName = await lookupServiceName(hit.tabId);
      hasVideo = Boolean(hit.hasVideo);
      render();
    }
  }

  async function applySettingPatch(patch) {
    settings = normalizeSettings({
      ...settings,
      ...patch,
    });
    render();

    await saveStoredSettings(settings);

    if (activeTabSupported && activeTabId !== null) {
      const response = await sendTabMessage(activeTabId, {
        type: 'UPDATE_SETTINGS',
        settings: patch,
      });
      if (response) {
        hasVideo = Boolean(response.hasVideo);
        if (typeof response.speed === 'number') {
          currentSpeed = clampSpeed(response.speed);
        }
        if (response.settings) {
          settings = normalizeSettings(response.settings);
        }
        render();
      }
    }
  }

  function bindEvents() {
    speedSlider.addEventListener('input', () => {
      currentSpeed = clampSpeed(speedSlider.value);
      render();
    });

    speedSlider.addEventListener('change', () => {
      applySpeed(speedSlider.value);
    });

    stepDownBtn.addEventListener('click', () => {
      applySpeed(stepSpeed(currentSpeed, -1, true));
    });

    stepUpBtn.addEventListener('click', () => {
      applySpeed(stepSpeed(currentSpeed, 1, true));
    });

    resetBtn.addEventListener('click', () => {
      applySpeed(1.0);
    });

    toggleRemember.addEventListener('change', () => {
      applySettingPatch({ rememberSpeed: toggleRemember.checked });
    });

    toggleOverlay.addEventListener('change', () => {
      applySettingPatch({ showOverlay: toggleOverlay.checked });
    });

    toggleKeyboard.addEventListener('change', () => {
      applySettingPatch({ keyboardEnabled: toggleKeyboard.checked });
    });
  }

  function extractHostLabel(url) {
    if (!url) {
      return 'no-url';
    }
    try {
      return new URL(url).hostname || url.slice(0, 24);
    } catch {
      return url.slice(0, 24);
    }
  }

  async function lookupServiceName(tabId) {
    if (typeof tabId !== 'number' || !chrome.tabs || typeof chrome.tabs.get !== 'function') {
      return '';
    }
    try {
      const tab = await withTimeout(chrome.tabs.get(tabId), 600, null);
      const service = tab ? getServiceForUrl(tab.url || '') : null;
      return service ? service.name : '';
    } catch {
      return '';
    }
  }

  async function discoverTargetTab() {
    // 1. Check tabs already registered by our content script in the background worker.
    const trackedResp = await sendRuntimeMessage({ type: 'GET_TRACKED_TABS' });
    const tracked =
      trackedResp && Array.isArray(trackedResp.tabs) ? trackedResp.tabs : [];

    for (let i = 0; i < tracked.length; i += 1) {
      const entry = tracked[i];
      if (typeof entry.tabId !== 'number') {
        continue;
      }
      const state = await sendTabMessage(entry.tabId, { type: 'GET_STATE' });
      if (state) {
        return { tabId: entry.tabId, supported: true, state };
      }
    }

    // 2. Query ALL tabs unfiltered (works reliably across Chromium forks like Ardia/Arc).
    const allTabs = (await withTimeout(chrome.tabs.query({}), 800, [])) || [];
    const streamingTabs = allTabs.filter((t) => typeof t.id === 'number' && isSupportedHost(t.url || ''));

    if (streamingTabs.length > 0) {
      const preferred =
        streamingTabs.find((t) => t.active && t.audible) ||
        streamingTabs.find((t) => t.active) ||
        streamingTabs.find((t) => t.audible) ||
        streamingTabs[0];

      let state = await sendTabMessage(preferred.id, { type: 'GET_STATE' });
      if (!state && (await ensureContentScriptsInjected(preferred.id))) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        state = await sendTabMessage(preferred.id, { type: 'GET_STATE' });
      }
      return { tabId: preferred.id, supported: true, state };
    }

    // 3. Probe active/recent tabs even if their reported tab.url isn't a known streaming URL (e.g. shell URLs).
    const ordered = [...allTabs].sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
    const probeLimit = Math.min(ordered.length, 8);
    for (let i = 0; i < probeLimit; i += 1) {
      const tab = ordered[i];
      if (!tab || typeof tab.id !== 'number') {
        continue;
      }
      const state = await sendTabMessage(tab.id, { type: 'GET_STATE' });
      if (state) {
        return { tabId: tab.id, supported: true, state };
      }
    }

    if (ordered.length === 0) {
      return { tabId: null, supported: false, state: null, debug: 'no tabs' };
    }

    const hosts = Array.from(new Set(ordered.slice(0, 3).map((t) => extractHostLabel(t.url)))).join(', ');
    return {
      tabId: ordered[0].id,
      supported: false,
      state: null,
      debug: `${ordered.length}t: ${hosts}`,
    };
  }

  async function init() {
    buildPresetButtons();
    bindEvents();

    settings = await loadStoredSettings();
    currentSpeed = settings.rememberSpeed ? settings.speed : 1.0;

    try {
      const found = await discoverTargetTab();
      activeTabId = found.tabId;
      activeTabSupported = Boolean(found.supported);
      activeTabDebug = found.debug || '';
      activeServiceName = await lookupServiceName(found.tabId);

      if (found.state) {
        hasVideo = Boolean(found.state.hasVideo);
        if (typeof found.state.speed === 'number') {
          currentSpeed = clampSpeed(found.state.speed);
        }
        if (found.state.settings) {
          settings = normalizeSettings(found.state.settings);
        }
      }
    } catch (err) {
      activeTabDebug = err && err.message ? err.message.slice(0, 28) : 'tab query error';
    }

    render();
  }

  init().catch((err) => {
    activeTabDebug = err && err.message ? err.message.slice(0, 28) : 'init error';
    render();
  });
})();
