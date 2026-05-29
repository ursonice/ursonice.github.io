// Prerenders the homepage's post grid + topic grid + stats into index.html so the static
// HTML carries real post links. Without this, the grids are JS-filled by main.js → Google's
// initial crawl sees an empty homepage with no internal links to /posts/<slug>/, which is why
// new posts get discovered slowly (sitemap-only path) and Search Console showed "참조 페이지 없음".
//
// main.js still runs and re-renders the grid when the user searches/filters/loads more — the
// prerendered DOM just gives Google a head start and is replaced seamlessly (same cards).
//
// Runs in CI after sync-notion.mjs. Idempotent — re-running over its own output is fine.

import { readFileSync, writeFileSync } from "node:fs";

const PAGE_SIZE = 12; // matches main.js state.pageSize

const data = JSON.parse(readFileSync("data/notion-posts.json", "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];

const esc = (v = "") =>
  String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fmtDate = (value) => {
  if (!value) return "날짜 없음";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(d);
};

const topicSlug = (s) =>
  (s || "").toString().toLowerCase().normalize("NFC").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "topic";

// Newest-created first (matches main.js sortedByCreated).
const sorted = [...posts].sort((a, b) => new Date(b.created || b.updated) - new Date(a.created || a.updated));

// First 12 cards (mirrors main.js renderPosts).
const postCardsHtml = sorted
  .slice(0, PAGE_SIZE)
  .map((post) => {
    const tags = (post.tags || []).slice(0, 2);
    const href = `/posts/${encodeURIComponent((post.slug || "").normalize("NFC"))}/`;
    return `
        <a class="post-card" href="${href}">
          <div class="post-meta">
            <span class="cat">${esc(post.category || "Notes")}</span>
            ${tags
              .map(
                (tag) =>
                  `<span class="badge" data-tag="${esc(tag)}" role="button" tabindex="0" title="${esc(tag)} 태그로 필터">${esc(tag)}</span>`,
              )
              .join("")}
          </div>
          <h3>${esc(post.title)}</h3>
          <p>${esc(post.summary || "노션에서 가져온 공부 기록입니다.")}</p>
          <div class="post-footer">
            <span>${esc(fmtDate(post.created || post.updated))}</span>
          </div>
        </a>`;
  })
  .join("");

// Topic counts (mirrors main.js uniqueTopics).
const topicCounts = new Map();
posts.forEach((p) => {
  const topic = p.category || "Notes";
  topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
});
const topicsSorted = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]);

const topicCardsHtml = topicsSorted
  .map(
    ([topic, count]) =>
      `<a class="topic-card" href="/topics/${topicSlug(topic)}/"><strong>${esc(topic)}</strong><span>${count} notes</span></a>`,
  )
  .join("");

// Stats.
const latest = sorted[0];
const lastUpdated = latest ? fmtDate(latest.updated || latest.created) : "–";

// Modify index.html in place. Each replace tolerates either the original empty state OR a
// previous prerendered state (so re-runs converge).
const file = "index.html";
let html = readFileSync(file, "utf8");

// Balanced <div>…</div> replacement. Post cards contain nested <div class="post-meta">/
// <div class="post-footer">, so a non-greedy regex would stop at the first inner </div> and
// leave orphan content behind on re-runs (cards multiplied to 23 on the second pass). We
// instead find the opening div, then walk forward counting <div openings vs </div> closings
// until depth returns to zero.
const replaceBalancedDiv = (input, openRegex, replacement) => {
  const match = input.match(openRegex);
  if (!match) return input;
  const start = match.index;
  let i = start + match[0].length;
  let depth = 1;
  while (depth > 0 && i < input.length) {
    const nextOpen = input.indexOf("<div", i);
    const nextClose = input.indexOf("</div>", i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
    }
  }
  return input.slice(0, start) + replacement + input.slice(i);
};

html = replaceBalancedDiv(
  html,
  /<div class="post-grid" data-posts[^>]*>/,
  `<div class="post-grid" data-posts aria-live="polite">${postCardsHtml}
        </div>`,
);

html = replaceBalancedDiv(
  html,
  /<div class="topic-grid" data-topics[^>]*>/,
  `<div class="topic-grid" data-topics>${topicCardsHtml}</div>`,
);

html = html
  .replace(
    /<strong data-stat="post-count">[^<]*<\/strong>/,
    `<strong data-stat="post-count">${posts.length}</strong>`,
  )
  .replace(
    /<strong data-stat="topic-count">[^<]*<\/strong>/,
    `<strong data-stat="topic-count">${topicCounts.size}</strong>`,
  )
  .replace(
    /<strong data-stat="last-updated">[^<]*<\/strong>/,
    `<strong data-stat="last-updated">${esc(lastUpdated)}</strong>`,
  );

writeFileSync(file, html);
console.log(`Prerendered homepage: ${Math.min(PAGE_SIZE, sorted.length)} post cards, ${topicsSorted.length} topics, ${posts.length} total notes.`);
