(function () {
  'use strict';

  if (globalThis.__hboMaxSpeedPageHookInstalled) {
    return;
  }
  globalThis.__hboMaxSpeedPageHookInstalled = true;

  const COMMAND_EVENT = 'hbomax-speed-command';
  const STATE_EVENT = 'hbomax-speed-hook-state';
  const PLAYER_PATH_RE = /\/(video\/watch|watch|player|feature|episode|play)\b/i;
  const RATE_GUARD_WINDOW_MS = 500;
  const RATE_GUARD_MAX_CORRECTIONS = 6;

  const nativePlaybackRateDesc = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'playbackRate'
  );
  const nativeDefaultRateDesc = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'defaultPlaybackRate'
  );
  const nativeAttachShadow = Element.prototype.attachShadow;
  const nativePlay = HTMLMediaElement.prototype.play;
  const nativeCreateElement = Document.prototype.createElement;

  const shadowRoots = new Set();
  const discoveredVideos = new Set();
  const attachedVideos = new WeakSet();
  const rateGuards = new WeakMap();

  let targetSpeed = 1.0;
  let lastReportedHasVideo = false;
  let lastReportedCount = 0;

  function clampSpeed(value) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return 1.0;
    }
    const clamped = Math.min(4.0, Math.max(0.25, num));
    return Math.round(clamped * 100) / 100;
  }

  function getNativePlaybackRate(video) {
    try {
      if (nativePlaybackRateDesc && typeof nativePlaybackRateDesc.get === 'function') {
        return nativePlaybackRateDesc.get.call(video);
      }
      return video.playbackRate;
    } catch {
      return 1.0;
    }
  }

  function setNativePlaybackRate(video, rate) {
    try {
      if (nativePlaybackRateDesc && typeof nativePlaybackRateDesc.set === 'function') {
        nativePlaybackRateDesc.set.call(video, rate);
      } else {
        video.playbackRate = rate;
      }
    } catch {
      // Ignore transient media errors before source load.
    }
  }

  function setNativeDefaultPlaybackRate(video, rate) {
    try {
      if (nativeDefaultRateDesc && typeof nativeDefaultRateDesc.set === 'function') {
        nativeDefaultRateDesc.set.call(video, rate);
      } else {
        video.defaultPlaybackRate = rate;
      }
    } catch {
      // Ignore transient media errors before source load.
    }
  }

  function getNativeDefaultPlaybackRate(video) {
    try {
      if (nativeDefaultRateDesc && typeof nativeDefaultRateDesc.get === 'function') {
        return nativeDefaultRateDesc.get.call(video);
      }
      return video.defaultPlaybackRate;
    } catch {
      return 1.0;
    }
  }

  function isQualifyingVideo(video) {
    if (!video || video.isConnected === false) {
      return false;
    }

    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (fsEl && (fsEl === video || (typeof fsEl.contains === 'function' && fsEl.contains(video)))) {
      return true;
    }

    const pathname = window.location && typeof window.location.pathname === 'string'
      ? window.location.pathname
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

    if (!video.paused && !video.ended && Boolean(video.currentSrc || video.src)) {
      return true;
    }

    return false;
  }

  function applySpeedToVideo(video, force) {
    if (!video) {
      return;
    }
    try {
      if ('preservesPitch' in video) {
        video.preservesPitch = true;
      }
      if ('webkitPreservesPitch' in video) {
        video.webkitPreservesPitch = true;
      }
    } catch {
      // Ignore read-only properties.
    }

    if (force || Math.abs(getNativeDefaultPlaybackRate(video) - targetSpeed) > 0.001) {
      setNativeDefaultPlaybackRate(video, targetSpeed);
    }
    if (force || Math.abs(getNativePlaybackRate(video) - targetSpeed) > 0.001) {
      setNativePlaybackRate(video, targetSpeed);
    }
  }

  function attachVideo(video) {
    if (!video || attachedVideos.has(video)) {
      return;
    }
    attachedVideos.add(video);

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
      if (isQualifyingVideo(video) || (!video.paused && !video.ended)) {
        applySpeedToVideo(video, false);
      }
      reportState(false);
    };

    const onRateChange = () => {
      if (Math.abs(getNativePlaybackRate(video) - targetSpeed) <= 0.001) {
        return;
      }
      if (!isQualifyingVideo(video) && (video.paused || video.ended)) {
        return;
      }

      const now = Date.now();
      let guard = rateGuards.get(video);
      if (!guard || now - guard.windowStart > RATE_GUARD_WINDOW_MS) {
        guard = { windowStart: now, count: 0 };
      }
      if (guard.count >= RATE_GUARD_MAX_CORRECTIONS) {
        return;
      }
      guard.count += 1;
      rateGuards.set(video, guard);
      applySpeedToVideo(video, false);
    };

    for (let i = 0; i < enforceEvents.length; i += 1) {
      video.addEventListener(enforceEvents[i], onEnforce);
    }
    video.addEventListener('ratechange', onRateChange);

    if (isQualifyingVideo(video) || (!video.paused && !video.ended)) {
      applySpeedToVideo(video, false);
    }
  }

  function collectAllVideos() {
    const found = new Set();

    const scanNode = (root) => {
      if (!root || typeof root.querySelectorAll !== 'function') {
        return;
      }
      const vids = root.querySelectorAll('video');
      for (let i = 0; i < vids.length; i += 1) {
        found.add(vids[i]);
        discoveredVideos.add(vids[i]);
      }
      const all = root.querySelectorAll('*');
      for (let i = 0; i < all.length; i += 1) {
        if (all[i].shadowRoot) {
          shadowRoots.add(all[i].shadowRoot);
          scanNode(all[i].shadowRoot);
        }
      }
    };

    scanNode(document);

    for (const shadowRoot of Array.from(shadowRoots)) {
      if (shadowRoot.host && shadowRoot.host.isConnected === false) {
        shadowRoots.delete(shadowRoot);
        continue;
      }
      scanNode(shadowRoot);
    }

    for (const video of Array.from(discoveredVideos)) {
      if (video.isConnected !== false) {
        found.add(video);
      } else {
        discoveredVideos.delete(video);
      }
    }

    const list = Array.from(found);
    for (let i = 0; i < list.length; i += 1) {
      attachVideo(list[i]);
    }
    return list;
  }

  function reportState(force) {
    const videos = collectAllVideos();
    let hasVideo = false;
    for (let i = 0; i < videos.length; i += 1) {
      if (isQualifyingVideo(videos[i])) {
        hasVideo = true;
        break;
      }
    }

    if (
      !force &&
      hasVideo === lastReportedHasVideo &&
      videos.length === lastReportedCount
    ) {
      return;
    }

    lastReportedHasVideo = hasVideo;
    lastReportedCount = videos.length;

    document.dispatchEvent(
      new CustomEvent(STATE_EVENT, {
        detail: JSON.stringify({
          hasVideo,
          speed: targetSpeed,
          videoCount: videos.length,
        }),
      })
    );
  }

  if (typeof nativeAttachShadow === 'function') {
    Element.prototype.attachShadow = function (init) {
      const shadowRoot = nativeAttachShadow.call(this, init);
      shadowRoots.add(shadowRoot);
      return shadowRoot;
    };
  }

  if (typeof nativePlay === 'function') {
    HTMLMediaElement.prototype.play = function () {
      if (this && String(this.tagName || '').toUpperCase() === 'VIDEO') {
        discoveredVideos.add(this);
        attachVideo(this);
        applySpeedToVideo(this, false);
        reportState(false);
      }
      return nativePlay.apply(this, arguments);
    };
  }

  if (typeof nativeCreateElement === 'function') {
    Document.prototype.createElement = function (tagName) {
      const el = nativeCreateElement.apply(this, arguments);
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'video') {
        discoveredVideos.add(el);
        attachVideo(el);
      }
      return el;
    };
  }

  document.addEventListener(COMMAND_EVENT, (event) => {
    if (!event || typeof event.detail !== 'string') {
      return;
    }
    let payload = null;
    try {
      payload = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (!payload || typeof payload.type !== 'string') {
      return;
    }

    if (payload.type === 'SET_SPEED') {
      targetSpeed = clampSpeed(payload.speed);
      const videos = collectAllVideos();
      for (let i = 0; i < videos.length; i += 1) {
        applySpeedToVideo(videos[i], true);
      }
      reportState(true);
    } else if (payload.type === 'PING') {
      const videos = collectAllVideos();
      for (let i = 0; i < videos.length; i += 1) {
        if (isQualifyingVideo(videos[i]) || (!videos[i].paused && !videos[i].ended)) {
          applySpeedToVideo(videos[i], false);
        }
      }
      reportState(true);
    }
  });

  setInterval(() => {
    const videos = collectAllVideos();
    for (let i = 0; i < videos.length; i += 1) {
      if (isQualifyingVideo(videos[i]) || (!videos[i].paused && !videos[i].ended)) {
        applySpeedToVideo(videos[i], false);
      }
    }
    reportState(false);
  }, 1200);
})();
