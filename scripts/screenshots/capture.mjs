// Captures the README screenshots into docs/images/ using headless Chrome.
// Usage: npm run screenshots   (set CHROME=/path/to/chrome to override the browser)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'docs', 'images');
const CHROME =
  process.env.CHROME ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => fs.existsSync(p));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

// [file, page, width, height, color scheme]
const SHOTS = [
  ['hero.png', 'hero.html', 1280, 640, 'dark'],
  ['services.png', 'services.html', 960, 112, 'dark'],
  ['popup-dark.png', 'popup.html?state=active&speed=1.5&url=https://www.netflix.com/watch/demo', 320, 434, 'dark'],
  ['popup-light.png', 'popup.html?state=active&speed=1.75&url=https://www.disneyplus.com/video/demo', 320, 434, 'light'],
  ['overlay-menu.png', 'overlay.html?open&speed=1.5', 960, 540, 'dark'],
  ['overlay-toast.png', 'overlay.html?toast&speed=1.75', 960, 540, 'dark'],
];

if (!CHROME) {
  console.error('Chrome not found. Set CHROME=/path/to/chrome.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// Chrome must run asynchronously: a blocking spawn would stall this server.
function capture(args) {
  return new Promise((resolve) => {
    const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, page, w, h, scheme] of SHOTS) {
    const out = path.join(OUT, name);
    const { code, stderr } = await capture([
      '--headless=new',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--blink-settings=preferredColorScheme=${scheme === 'dark' ? 0 : 1}`,
      `--window-size=${w},${h}`,
      '--virtual-time-budget=4000',
      `--user-data-dir=${path.join(OUT, '.chrome-profile')}`,
      `--screenshot=${out}`,
      `http://127.0.0.1:${port}/scripts/screenshots/${page}`,
    ]);
    console.log(code === 0 && fs.existsSync(out) ? `wrote docs/images/${name}` : `failed ${name}: ${stderr.slice(0, 300)}`);
  }
  fs.rmSync(path.join(OUT, '.chrome-profile'), { recursive: true, force: true });
  server.close();
});
