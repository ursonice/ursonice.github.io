// Derived outputs from data/notion-posts.json:
//   - feed.xml               RSS feed (30 newest posts)
//   - sitemap.xml            all pages, NFC post URLs
//   - data/posts-index.json  lightweight post list for the frontend
//
// The index is what the homepage / archive / CV / palette / post-hydration fetch
// instead of the full 2.4MB notion-posts.json: list fields + a capped plain-text
// excerpt for search, plus site/about/profile. Only the /post.html?slug= SPA
// fallback still needs the full JSON (for the post body).
//
// Runs in CI after sync-notion.mjs; safe (and useful) to run locally — it only
// reads the JSON. Output is deterministic for unchanged input, so no-change
// syncs produce no git diff (feed's lastBuildDate derives from post dates, not
// the wall clock).

import { readFileSync, writeFileSync } from "node:fs";
import { SITE, xmlEsc, topicSlug, postUrl, assertPosts } from "./lib/shared.mjs";

const data = JSON.parse(readFileSync("data/notion-posts.json", "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];
assertPosts(posts, "gen-derived");

// --- RSS feed ---
const newest = posts.reduce((max, p) => {
  const t = new Date(p.updated || p.created).getTime();
  return Number.isFinite(t) && t > max ? t : max;
}, 0);

const items = posts
  .slice(0, 30)
  .map(
    (p) =>
      `    <item>\n      <title>${xmlEsc(p.title)}</title>\n      <link>${xmlEsc(postUrl(p))}</link>\n      <guid isPermaLink="false">${p.id}</guid>\n      <pubDate>${new Date(p.created || p.updated).toUTCString()}</pubDate>\n      <category>${xmlEsc(p.category || "Notes")}</category>\n      <description>${xmlEsc(p.summary || "")}</description>\n    </item>`,
  )
  .join("\n");
const site = data.site || { title: "Woojae Joo — Developer Note", description: "" };
const feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${xmlEsc(site.title)}</title>\n    <link>${SITE}/</link>\n    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n    <description>${xmlEsc(site.description)}</description>\n    <language>ko</language>\n    <lastBuildDate>${new Date(newest || Date.now()).toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`;
writeFileSync("feed.xml", feed);

// --- Sitemap ---
const topicSlugs = [...new Set(posts.map((p) => topicSlug(p.category || "Notes")))];
const urlEntries = [
  `  <url><loc>${SITE}/</loc></url>`,
  `  <url><loc>${SITE}/cv.html</loc></url>`,
  `  <url><loc>${SITE}/archive.html</loc></url>`,
  ...topicSlugs.map((s) => `  <url><loc>${SITE}/topics/${s}/</loc></url>`),
  ...posts.map(
    (p) =>
      `  <url><loc>${xmlEsc(postUrl(p))}</loc><lastmod>${new Date(p.updated || p.created).toISOString().slice(0, 10)}</lastmod></url>`,
  ),
].join("\n");
writeFileSync(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`,
);

// --- Lightweight posts index ---
const EXCERPT_CHARS = 1500; // enough for meaningful body search without shipping full posts

const decodeEntities = (s) =>
  s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const excerpt = (html = "") =>
  decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EXCERPT_CHARS);

const index = {
  site,
  about: data.about || null,
  profile: data.profile || null,
  posts: posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    tags: p.tags || [],
    created: p.created,
    updated: p.updated,
    readingTime: p.readingTime,
    summary: p.summary,
    plain: excerpt(p.html),
    ...(p.series ? { series: p.series, seriesOrder: p.seriesOrder ?? null } : {}),
  })),
};
writeFileSync("data/posts-index.json", `${JSON.stringify(index)}\n`);

console.log(
  `Derived: feed.xml (${Math.min(30, posts.length)} items), sitemap.xml (${posts.length + 3 + topicSlugs.length} urls), data/posts-index.json (${index.posts.length} posts)`,
);
