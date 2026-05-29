// Notifies IndexNow-supporting search engines (Bing, Naver, Yandex, Seznam) about posts
// that were updated in the last week, so they pick up new/changed content fast.
// Google does NOT support IndexNow — for Google, the sitemap + Search Console covers it.
//
// Runs in CI after sync-notion.mjs. Non-fatal: failures are logged but don't break the
// sync pipeline. Idempotent: re-sending the same URLs is harmless (IndexNow dedupes).
//
// Protocol: https://www.indexnow.org/documentation
// Key file is hosted at the site root (referenced by `keyLocation` below).

import { readFileSync } from "node:fs";

const SITE = "https://ursonice.github.io";
const HOST = "ursonice.github.io";
const KEY = "152cb4d732d4f0d98c37d07ac337d28c";
const RECENT_DAYS = 7;
const ENDPOINT = "https://api.indexnow.org/indexnow";

const data = JSON.parse(readFileSync("data/notion-posts.json", "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];

const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
const recent = posts.filter((p) => {
  const t = new Date(p.updated || p.created).getTime();
  return Number.isFinite(t) && t >= cutoff;
});

if (recent.length === 0) {
  console.log(`IndexNow: no posts updated in the last ${RECENT_DAYS} days → nothing to notify.`);
  process.exit(0);
}

const urlList = recent.map((p) => `${SITE}/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`);

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList,
};

try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  console.log(`IndexNow: POST ${urlList.length} URLs → HTTP ${res.status}`);
  // 200 = accepted, 202 = accepted-processing. Other codes are notable but non-fatal.
  if (res.status !== 200 && res.status !== 202) {
    const text = await res.text().catch(() => "");
    console.warn(`IndexNow non-OK response body: ${text.slice(0, 400)}`);
  }
} catch (err) {
  console.warn(`IndexNow notify failed: ${err instanceof Error ? err.message : err}`);
  // Non-fatal — don't break the sync pipeline.
}
