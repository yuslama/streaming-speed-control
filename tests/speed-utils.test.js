const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_SPEED,
  MAX_SPEED,
  DEFAULT_SPEED,
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
  getServiceForUrl,
  SERVICE_NAMES,
} = require('../src/shared/speed-utils.js');

test('preset constants include user favorites 1.25x, 1.50x, 1.75x, 2.0x', () => {
  assert.deepEqual(FAVORITE_PRESETS, [1.25, 1.5, 1.75, 2.0]);
  assert.deepEqual(QUICK_PRESETS, [1.0, 1.25, 1.5, 1.75, 2.0]);
  assert.deepEqual(ALL_PRESETS, [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]);
});

test('clampSpeed bounds, rounds, and handles invalid inputs', () => {
  assert.equal(clampSpeed(1.5), 1.5);
  assert.equal(clampSpeed('1.75'), 1.75);
  assert.equal(clampSpeed(0.1), MIN_SPEED);
  assert.equal(clampSpeed(10), MAX_SPEED);
  assert.equal(clampSpeed(1.234), 1.23);
  assert.equal(clampSpeed(1.236), 1.24);
  assert.equal(clampSpeed(NaN), DEFAULT_SPEED);
  assert.equal(clampSpeed(Infinity), DEFAULT_SPEED);
  assert.equal(clampSpeed(null), DEFAULT_SPEED);
  assert.equal(clampSpeed(undefined), DEFAULT_SPEED);
  assert.equal(clampSpeed(''), DEFAULT_SPEED);
  assert.equal(clampSpeed(false), DEFAULT_SPEED);
  assert.equal(clampSpeed('not-a-number'), DEFAULT_SPEED);
});

test('formatSpeed formats integers with 1 decimal and non-integers with 2 decimals', () => {
  assert.equal(formatSpeed(1.0), '1.0x');
  assert.equal(formatSpeed(1.25), '1.25x');
  assert.equal(formatSpeed(1.5), '1.50x');
  assert.equal(formatSpeed(1.75), '1.75x');
  assert.equal(formatSpeed(2.0), '2.0x');
  assert.equal(formatSpeed(0.5), '0.50x');
  assert.equal(formatSpeed(0.75), '0.75x');
  assert.equal(formatSpeed(2.5), '2.50x');
  assert.equal(formatSpeed(3.0), '3.0x');
  assert.equal(formatSpeed(4.0), '4.0x');
});

test('formatBadge returns compact badge strings <= 4 chars and empty for 1.0x', () => {
  assert.equal(formatBadge(1.0), '');
  assert.equal(formatBadge(1.0005), '');
  assert.equal(formatBadge(1.5), '1.5x');
  assert.equal(formatBadge(2.0), '2.0x');
  assert.equal(formatBadge(0.5), '0.5x');
  assert.equal(formatBadge(2.5), '2.5x');
  assert.equal(formatBadge(1.25), '1.25');
  assert.equal(formatBadge(1.75), '1.75');
  assert.equal(formatBadge(0.75), '0.75');
  assert.equal(formatBadge(1.33), '1.33');
});

test('stepSpeed steps along ALL_PRESETS and by 0.25 outside [0.5, 3.0]', () => {
  assert.equal(stepSpeed(1.0, 1), 1.25);
  assert.equal(stepSpeed(1.25, 1), 1.5);
  assert.equal(stepSpeed(1.5, 1), 1.75);
  assert.equal(stepSpeed(1.75, 1), 2.0);
  assert.equal(stepSpeed(2.0, 1), 2.5);
  assert.equal(stepSpeed(2.5, 1), 3.0);
  assert.equal(stepSpeed(3.0, 1), 3.25);
  assert.equal(stepSpeed(3.75, 1), 4.0);
  assert.equal(stepSpeed(4.0, 1), 4.0);

  assert.equal(stepSpeed(1.6, 1), 1.75);
  assert.equal(stepSpeed(1.6, -1), 1.5);

  assert.equal(stepSpeed(3.25, -1), 3.0);
  assert.equal(stepSpeed(0.5, -1), 0.25);
  assert.equal(stepSpeed(0.25, -1), 0.25);
  assert.equal(stepSpeed(0.25, 1), 0.5);
});

test('stepSpeed fine mode steps by 0.05 clamped', () => {
  assert.equal(stepSpeed(1.5, 1, true), 1.55);
  assert.equal(stepSpeed(1.5, -1, true), 1.45);
  assert.equal(stepSpeed(0.25, -1, true), 0.25);
  assert.equal(stepSpeed(4.0, 1, true), 4.0);
});

test('toggleSpeed swaps between 1.0x and last non-default speed', () => {
  assert.deepEqual(toggleSpeed(1.75, 1.5), {
    speed: 1.0,
    lastNonDefaultSpeed: 1.75,
  });

  assert.deepEqual(toggleSpeed(1.0, 1.75), {
    speed: 1.75,
    lastNonDefaultSpeed: 1.75,
  });

  assert.deepEqual(toggleSpeed(1.0, 1.0), {
    speed: 1.5,
    lastNonDefaultSpeed: 1.5,
  });
});

test('normalizeSettings merges defaults, clamps numbers, and enforces booleans', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(
    normalizeSettings({
      speed: 99,
      lastNonDefaultSpeed: 0.01,
      rememberSpeed: 'yes',
      showOverlay: false,
      keyboardEnabled: 0,
    }),
    {
      speed: 4.0,
      lastNonDefaultSpeed: 0.25,
      rememberSpeed: true,
      showOverlay: false,
      keyboardEnabled: true,
    }
  );
});

test('isSupportedHost validates HBO Max and Max domains and rejects lookalikes', () => {
  assert.equal(isSupportedHost('https://www.hbomax.com/id/en'), true);
  assert.equal(isSupportedHost('https://play.hbomax.com/video/watch/123'), true);
  assert.equal(isSupportedHost('hbomax.com'), true);
  assert.equal(isSupportedHost('https://www.max.com/'), true);
  assert.equal(isSupportedHost('https://play.max.com/feature/123'), true);
  assert.equal(isSupportedHost('max.com'), true);

  assert.equal(isSupportedHost('https://evilhbomax.com/id/en'), false);
  assert.equal(isSupportedHost('https://hbomax.com.evil.com/'), false);
  assert.equal(isSupportedHost('https://notmax.com/'), false);
  assert.equal(isSupportedHost('chrome://extensions'), false);
  assert.equal(isSupportedHost(''), false);
  assert.equal(isSupportedHost(null), false);
});

test('getServiceForUrl names each supported streaming service', () => {
  const cases = [
    ['https://www.netflix.com/watch/81234567', 'Netflix'],
    ['https://www.hulu.com/watch/abc', 'Hulu'],
    ['https://www.primevideo.com/detail/0ABC', 'Prime Video'],
    ['https://www.amazon.com/gp/video/detail/B0ABC', 'Prime Video'],
    ['https://www.amazon.co.uk/gp/video/storefront', 'Prime Video'],
    ['https://www.disneyplus.com/video/abc', 'Disney+'],
    ['https://www.paramountplus.com/shows/video/abc', 'Paramount+'],
    ['https://www.peacocktv.com/watch/playback/vod/abc', 'Peacock'],
    ['https://play.max.com/video/watch/abc', 'HBO Max'],
  ];
  for (const [url, name] of cases) {
    const service = getServiceForUrl(url);
    assert.ok(service, `expected a service for ${url}`);
    assert.equal(service.name, name);
  }
});

test('Prime Video on Amazon only matches the /gp/video section', () => {
  assert.equal(isSupportedHost('https://www.amazon.com/dp/B0ABC'), false);
  assert.equal(isSupportedHost('https://www.amazon.com/'), false);
  assert.equal(isSupportedHost('amazon.com'), false);
  assert.equal(isSupportedHost('https://www.amazon.com/gp/videogames'), false);
  assert.equal(isSupportedHost('https://www.amazon.com/gp/video'), true);
});

test('isSupportedHost rejects lookalikes of the new services', () => {
  assert.equal(isSupportedHost('https://evilnetflix.com/watch/1'), false);
  assert.equal(isSupportedHost('https://netflix.com.evil.io/'), false);
  assert.equal(isSupportedHost('https://disneyplus.com.example.org/'), false);
  assert.equal(isSupportedHost('https://mypeacocktv.com/'), false);
  assert.equal(isSupportedHost('https://amazon.com.evil.io/gp/video/x'), false);
});

test('SERVICE_NAMES lists each service once', () => {
  assert.deepEqual(SERVICE_NAMES, ['HBO Max', 'Netflix', 'Hulu', 'Prime Video', 'Disney+', 'Paramount+', 'Peacock']);
});
