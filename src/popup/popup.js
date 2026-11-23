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
  } = globalThis.HboMaxSpeedUtils;

  const OTHER_PRESETS = [0.5, 0.75, 1.0, 2.5, 3.0];

  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const liveSpeedEl = document.getElementById('live-speed');
  const favoritesGrid = document.getElementById('favorites-grid');
  const otherPresetsRow = document.getElementById('other-presets-row');
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
  let hasVideo = false;
  let settings = normalizeSettings(DEFAULT_SETTINGS);
  let currentSpeed = settings.speed;

  async function loadStoredSettings() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      if (result && result[STORAGE_KEY]) {
        return normalizeSettings(result[STORAGE_KEY]);
      }
    } catch {
      // Fallback to local storage.
    }
    try {
      const localResult = await chrome.storage.local.get(STORAGE_KEY);
      if (localResult && localResult[STORAGE_KEY]) {
        return normalizeSettings(localResult[STORAGE_KEY]);
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
      await chrome.storage.sync.set(payload);
    } catch {
      try {
        await chrome.storage.local.set(payload);
      } catch {
        // Ignore storage write failures.
      }
    }
  }

  async function sendTabMessage(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      return null;
    }
  }

  function buildPresetButtons() {
    FAVORITE_PRESETS.forEach((rate) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-btn';
      btn.textContent = formatSpeed(rate);
      btn.addEventListener('click', () => applySpeed(rate));
      favoritesGrid.appendChild(btn);
      presetButtons.set(rate, btn);
    });

    OTHER_PRESETS.forEach((rate) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.textContent = formatSpeed(rate);
      btn.addEventListener('click', () => applySpeed(rate));
      otherPresetsRow.appendChild(btn);
      presetButtons.set(rate, btn);
    });
  }

  function render() {
    const clamped = clampSpeed(currentSpeed);
    liveSpeedEl.textContent = formatSpeed(clamped);
    liveSpeedEl.classList.toggle('is-boosted', Math.abs(clamped - 1.0) > 0.001);

    speedSlider.value = String(clamped);

    presetButtons.forEach((btn, rate) => {
      btn.classList.toggle('is-active', Math.abs(clamped - rate) <= 0.001);
    });

    toggleRemember.checked = settings.rememberSpeed;
    toggleOverlay.checked = settings.showOverlay;
    toggleKeyboard.checked = settings.keyboardEnabled;

    statusPill.classList.remove('is-active', 'is-ready');
    if (activeTabSupported && hasVideo) {
      statusPill.classList.add('is-active');
      statusText.textContent = 'Active on HBO Max';
    } else if (activeTabSupported) {
      statusPill.classList.add('is-ready');
      statusText.textContent = 'Ready on HBO Max';
    } else {
      statusText.textContent = 'Saved for HBO Max';
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

    if (activeTabSupported && activeTabId !== null) {
      const response = await sendTabMessage(activeTabId, {
        type: 'SET_SPEED',
        speed: next,
      });
      if (response) {
        hasVideo = Boolean(response.hasVideo);
        if (response.settings) {
          settings = normalizeSettings(response.settings);
        }
        render();
        return;
      }
    }

    await saveStoredSettings(settings);
  }

  async function applySettingPatch(patch) {
    settings = normalizeSettings({
      ...settings,
      ...patch,
    });
    render();

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
        return;
      }
    }

    await saveStoredSettings(settings);
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

  async function init() {
    buildPresetButtons();
    bindEvents();

    settings = await loadStoredSettings();
    currentSpeed = settings.rememberSpeed ? settings.speed : 1.0;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs && tabs[0];
      if (activeTab && typeof activeTab.id === 'number') {
        activeTabId = activeTab.id;
        activeTabSupported = isSupportedHost(activeTab.url || '');

        if (activeTabSupported) {
          const state = await sendTabMessage(activeTabId, { type: 'GET_STATE' });
          if (state) {
            hasVideo = Boolean(state.hasVideo);
            if (typeof state.speed === 'number') {
              currentSpeed = clampSpeed(state.speed);
            }
            if (state.settings) {
              settings = normalizeSettings(state.settings);
            }
          }
        }
      }
    } catch {
      // Ignore tab query errors when popup opens outside normal tab context.
    }

    render();
  }

  init();
})();
