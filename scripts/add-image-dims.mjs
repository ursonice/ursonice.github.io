// Adds width/height to every <img> in the synced post HTML so the browser can reserve
// space before images load — eliminating layout shift (CLS) as a post renders.
//
// Pure Node, no deps. Reads intrinsic dimensions straight from the file headers
// (PNG / JPEG / GIF / WebP) of the locally-downloaded images under assets/notion/.
// Runs in CI right after sync-notion.mjs (before the page generators), and is safe to
// run locally too. Idempotent: <img> tags that already carry a width are left alone.
//
// Image paths in data/notion-posts.json are stored NFD, but the committed files are NFC,
// so paths are normalized before reading.

import { readFileSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";

// Read just the header bytes (enough for any of the formats below) without loading huge files.
const readHead = (path, bytes = 65536) => {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
};

const imageSize = (buf) => {
  // PNG: IHDR width/height are big-endian uint32 at offset 16/20.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: little-endian uint16 width/height at offset 6/8.
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG: scan segment markers for a Start-Of-Frame (SOFn).
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off += 1;
        continue;
      }
      const marker = buf[off + 1];
      // SOF0..SOF15, excluding DHT(C4), JPG(C8), DAC(CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2); // skip this segment
    }
  }
  // WebP (RIFF....WEBP).
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (fmt === "VP8L") {
      const b1 = buf[22], b2 = buf[23], b3 = buf[24], b4 = buf[25];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
    if (fmt === "VP8X") {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
  }
  return null;
};

const dimsCache = new Map();
const readDims = (src) => {
  // Only handle locally-downloaded images; leave external/remote URLs alone.
  if (!/^\.?\/?assets\//.test(src)) return null;
  const path = src.replace(/^\.?\//, "").normalize("NFC");
  if (dimsCache.has(path)) return dimsCache.get(path);
  let dims = null;
  try {
    dims = imageSize(readHead(path));
  } catch {
    dims = null;
  }
  dimsCache.set(path, dims);
  return dims;
};

const IMG_RE = /<img\b[^>]*>/gi;
const SRC_RE = /\ssrc=["']([^"']+)["']/i;

const annotate = (html = "") =>
  html.replace(IMG_RE, (tag) => {
    if (/\swidth=/i.test(tag)) return tag; // already annotated
    const m = tag.match(SRC_RE);
    if (!m) return tag;
    const dims = readDims(m[1]);
    if (!dims || !dims.width || !dims.height) return tag;
    return tag.replace(/\s*\/?>$/, ` width="${dims.width}" height="${dims.height}" />`);
  });

const file = "data/notion-posts.json";
const data = JSON.parse(readFileSync(file, "utf8"));
let annotated = 0;
let scanned = 0;
for (const post of data.posts || []) {
  if (typeof post.html !== "string" || !post.html.includes("<img")) continue;
  const before = (post.html.match(/<img\b[^>]*\swidth=/gi) || []).length;
  post.html = annotate(post.html);
  const after = (post.html.match(/<img\b[^>]*\swidth=/gi) || []).length;
  annotated += after - before;
  scanned += (post.html.match(/<img\b/gi) || []).length;
}
if (typeof data.about?.html === "string") data.about.html = annotate(data.about.html);

writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`Image dims: annotated ${annotated} <img> tags (of ${scanned} scanned).`);
