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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sampleGradient(u, v) {
  const t = clamp01((u + v) * 0.5);
  const c0 = [0x13, 0x11, 0x26]; // #131126
  const c1 = [0x4c, 0x1d, 0x95]; // #4C1D95
  const c2 = [0x7c, 0x3a, 0xed]; // #7C3AED

  if (t <= 0.52) {
    const k = t / 0.52;
    return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
  }
  const k = (t - 0.52) / 0.48;
  return [lerp(c1[0], c2[0], k), lerp(c1[1], c2[1], k), lerp(c1[2], c2[2], k)];
}

function roundedBoxSdf(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const qx = Math.max(dx, 0);
  const qy = Math.max(dy, 0);
  return Math.hypot(qx, qy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (denom === 0) return false;
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function pointInChevron(px, py, leftX, tipX, centerY, halfHeight) {
  return pointInTriangle(
    px,
    py,
    leftX,
    centerY - halfHeight,
    tipX,
    centerY,
    leftX,
    centerY + halfHeight,
  );
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = size <= 32 ? 6 : 4;
  const invSamples = 1 / (samples * samples);

  const margin = 0.03125; // ~4/128 normalized padding
  const halfExtent = 0.5 - margin;
  const radius = 0.21875; // ~28/128
  const strokeWidth = 0.016;

  // Dual >> fast-forward geometry (normalized 0..1 space)
  const tri1Left = 0.242;
  const tri1Tip = 0.492;
  const tri2Left = 0.512;
  const tri2Tip = 0.762;
  const halfHeight = 0.205;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let rAcc = 0;
      let gAcc = 0;
      let bAcc = 0;
      let hitCount = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;

          const dist = roundedBoxSdf(u, v, 0.5, 0.5, halfExtent, halfExtent, radius);
          if (dist > 0) {
            continue;
          }

          let [r, g, b] = sampleGradient(u, v);

          // Subtle inner rim highlight
          if (dist > -strokeWidth) {
            const rimAlpha = 0.18 * (1 - clamp01((u + v) * 0.3));
            r = lerp(r, 255, rimAlpha);
            g = lerp(g, 255, rimAlpha);
            b = lerp(b, 255, rimAlpha);
          }

          // White dual fast-forward symbol (>>)
          const inSymbol =
            pointInChevron(u, v, tri1Left, tri1Tip, 0.5, halfHeight) ||
            pointInChevron(u, v, tri2Left, tri2Tip, 0.5, halfHeight);

          if (inSymbol) {
            r = 255;
            g = 255;
            b = 255;
          }

          rAcc += r;
          gAcc += g;
          bAcc += b;
          hitCount += 1;
        }
      }

      const idx = (y * size + x) * 4;
      if (hitCount === 0) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      } else {
        rgba[idx] = Math.round(rAcc / hitCount);
        rgba[idx + 1] = Math.round(gAcc / hitCount);
        rgba[idx + 2] = Math.round(bAcc / hitCount);
        rgba[idx + 3] = Math.round(hitCount * invSamples * 255);
      }
    }
  }

  return encodePngRgba(size, size, rgba);
}

fs.mkdirSync(ICONS_DIR, { recursive: true });
for (const size of SIZES) {
  const png = renderIcon(size);
  const outPath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}
