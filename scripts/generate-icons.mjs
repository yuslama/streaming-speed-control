import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '..', 'icons');
const SIZES = [16, 32, 48, 128];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBytes = Buffer.alloc(4);
  lenBytes.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBytes, typeBytes, data, crcBytes]);
}

function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Icon: double-arrow fast-forward, white on a blue rounded tile framed like a film strip.
// Geometry is authored on a 256-unit canvas, matching icons/icon.svg.
const TILE_COLOR = [0x25, 0x63, 0xeb]; // #2563EB
const MARK_COLOR = [0xff, 0xff, 0xff];
const BAND_COLOR = [0x1d, 0x4e, 0xd8]; // #1D4ED8 film-strip edges
const HOLE_COLOR = [0x3b, 0x7b, 0xf0]; // #3B7BF0 perforations
const BAND_HEIGHT = 44; // top band ends at y=44, bottom band starts at y=212
const HOLE_XS = [34, 74, 114, 154, 194];
const HOLE_YS = [22, 220];
const HOLE_W = 20;
const HOLE_H = 14;
const HOLE_RADIUS = 3;
const HOLES_MIN_SIZE = 32; // perforations turn to noise below this, so 16px keeps only the bands
const TILE_INSET = 8; // 256-unit inset (4/128)
const TILE_RADIUS = 56;
const CORNER_ROUND = 5; // rounds the arrow corners (stroke-linejoin: round)

// Two arrows meeting at the centre line, shifted right of centre for optical balance.
const MARK = [
  [[68, 76], [130, 128], [68, 180]],
  [[134, 76], [196, 128], [134, 180]],
];

function roundedBoxSdf(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const qx = Math.max(dx, 0);
  const qy = Math.max(dy, 0);
  return Math.hypot(qx, qy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

function inMark(px, py, mark, round) {
  return mark.some((poly) => {
    if (pointInPolygon(px, py, poly)) return true;
    for (let i = 0; i < poly.length; i += 1) {
      if (distToSegment(px, py, poly[i], poly[(i + 1) % poly.length]) <= round) return true;
    }
    return false;
  });
}

function inHole(px, py) {
  return HOLE_YS.some((hy) =>
    HOLE_XS.some(
      (hx) =>
        roundedBoxSdf(px, py, hx + HOLE_W / 2, hy + HOLE_H / 2, HOLE_W / 2, HOLE_H / 2, HOLE_RADIUS) <= 0,
    ),
  );
}

function tileColor(px, py, drawHoles) {
  if (py >= BAND_HEIGHT && py <= 256 - BAND_HEIGHT) return TILE_COLOR;
  return drawHoles && inHole(px, py) ? HOLE_COLOR : BAND_COLOR;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = size <= 32 ? 8 : 4;
  const invSamples = 1 / (samples * samples);
  const mark = MARK;
  const drawHoles = size >= HOLES_MIN_SIZE;
  const half = 128 - TILE_INSET;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let rAcc = 0;
      let gAcc = 0;
      let bAcc = 0;
      let hitCount = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = ((x + (sx + 0.5) / samples) / size) * 256;
          const v = ((y + (sy + 0.5) / samples) / size) * 256;

          if (roundedBoxSdf(u, v, 128, 128, half, half, TILE_RADIUS) > 0) {
            continue;
          }

          const [r, g, b] = inMark(u, v, mark, CORNER_ROUND) ? MARK_COLOR : tileColor(u, v, drawHoles);
          rAcc += r;
          gAcc += g;
          bAcc += b;
          hitCount += 1;
        }
      }

      const idx = (y * size + x) * 4;
      if (hitCount > 0) {
        rgba[idx] = Math.round(rAcc / hitCount);
        rgba[idx + 1] = Math.round(gAcc / hitCount);
        rgba[idx + 2] = Math.round(bAcc / hitCount);
        rgba[idx + 3] = Math.round(hitCount * invSamples * 255);
      }
    }
  }

  return encodePngRgba(size, size, rgba);
}

function toSvg(mark) {
  const d = mark
    .map((poly) => `M${poly.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}Z`)
    .join(' ');
  const size = 256 - TILE_INSET * 2;
  const holes = HOLE_YS.flatMap((y) =>
    HOLE_XS.map((x) => `<rect x="${x}" y="${y}" width="${HOLE_W}" height="${HOLE_H}" rx="${HOLE_RADIUS}"/>`),
  ).join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">',
    `  <defs><clipPath id="tile"><rect x="${TILE_INSET}" y="${TILE_INSET}" width="${size}" height="${size}" rx="${TILE_RADIUS}"/></clipPath></defs>`,
    `  <rect x="${TILE_INSET}" y="${TILE_INSET}" width="${size}" height="${size}" rx="${TILE_RADIUS}" fill="#2563EB"/>`,
    `  <g clip-path="url(#tile)" fill="#1D4ED8"><rect x="0" y="0" width="256" height="${BAND_HEIGHT}"/><rect x="0" y="${256 - BAND_HEIGHT}" width="256" height="${BAND_HEIGHT}"/></g>`,
    `  <g fill="#3B7BF0">${holes}</g>`,
    `  <path d="${d}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="${CORNER_ROUND * 2}" stroke-linejoin="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}

fs.mkdirSync(ICONS_DIR, { recursive: true });
for (const size of SIZES) {
  const png = renderIcon(size);
  const outPath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), toSvg(MARK));
console.log('Generated icons/icon.svg');
