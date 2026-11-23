(function () {
  'use strict';

  if (globalThis.__hboMaxSpeedMainInstalled) {
    return;
  }
  globalThis.__hboMaxSpeedMainInstalled = true;

  const utils = globalThis.HboMaxSpeedUtils;
  const controllerLib = globalThis.HboMaxVideoController;
  const overlayLib = globalThis.HboMaxOverlayUI;

  if (!utils || !controllerLib) {
    return;
  }

  const {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    clampSpeed,
    stepSpeed,
    toggleSpeed,
    normalizeSettings,
  } = utils;
  const { VideoController } = controllerLib;

  const ALT_DIGIT_MAP = {
    Digit1: 1.0,
    Digit2: 1.25,
    Digit3: 1.5,
    Digit4: 1.75,
    Digit5: 2.0,
  };

  let settings = normalizeSettings(DEFAULT_SETTINGS);
  let controller = null;
  let overlay = null;

  function safeSendRuntimeMessage(payload) {
    try {
      const maybePromise = chrome.runtime.sendMessage(payload);
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore extension context invalidated or missing background receiver.
    }
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      if (result && result[STORAGE_KEY]) {
        return normalizeSettings(result[STORAGE_KEY]);
      }
    } catch {
      // Fallback to local storage when sync is unavailable.
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

  async function persistSettings(nextSettings) {
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

  function buildStateResponse() {
    return {
      speed: controller ? controller.getSpeed() : settings.speed,
      hasVideo: controller ? controller.hasQualifyingVideo() : false,
      settings,
      isTopFrame: window === window.top,
    };
  }

  function syncOverlay(showToastFlag = false) {
    if (!overlay || !controller) {
      return;
    }
    const speed = controller.getSpeed();
    const hasVideo = controller.hasQualifyingVideo();
    overlay.setState({
      speed,
      hasVideo,
      visible: settings.showOverlay,
    });
    if (showToastFlag && hasVideo) {
      overlay.showToast(speed);
    }
  }

  function notifyBackground(speed, hasVideo) {
    safeSendRuntimeMessage({
      type: 'SPEED_STATE_UPDATED',
      speed,
      hasVideo,
    });
  }

  async function applySpeed(nextRate, { showToast = false, persist = true } = {}) {
    const clamped = clampSpeed(nextRate);
    const updatedLastNonDefault =
      Math.abs(clamped - 1.0) > 0.001 ? clamped : settings.lastNonDefaultSpeed;

    settings = normalizeSettings({
      ...settings,
      speed: clamped,
      lastNonDefaultSpeed: updatedLastNonDefault,
    });

    if (controller) {
      controller.setSpeed(clamped);
    }
    syncOverlay(showToast);

    if (persist) {
      await persistSettings(settings);
    }
  }

  function isEditableTarget(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const target = path.length > 0 ? path[0] : event.target;
    if (!target) {
      return false;
    }
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return false;
  }

  function handleKeyDown(event) {
    if (!settings.keyboardEnabled || !controller || !controller.hasQualifyingVideo()) {
      return;
    }
    if (isEditableTarget(event)) {
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const preset = ALT_DIGIT_MAP[event.code];
      if (preset !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        applySpeed(preset, { showToast: true, persist: true });
      }
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === '[' || event.key === '<') {
      event.preventDefault();
      event.stopPropagation();
      const next = stepSpeed(controller.getSpeed(), -1, false);
      applySpeed(next, { showToast: true, persist: true });
      return;
    }

    if (event.key === ']' || event.key === '>') {
      event.preventDefault();
      event.stopPropagation();
      const next = stepSpeed(controller.getSpeed(), 1, false);
      applySpeed(next, { showToast: true, persist: true });
      return;
    }

    if (event.key === '\\') {
      event.preventDefault();
      event.stopPropagation();
      const toggled = toggleSpeed(controller.getSpeed(), settings.lastNonDefaultSpeed);
      settings = normalizeSettings({
        ...settings,
        speed: toggled.speed,
        lastNonDefaultSpeed: toggled.lastNonDefaultSpeed,
      });
      controller.setSpeed(toggled.speed);
      syncOverlay(true);
      persistSettings(settings);
    }
  }

  function handleStorageChanged(changes) {
    if (!changes || !changes[STORAGE_KEY]) {
      return;
    }
    const prevSettings = settings;
    const next = normalizeSettings(changes[STORAGE_KEY].newValue);
    settings = next;

    const speedChanged = Math.abs(next.speed - prevSettings.speed) > 0.001;

    if (controller && next.rememberSpeed && speedChanged) {
      controller.setSpeed(next.speed);
    }
    syncOverlay(false);
  }

  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (!message || typeof message.type !== 'string') {
      return false;
    }

    if (message.type === 'GET_STATE') {
      if (controller) {
        controller.scan();
      }
      const state = buildStateResponse();
      if (window === window.top || state.hasVideo) {
        sendResponse(state);
        return false;
      }
      return false;
    }

    if (message.type === 'SET_SPEED') {
      applySpeed(message.speed, { showToast: true, persist: true }).then(() => {
        sendResponse(buildStateResponse());
      });
      return true;
    }

    if (message.type === 'UPDATE_SETTINGS') {
      settings = normalizeSettings({
        ...settings,
        ...(message.settings || {}),
      });
      syncOverlay(false);
      persistSettings(settings).then(() => {
        sendResponse(buildStateResponse());
      });
      return true;
    }

    return false;
  }

  async function init() {
    settings = await loadSettings();
    const initialSpeed = settings.rememberSpeed ? settings.speed : 1.0;

    controller = new VideoController({
      document,
      window,
      initialSpeed,
      onStateChange: ({ speed, hasVideo }) => {
        syncOverlay(false);
        if (window === window.top || hasVideo) {
          notifyBackground(speed, hasVideo);
        }
      },
    });

    if (overlayLib && typeof overlayLib.SpeedOverlayUI === 'function') {
      overlay = new overlayLib.SpeedOverlayUI({
        document,
        window,
        onSelectSpeed: (rate) => {
          applySpeed(rate, { showToast: false, persist: true });
        },
        onStepSpeed: (direction, fine) => {
          const next = stepSpeed(controller.getSpeed(), direction, fine);
          applySpeed(next, { showToast: false, persist: true });
        },
      });
    }

    controller.start();
    syncOverlay(false);
    notifyBackground(controller.getSpeed(), controller.hasQualifyingVideo());

    window.addEventListener('keydown', handleKeyDown, true);
    chrome.storage.onChanged.addListener(handleStorageChanged);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  }

  init();
})();
