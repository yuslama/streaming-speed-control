const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('manifest.json is valid MV3 and all referenced files exist', () => {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
  assert.ok(manifest.action && manifest.action.default_popup);
  assert.ok(manifest.background && manifest.background.service_worker);
  assert.ok(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 2);

  const [mainWorldCs, isolatedCs] = manifest.content_scripts;
  assert.equal(mainWorldCs.world, 'MAIN');
  assert.equal(mainWorldCs.run_at, 'document_start');
  assert.equal(mainWorldCs.all_frames, true);
  assert.ok(mainWorldCs.matches.includes('https://*.hbomax.com/*'));

  assert.ok(isolatedCs.matches.includes('https://*.hbomax.com/*'));
  assert.ok(isolatedCs.matches.includes('https://*.max.com/*'));
  assert.equal(isolatedCs.run_at, 'document_idle');
  assert.equal(isolatedCs.all_frames, true);

  const filesToCheck = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    ...mainWorldCs.js,
    ...isolatedCs.js,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];

  for (const relPath of filesToCheck) {
    const absPath = path.join(ROOT_DIR, relPath);
    assert.equal(fs.existsSync(absPath), true, `Missing referenced file: ${relPath}`);
  }
});

test('all generated PNG icons have valid PNG signatures and exact IHDR dimensions', () => {
  const expectedSizes = [16, 32, 48, 128];

  for (const size of expectedSizes) {
    const iconPath = path.join(ROOT_DIR, 'icons', `icon${size}.png`);
    const buf = fs.readFileSync(iconPath);

    assert.equal(buf.subarray(0, 8).equals(PNG_MAGIC), true, `Invalid PNG magic in icon${size}.png`);
    assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');

    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, size, `Expected width ${size} in icon${size}.png`);
    assert.equal(height, size, `Expected height ${size} in icon${size}.png`);
  }
});
