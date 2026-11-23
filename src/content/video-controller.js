(function (root, factory) {
  const utils =
    typeof module === 'object' && module.exports
      ? require('../shared/speed-utils.js')
      : root.HboMaxSpeedUtils;
  const api = factory(utils);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.HboMaxVideoController = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utils) {
  'use strict';

  const { clampSpeed, DEFAULT_SPEED } = utils;

  const PLAYER_PATH_RE = /\/(video\/watch|watch|player|feature|episode|play)\b/i;
  const RATE_GUARD_WINDOW_MS = 500;
  const RATE_GUARD_MAX_CORRECTIONS = 6;
  const RECONCILE_INTERVAL_MS = 1500;
  const MUTATION_THROTTLE_MS = 180;

  function findVideosDeep(root) {
    const videos = [];
    if (!root) {
      return videos;
    }

    const visited = new Set();
    const seenVideos = new Set();

    function walk(node) {
      if (!node || visited.has(node)) {
        return;
      }
      visited.add(node);

      if (typeof node.querySelectorAll === 'function') {
        const directVideos = node.querySelectorAll('video');
        for (let i = 0; i < directVideos.length; i += 1) {
          const v = directVideos[i];
          if (v && !seenVideos.has(v)) {
            seenVideos.add(v);
            videos.push(v);
          }
        }

        const elements = node.querySelectorAll('*');
        for (let i = 0; i < elements.length; i += 1) {
          const el = elements[i];
          if (el && el.shadowRoot) {
            walk(el.shadowRoot);
          }
        }
      }

      if (node.shadowRoot) {
        walk(node.shadowRoot);
      }
    }

    walk(root);
    return videos;
  }

  function getFullscreenElement(doc) {
    if (!doc) {
      return null;
    }
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function isElementInside(container, target) {
    if (!container || !target) {
      return false;
    }
    if (container === target) {
      return true;
    }
    if (typeof container.contains === 'function' && container.contains(target)) {
      return true;
    }
    let current = target;
    while (current) {
      if (current === container) {
        return true;
      }
      if (current.parentNode) {
        current = current.parentNode;
      } else if (current.host) {
        current = current.host;
      } else {
        current = null;
      }
    }
    return false;
  }

  function isQualifyingPlayerVideo(video, win, doc) {
    if (!video) {
      return false;
    }

    const fsEl = getFullscreenElement(doc);
    if (fsEl && isElementInside(fsEl, video)) {
      return true;
    }

    const pathname = win && win.location && typeof win.location.pathname === 'string'
      ? win.location.pathname
      : '';
    if (PLAYER_PATH_RE.test(pathname)) {
      return true;
    }

    if (typeof video.getBoundingClientRect === 'function') {
      const rect = video.getBoundingClientRect();
      if (rect && rect.width >= 300 && rect.height >= 160) {
        return true;
      }
    }

    if (!video.muted && typeof video.readyState === 'number' && video.readyState >= 1) {
      return true;
    }

    if (Number.isFinite(video.duration) && video.duration > 60) {
      return true;
    }

    return false;
  }

  class VideoController {
    constructor(options = {}) {
      this.doc = options.document || (typeof document !== 'undefined' ? document : null);
      this.win = options.window || (typeof window !== 'undefined' ? window : null);
      this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;

      this.targetSpeed = clampSpeed(options.initialSpeed !== undefined ? options.initialSpeed : DEFAULT_SPEED);
      this.attachedVideos = new WeakSet();
      this.videoCleanup = [];
      this.rateGuards = new WeakMap();
      this.knownVideos = new Set();

      this._started = false;
      this._hasVideo = false;
      this._lastReportedSpeed = this.targetSpeed;
      this._mutationObserver = null;
      this._reconcileTimer = null;
      this._scanTimer = null;

      this._onDocMediaEvent = this._handleDocumentMediaEvent.bind(this);
    }

    getSpeed() {
      return this.targetSpeed;
    }

    hasQualifyingVideo() {
      return this._hasVideo;
    }

    setSpeed(speed) {
      const next = clampSpeed(speed);
      this.targetSpeed = next;
      const videos = this._discoverVideos();
      for (let i = 0; i < videos.length; i += 1) {
        this._attachVideo(videos[i]);
        this._applySpeedToVideo(videos[i], true);
      }
      this._updateHasVideo(videos, true);
      return this.targetSpeed;
    }

    scan() {
      const videos = this._discoverVideos();
      for (let i = 0; i < videos.length; i += 1) {
        const video = videos[i];
        this._attachVideo(video);
        if (this._shouldEnforceVideo(video)) {
          this._applySpeedToVideo(video, false);
        }
      }
      this._updateHasVideo(videos, false);
      return this._hasVideo;
    }

    start() {
      if (this._started || !this.doc) {
        return;
      }
      this._started = true;

      const mediaEvents = ['play', 'playing', 'loadedmetadata'];
      for (let i = 0; i < mediaEvents.length; i += 1) {
        this.doc.addEventListener(mediaEvents[i], this._onDocMediaEvent, true);
      }

      const Observer =
        (this.win && this.win.MutationObserver) ||
        (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
      const observeTarget = this.doc.documentElement || this.doc.body;

      if (Observer && observeTarget) {
        this._mutationObserver = new Observer(() => {
          this._scheduleScan();
        });
        this._mutationObserver.observe(observeTarget, {
          childList: true,
          subtree: true,
        });
      }

      const setIntervalFn =
        (this.win && this.win.setInterval) ||
        (typeof setInterval !== 'undefined' ? setInterval : null);
      if (setIntervalFn) {
        this._reconcileTimer = setIntervalFn(() => {
          this.scan();
        }, RECONCILE_INTERVAL_MS);
      }

      this.scan();
    }

    stop() {
      if (!this._started) {
        return;
      }
      this._started = false;

      if (this.doc) {
        const mediaEvents = ['play', 'playing', 'loadedmetadata'];
        for (let i = 0; i < mediaEvents.length; i += 1) {
          this.doc.removeEventListener(mediaEvents[i], this._onDocMediaEvent, true);
        }
      }

      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
      }

      const clearIntervalFn =
        (this.win && this.win.clearInterval) ||
        (typeof clearInterval !== 'undefined' ? clearInterval : null);
      if (this._reconcileTimer && clearIntervalFn) {
        clearIntervalFn(this._reconcileTimer);
        this._reconcileTimer = null;
      }

      const clearTimeoutFn =
        (this.win && this.win.clearTimeout) ||
        (typeof clearTimeout !== 'undefined' ? clearTimeout : null);
      if (this._scanTimer && clearTimeoutFn) {
        clearTimeoutFn(this._scanTimer);
        this._scanTimer = null;
      }

      for (let i = 0; i < this.videoCleanup.length; i += 1) {
        this.videoCleanup[i]();
      }
      this.videoCleanup = [];
      this.knownVideos.clear();
    }

    _discoverVideos() {
      if (!this.doc) {
        return [];
      }
      const root = this.doc.documentElement || this.doc.body || this.doc;
      const found = findVideosDeep(root);
      this.knownVideos = new Set(found);
      return found;
    }

    _scheduleScan() {
      if (this._scanTimer) {
        return;
      }
      const setTimeoutFn =
        (this.win && this.win.setTimeout) ||
        (typeof setTimeout !== 'undefined' ? setTimeout : null);
      if (!setTimeoutFn) {
        this.scan();
        return;
      }
      this._scanTimer = setTimeoutFn(() => {
        this._scanTimer = null;
        this.scan();
      }, MUTATION_THROTTLE_MS);
    }

    _handleDocumentMediaEvent(event) {
      if (!event) {
        return;
      }
      const target =
        typeof event.composedPath === 'function' && event.composedPath().length > 0
          ? event.composedPath()[0]
          : event.target;

      if (target && String(target.tagName || '').toUpperCase() === 'VIDEO') {
        this._attachVideo(target);
        this._applySpeedToVideo(target, false);
        this.scan();
      }
    }

    _shouldEnforceVideo(video) {
      return (
        isQualifyingPlayerVideo(video, this.win, this.doc) ||
        (!video.paused && !video.ended)
      );
    }

    _attachVideo(video) {
      if (!video || this.attachedVideos.has(video)) {
        return;
      }
      this.attachedVideos.add(video);

      try {
        if ('preservesPitch' in video) {
          video.preservesPitch = true;
        }
        if ('webkitPreservesPitch' in video) {
          video.webkitPreservesPitch = true;
        }
      } catch {
        // Ignore read-only properties on mocked or restricted elements.
      }

      const enforceEvents = [
        'loadedmetadata',
        'loadeddata',
        'canplay',
        'play',
        'playing',
        'seeked',
        'durationchange',
      ];

      const onEnforce = () => {
        if (this._shouldEnforceVideo(video)) {
          this._applySpeedToVideo(video, false);
        }
        this._updateHasVideo(this._discoverVideos(), false);
      };

      const onRateChange = () => {
        this._handleRateChange(video);
      };

      if (typeof video.addEventListener === 'function') {
        for (let i = 0; i < enforceEvents.length; i += 1) {
          video.addEventListener(enforceEvents[i], onEnforce);
        }
        video.addEventListener('ratechange', onRateChange);

        this.videoCleanup.push(() => {
          for (let i = 0; i < enforceEvents.length; i += 1) {
            video.removeEventListener(enforceEvents[i], onEnforce);
          }
          video.removeEventListener('ratechange', onRateChange);
        });
      }

      if (this._shouldEnforceVideo(video)) {
        this._applySpeedToVideo(video, false);
      }
    }

    _handleRateChange(video) {
      if (!video) {
        return;
      }
      if (Math.abs((video.playbackRate || 1) - this.targetSpeed) <= 0.001) {
        return;
      }
      if (!this._shouldEnforceVideo(video)) {
        return;
      }

      const now = Date.now();
      let guard = this.rateGuards.get(video);
      if (!guard || now - guard.windowStart > RATE_GUARD_WINDOW_MS) {
        guard = { windowStart: now, count: 0 };
      }

      if (guard.count >= RATE_GUARD_MAX_CORRECTIONS) {
        return;
      }

      guard.count += 1;
      this.rateGuards.set(video, guard);
      this._applySpeedToVideo(video, false);
    }

    _applySpeedToVideo(video, force) {
      if (!video) {
        return;
      }
      const target = this.targetSpeed;
      try {
        if ('preservesPitch' in video) {
          video.preservesPitch = true;
        }
        if ('webkitPreservesPitch' in video) {
          video.webkitPreservesPitch = true;
        }
        if (force || Math.abs((video.defaultPlaybackRate || 1) - target) > 0.001) {
          video.defaultPlaybackRate = target;
        }
        if (force || Math.abs((video.playbackRate || 1) - target) > 0.001) {
          video.playbackRate = target;
        }
      } catch {
        // Ignore transient media errors before source load.
      }
    }

    _updateHasVideo(videos, forceNotify) {
      let hasVideo = false;
      for (let i = 0; i < videos.length; i += 1) {
        const video = videos[i];
        const connected = video.isConnected !== false;
        if (connected && isQualifyingPlayerVideo(video, this.win, this.doc)) {
          hasVideo = true;
          break;
        }
      }

      const changed =
        forceNotify ||
        hasVideo !== this._hasVideo ||
        Math.abs(this.targetSpeed - this._lastReportedSpeed) > 0.001;

      this._hasVideo = hasVideo;
      this._lastReportedSpeed = this.targetSpeed;

      if (changed && this.onStateChange) {
        this.onStateChange({
          speed: this.targetSpeed,
          hasVideo: this._hasVideo,
        });
      }
    }
  }

  return {
    findVideosDeep,
    isQualifyingPlayerVideo,
    VideoController,
  };
});
