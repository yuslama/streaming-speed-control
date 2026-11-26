// Stand-in for the chrome.* extension APIs so the real popup renders in a normal page.
// Query params: state=active|ready|none, speed=<number>.
(function () {
  const params = new URLSearchParams(location.search);
  const state = params.get('state') || 'active';
  const speed = Number(params.get('speed') || 1.5);
  const settings = {
    speed,
    lastNonDefaultSpeed: 1.5,
    rememberSpeed: true,
    showOverlay: true,
    keyboardEnabled: true,
  };
  const tab = {
    id: 7,
    url: state === 'none' ? 'https://example.com/' : 'https://play.hbomax.com/video/watch/demo',
    active: true,
  };
  window.chrome = {
    storage: {
      local: { get: async () => ({ hboMaxSpeedSettings: settings }), set: async () => {} },
      sync: { get: async () => ({}), set: async () => {} },
    },
    runtime: {
      sendMessage: async (m) =>
        m.type === 'GET_TRACKED_TABS' ? { tabs: state === 'none' ? [] : [{ tabId: 7 }] } : null,
    },
    tabs: {
      query: async () => [tab],
      sendMessage: async (id, m) =>
        state === 'none'
          ? null
          : { hasVideo: state === 'active', speed: m.speed || speed, settings: { ...settings, speed: m.speed || speed } },
    },
    scripting: { executeScript: async () => { throw new Error('stub'); } },
  };
})();
