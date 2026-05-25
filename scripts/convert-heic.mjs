// Converts HEIC images to JPEG. HEIC (Apple's format) doesn't render in Chrome/Firefox,
// so any .heic the Notion sync downloads is decoded and re-saved as .jpg, and the post HTML
// references in data/notion-posts.json are rewritten to point at the .jpg.
//
// Runs in CI right after sync-notion.mjs (before add-image-dims / the page generators), and
// is safe to run locally. Idempotent: once a .jpg exists the .heic is just dropped/rewritten.
//
// Note: sync-notion.mjs's downloadImage reuses any existing `<blockId>.*` file, so once a
// HEIC has been converted the .jpg sticks and the original is never re-downloaded.
//
// heic-convert (libheif WASM) decodes the HEVC-compressed HEIC; sharp then downscales the
// result to a web-friendly JPEG (≤1600px) so phone-resolution photos don't bloat the repo
// or page load. Image paths are NFD in the JSON but NFC on disk, so paths are normalized.

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import convert from "heic-convert";
import sharp from "sharp";

const MAX_EDGE = 1600; // longest-edge cap for the output JPEG

const FILE = "data/notion-posts.json";
const data = JSON.parse(readFileSync(FILE, "utf8"));

// Collect every distinct .heic <img> src across all post bodies + the About page.
const HEIC_RE = /<img\b[^>]*?\ssrc=["']([^"']+\.heic)["']/gi;
const heicSrcs = new Set();
const scan = (html = "") => {
  HEIC_RE.lastIndex = 0;
  let m;
  while ((m = HEIC_RE.exec(html))) heicSrcs.add(m[1]);
};
for (const p of data.posts || []) scan(p.html);
scan(data.about?.html);

const replacements = new Map(); // heicSrc -> jpgSrc (only for resolved files)
let converted = 0;
let reused = 0;
let failed = 0;

for (const src of heicSrcs) {
  const localHeic = src.replace(/^\.?\//, "").normalize("NFC");
  const localJpg = localHeic.replace(/\.heic$/i, ".jpg");
  const jpgSrc = src.replace(/\.heic$/i, ".jpg");
  try {
    if (existsSync(localJpg)) {
      reused += 1; // already converted on a previous run
    } else if (existsSync(localHeic)) {
      const full = await convert({ buffer: readFileSync(localHeic), format: "JPEG", quality: 0.92 });
      const out = await sharp(Buffer.from(full))
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      writeFileSync(localJpg, out);
      converted += 1;
    } else {
      console.warn(`heic missing on disk: ${localHeic}`);
      failed += 1;
      continue;
    }
    if (existsSync(localHeic)) rmSync(localHeic);
    replacements.set(src, jpgSrc);
  } catch (err) {
    console.warn(`heic convert failed (${localHeic}): ${err instanceof Error ? err.message : err}`);
    failed += 1;
  }
}

if (replacements.size) {
  const rewrite = (html = "") => {
    let out = html;
    for (const [heic, jpg] of replacements) out = out.split(heic).join(jpg);
    return out;
  };
  for (const p of data.posts || []) if (typeof p.html === "string") p.html = rewrite(p.html);
  if (typeof data.about?.html === "string") data.about.html = rewrite(data.about.html);
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
}

console.log(`HEIC→JPG: converted ${converted}, reused ${reused}, failed ${failed} (of ${heicSrcs.size} refs).`);
