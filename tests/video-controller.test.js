const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findVideosDeep,
  isQualifyingPlayerVideo,
  VideoController,
} = require('../src/content/video-controller.js');

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn, capture = false) {
      const key = `${type}:${Boolean(capture)}`;
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(fn);
    },
    removeEventListener(type, fn, capture = false) {
      const key = `${type}:${Boolean(capture)}`;
      if (listeners.has(key)) {
        listeners.get(key).delete(fn);
      }
    },
    dispatchEvent(event) {
      const type = event.type;
      for (const capture of [true, false]) {
        const key = `${type}:${capture}`;
        const set = listeners.get(key);
        if (set) {
          for (const fn of [...set]) {
            fn(event);
          }
        }
      }
    },
  };
}

function createMockElement(tagName = 'DIV', options = {}) {
  const target = createEventTarget();
  const children = [];
  const el = {
    tagName: tagName.toUpperCase(),
    isConnected: options.isConnected !== false,
    shadowRoot: options.shadowRoot || null,
    children,
    parentNode: null,
    host: options.host || null,
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === el) return true;
        cur = cur.parentNode || cur.host || null;
      }
      return false;
    },
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    querySelectorAll(selector) {
      const results = [];
      function walk(node) {
        for (const child of node.children || []) {
          if (selector === '*' || child.tagName === selector.toUpperCase()) {
            results.push(child);
          }
          walk(child);
        }
      }
      walk(el);
      return results;
    },
    ...target,
  };
  return el;
}

function createMockVideo(overrides = {}) {
  const base = createMockElement('VIDEO', overrides);
  return Object.assign(base, {
    playbackRate: 1.0,
    defaultPlaybackRate: 1.0,
    preservesPitch: false,
    webkitPreservesPitch: false,
    paused: false,
    ended: false,
    muted: false,
    readyState: 4,
    duration: 3600,
    getBoundingClientRect() {
      return overrides.rect || { width: 1280, height: 720 };
    },
    ...overrides,
  });
}

function createMockDocument(pathname = '/id/en') {
  const docTarget = createEventTarget();
  const rootEl = createMockElement('HTML');
  const bodyEl = createMockElement('BODY');
  rootEl.appendChild(bodyEl);

  const doc = {
    documentElement: rootEl,
    body: bodyEl,
    fullscreenElement: null,
    webkitFullscreenElement: null,
    querySelectorAll: (sel) => rootEl.querySelectorAll(sel),
    ...docTarget,
  };

  let observerCallback = null;
  class MockMutationObserver {
    constructor(cb) {
      observerCallback = cb;
    }
    observe() {}
    disconnect() {
      observerCallback = null;
    }
  }

  const win = {
    location: { pathname },
    MutationObserver: MockMutationObserver,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout: () => {},
  };

  return {
    doc,
    win,
    bodyEl,
    triggerMutation() {
      if (observerCallback) {
        observerCallback([]);
      }
    },
  };
}

test('findVideosDeep discovers videos across nested Shadow DOM roots', () => {
  const { bodyEl } = createMockDocument();
  const topVideo = createMockVideo();
  bodyEl.appendChild(topVideo);

  const shadowHost1 = createMockElement('HBO-PLAYER');
  const shadowRoot1 = createMockElement('#SHADOW', { host: shadowHost1 });
  shadowHost1.shadowRoot = shadowRoot1;

  const shadowHost2 = createMockElement('INNER-PLAYER');
  const shadowRoot2 = createMockElement('#SHADOW', { host: shadowHost2 });
  shadowHost2.shadowRoot = shadowRoot2;

  const nestedVideo = createMockVideo();
  shadowRoot2.appendChild(nestedVideo);
  shadowRoot1.appendChild(shadowHost2);
  bodyEl.appendChild(shadowHost1);

  const found = findVideosDeep(bodyEl);
  assert.equal(found.length, 2);
  assert.equal(found[0], topVideo);
  assert.equal(found[1], nestedVideo);
});

test('isQualifyingPlayerVideo accepts player paths, large rects, fullscreen, unmuted media, and long durations', () => {
  const { doc, win } = createMockDocument('/id/en');

  const tinyMutedPreview = createMockVideo({
    muted: true,
    readyState: 0,
    duration: 10,
    rect: { width: 120, height: 68 },
  });
  assert.equal(isQualifyingPlayerVideo(tinyMutedPreview, win, doc), false);

  const largePlayer = createMockVideo({
    muted: true,
    readyState: 0,
    duration: 10,
    rect: { width: 640, height: 360 },
  });
  assert.equal(isQualifyingPlayerVideo(largePlayer, win, doc), true);

  doc.fullscreenElement = tinyMutedPreview;
  assert.equal(isQualifyingPlayerVideo(tinyMutedPreview, win, doc), true);
  doc.fullscreenElement = null;

  const watchWin = { location: { pathname: '/video/watch/urn:hbo:episode:123' } };
  assert.equal(isQualifyingPlayerVideo(tinyMutedPreview, watchWin, doc), true);
});

test('VideoController applies playbackRate, preservesPitch, and defends against external ratechange resets', () => {
  const { doc, win, bodyEl } = createMockDocument('/video/watch/123');
  const video = createMockVideo();
  bodyEl.appendChild(video);

  const stateChanges = [];
  const controller = new VideoController({
    document: doc,
    window: win,
    initialSpeed: 1.5,
    onStateChange: (state) => stateChanges.push(state),
  });

  controller.start();

  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.defaultPlaybackRate, 1.5);
  assert.equal(video.preservesPitch, true);
  assert.equal(video.webkitPreservesPitch, true);
  assert.equal(controller.hasQualifyingVideo(), true);
  assert.deepEqual(stateChanges[stateChanges.length - 1], { speed: 1.5, hasVideo: true });

  // Simulate player resetting rate back to 1.0
  video.playbackRate = 1.0;
  video.dispatchEvent({ type: 'ratechange', target: video });
  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.defaultPlaybackRate, 1.5);

  controller.setSpeed(1.75);
  assert.equal(video.playbackRate, 1.75);
  assert.deepEqual(stateChanges[stateChanges.length - 1], { speed: 1.75, hasVideo: true });

  controller.stop();
});

test('VideoController rate-guard caps corrections within 500ms to prevent infinite loops', () => {
  const { doc, win, bodyEl } = createMockDocument('/video/watch/123');
  const video = createMockVideo();
  bodyEl.appendChild(video);

  const controller = new VideoController({
    document: doc,
    window: win,
    initialSpeed: 2.0,
  });
  controller.start();

  // Trigger 8 external resets immediately; first 6 should be corrected, 7th & 8th ignored
  for (let i = 0; i < 6; i += 1) {
    video.playbackRate = 1.0;
    video.dispatchEvent({ type: 'ratechange', target: video });
    assert.equal(video.playbackRate, 2.0);
  }

  video.playbackRate = 1.0;
  video.dispatchEvent({ type: 'ratechange', target: video });
  assert.equal(video.playbackRate, 1.0);

  controller.stop();
});

test('VideoController handles SPA video replacement and Shadow DOM play events', () => {
  const { doc, win, bodyEl, triggerMutation } = createMockDocument('/id/en');
  const controller = new VideoController({
    document: doc,
    window: win,
    initialSpeed: 1.25,
  });
  controller.start();
  assert.equal(controller.hasQualifyingVideo(), false);

  const shadowHost = createMockElement('MAX-PLAYER');
  const shadowRoot = createMockElement('#SHADOW', { host: shadowHost });
  shadowHost.shadowRoot = shadowRoot;
  const video2 = createMockVideo();
  shadowRoot.appendChild(video2);
  bodyEl.appendChild(shadowHost);

  triggerMutation();
  assert.equal(controller.hasQualifyingVideo(), true);
  assert.equal(video2.playbackRate, 1.25);

  // Also verify capture-phase media event via composedPath()
  const shadowVideo3 = createMockVideo();
  shadowRoot.appendChild(shadowVideo3);
  doc.dispatchEvent({
    type: 'play',
    target: shadowHost,
    composedPath: () => [shadowVideo3, shadowRoot, shadowHost, bodyEl, doc.documentElement, doc],
  });
  assert.equal(shadowVideo3.playbackRate, 1.25);

  controller.stop();
});
