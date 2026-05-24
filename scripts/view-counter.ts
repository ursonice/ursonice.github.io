// Per-post view counter for the blog — deploy on val.town as an HTTP val.
//
// Setup:
//   1. https://val.town → New → HTTP val, paste this code, save.
//   2. Copy the val's web URL (…web.val.run).
//   3. Put that URL in VIEW_COUNTER_URL at the top of assets/js/post.js.
//
// API:
//   GET ?slug=<slug>          → { slug, count }            (read only)
//   GET ?slug=<slug>&hit=1    → increments, then returns   (count a view)
//
// Storage: a single JSON blob { [slug]: count } via std/blob. CORS open (read-only counter).

import { blob } from "https://esm.town/v/std/blob";

const KEY = "blogViewCounts";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").normalize("NFC").slice(0, 300);
  const hit = url.searchParams.get("hit") === "1";
  if (!slug) {
    return new Response(JSON.stringify({ error: "missing slug" }), { status: 400, headers: CORS });
  }

  const counts: Record<string, number> = (await blob.getJSON(KEY).catch(() => null)) || {};
  if (hit) {
    counts[slug] = (counts[slug] || 0) + 1;
    await blob.setJSON(KEY, counts);
  }

  return new Response(JSON.stringify({ slug, count: counts[slug] || 0 }), { headers: CORS });
}
