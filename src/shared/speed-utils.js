(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HboMaxSpeedUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'hboMaxSpeedSettings';
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4.0;
  const DEFAULT_SPEED = 1.0;
  const STEP_COARSE = 0.25;
  const STEP_FINE = 0.05;

  const FAVORITE_PRESETS = Object.freeze([1.25, 1.5, 1.75, 2.0]);
  const QUICK_PRESETS = Object.freeze([1.0, 1.25, 1.5, 1.75, 2.0]);
  const ALL_PRESETS = Object.freeze([0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]);

  const DEFAULT_SETTINGS = Object.freeze({
    speed: 1.0,
    lastNonDefaultSpeed: 1.5,
    rememberSpeed: true,
    showOverlay: true,
    keyboardEnabled: true,
  });

  const EPSILON = 1e-6;

  function clampSpeed(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
      return DEFAULT_SPEED;
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return DEFAULT_SPEED;
    }
    const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, num));
    return Math.round(clamped * 100) / 100;
  }

  function formatSpeed(rate) {
    const clamped = clampSpeed(rate);
    if (Math.abs(clamped - Math.round(clamped)) < EPSILON) {
      return `${clamped.toFixed(1)}x`;
    }
    return `${clamped.toFixed(2)}x`;
  }

  function formatBadge(rate) {
    const clamped = clampSpeed(rate);
    if (Math.abs(clamped - DEFAULT_SPEED) <= 0.001) {
      return '';
    }
    const oneDecimal = Number(clamped.toFixed(1));
    if (Math.abs(clamped - oneDecimal) < EPSILON) {
      const compact = `${clamped.toFixed(1)}x`;
      if (compact.length <= 4) {
        return compact;
      }
    }
    const clean = String(Number(clamped.toFixed(2)));
    return clean.length <= 4 ? clean : clean.slice(0, 4);
  }

  function stepSpeed(current, direction, fine = false) {
    const cur = clampSpeed(current);
    if (!direction) {
      return cur;
    }
    const dir = direction > 0 ? 1 : -1;

    if (fine) {
      return clampSpeed(cur + dir * STEP_FINE);
    }

    const firstPreset = ALL_PRESETS[0];
    const lastPreset = ALL_PRESETS[ALL_PRESETS.length - 1];

    if (dir > 0) {
      if (cur >= lastPreset - EPSILON) {
        return clampSpeed(cur + STEP_COARSE);
      }
      if (cur < firstPreset - EPSILON) {
        return clampSpeed(cur + STEP_COARSE);
      }
      for (let i = 0; i < ALL_PRESETS.length; i += 1) {
        if (ALL_PRESETS[i] > cur + EPSILON) {
          return ALL_PRESETS[i];
        }
      }
      return clampSpeed(cur + STEP_COARSE);
    }

    if (cur <= firstPreset + EPSILON) {
      return clampSpeed(cur - STEP_COARSE);
    }
    if (cur > lastPreset + EPSILON) {
      return clampSpeed(cur - STEP_COARSE);
    }
    for (let i = ALL_PRESETS.length - 1; i >= 0; i -= 1) {
      if (ALL_PRESETS[i] < cur - EPSILON) {
        return ALL_PRESETS[i];
      }
    }
    return clampSpeed(cur - STEP_COARSE);
  }

  function toggleSpeed(current, lastNonDefaultSpeed) {
    const cur = clampSpeed(current);
    if (Math.abs(cur - DEFAULT_SPEED) > 0.001) {
      return {
        speed: DEFAULT_SPEED,
        lastNonDefaultSpeed: cur,
      };
    }

    const candidate = clampSpeed(lastNonDefaultSpeed);
    const fallback = Math.abs(candidate - DEFAULT_SPEED) > 0.001 ? candidate : 1.5;
    return {
      speed: fallback,
      lastNonDefaultSpeed: fallback,
    };
  }

  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      speed: clampSpeed(src.speed !== undefined ? src.speed : DEFAULT_SETTINGS.speed),
      lastNonDefaultSpeed: clampSpeed(
        src.lastNonDefaultSpeed !== undefined
          ? src.lastNonDefaultSpeed
          : DEFAULT_SETTINGS.lastNonDefaultSpeed
      ),
      rememberSpeed:
        typeof src.rememberSpeed === 'boolean'
          ? src.rememberSpeed
          : DEFAULT_SETTINGS.rememberSpeed,
      showOverlay:
        typeof src.showOverlay === 'boolean'
          ? src.showOverlay
          : DEFAULT_SETTINGS.showOverlay,
      keyboardEnabled:
        typeof src.keyboardEnabled === 'boolean'
          ? src.keyboardEnabled
          : DEFAULT_SETTINGS.keyboardEnabled,
    };
  }

  function isSupportedHost(urlOrHostname) {
    if (!urlOrHostname || typeof urlOrHostname !== 'string') {
      return false;
    }
    const trimmed = urlOrHostname.trim();
    if (!trimmed) {
      return false;
    }

    let hostname = '';
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return false;
        }
        hostname = parsed.hostname;
      } else {
        const parsed = new URL(`https://${trimmed}`);
        hostname = parsed.hostname;
      }
    } catch {
      return false;
    }

    const normalized = hostname.toLowerCase().replace(/\.+$/, '');
    return (
      normalized === 'hbomax.com' ||
      normalized.endsWith('.hbomax.com') ||
      normalized === 'max.com' ||
      normalized.endsWith('.max.com')
    );
  }

  return {
    STORAGE_KEY,
    MIN_SPEED,
    MAX_SPEED,
    DEFAULT_SPEED,
    STEP_COARSE,
    STEP_FINE,
    FAVORITE_PRESETS,
    QUICK_PRESETS,
    ALL_PRESETS,
    DEFAULT_SETTINGS,
    clampSpeed,
    formatSpeed,
    formatBadge,
    stepSpeed,
    toggleSpeed,
    normalizeSettings,
    isSupportedHost,
  };
});
