// Generates one static HTML page per post at posts/<slug>/index.html.
//
// Why: post.html is a single SPA that reads ?slug= and renders client-side, so every
// post shares the same static <head>. Link-preview scrapers (KakaoTalk, Slack, Facebook)
// don't run JS, so they only ever see that generic preview. These per-post static pages
// carry the correct per-post OG/Twitter tags in the static head, while post.js still
// renders the body (it reads the slug from <meta name="post-slug">).
//
// Run after the Notion sync (reads data/notion-posts.json). Safe to run locally too.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const SITE = "https://ursonice.github.io";
const DEFAULT_IMG = `${SITE}/assets/og/default.png`;

// OG share-card image service (val.town, see scripts/og-image.ts) — generated title cards
// for link previews. Override with the OG_IMAGE_URL env var; empty → fall back to the
// post's first image / default.png.
const OG_IMAGE_URL =
  process.env.OG_IMAGE_URL || "https://ursonice--8ca24676580f11f18cd8ee650bb23af1.web.val.run/";
const ogCard = (post) => {
  const sep = OG_IMAGE_URL.includes("?") ? "&" : "?";
  const title = encodeURIComponent((post.title || "Woojae Joo").slice(0, 120));
  const cat = encodeURIComponent(post.category || "Notes");
  return `${OG_IMAGE_URL}${sep}title=${title}&cat=${cat}`;
};

const data = JSON.parse(readFileSync("data/notion-posts.json", "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// First <img> in the body as an absolute URL → used as the OG/Twitter thumbnail.
// encodeURI keeps the path scraper-safe (Korean notion folders → %xx) without double-encoding.
const firstImage = (html = "") => {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return DEFAULT_IMG;
  const src = m[1];
  const abs = /^https?:/i.test(src) ? src : src.startsWith("/") ? SITE + src : `${SITE}/${src.replace(/^\.?\//, "")}`;
  // notion-posts.json stores image paths in NFD, but the committed files are NFC → normalize.
  return encodeURI(abs.normalize("NFC"));
};

// Topic → URL slug. MUST match scripts/gen-tag-pages.mjs / main.js / post.js.
const topicSlug = (s) =>
  (s || "").toString().toLowerCase().normalize("NFC").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "topic";

const fmtDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
};

// Prerendered article HTML — mirrors post.js renderPost so Google sees the full body in the
// STATIC /posts/<slug>/index.html instead of an empty JS-filled shell. (Without this, the page
// looks thin to crawlers, the homepage card outranks the post for the post's own queries, and
// "참조 페이지 없음" because the homepage's post-card links are also JS-rendered.)
const articleHtml = (post) => {
  const title = esc(post.title || "Woojae Joo");
  const cat = post.category || "Notes";
  const tagsHtml = (post.tags || [])
    .map((t) => `<a class="meta-tag" href="/index.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`)
    .join("");
  const tagDot = (post.tags || []).length ? '<span class="dot"></span>' : "";
  const created = fmtDate(post.created);
  const updated = fmtDate(post.updated);
  const dateMeta =
    created && updated && created !== updated
      ? `<span>작성 ${esc(created)}</span><span class="dot"></span><span>수정 ${esc(updated)}</span>`
      : `<span>작성 ${esc(created || updated)}</span>`;
  const bodyHtml = (post.html || "")
    .normalize("NFC")
    .replace(/(src|href)="assets\//g, '$1="/assets/')
    .replace(/(src|href)="\.\//g, '$1="/');
  const body = post.html
    ? `<div class="article-content">${bodyHtml}</div>`
    : `<div class="article-content"><p>${esc(post.summary || "아직 본문이 동기화되지 않은 글입니다. 노션에서 내용을 채우면 여기에 표시됩니다.")}</p></div>`;
  return `
    <nav class="breadcrumb" aria-label="breadcrumb">
      <a href="/">홈</a>
      <span class="bc-sep" aria-hidden="true">›</span>
      <a href="/topics/${topicSlug(cat)}/">${esc(cat)}</a>
    </nav>
    <h1>${title}</h1>
    <div class="article-meta">
      ${tagsHtml}
      ${tagDot}
      ${dateMeta}
      <span class="reading-size" role="group" aria-label="글자 크기">
        <button type="button" data-reading-size="sm" aria-label="작게" title="작게">가</button>
        <button type="button" data-reading-size="md" aria-label="보통" title="보통">가</button>
        <button type="button" data-reading-size="lg" aria-label="크게" title="크게">가</button>
      </span>
    </div>
    <hr class="article-divider" />
    ${body}
    <div class="share-bar" data-share>
      <span class="share-label">Share</span>
      <button type="button" class="share-btn" data-share-copy>Copy</button>
      <a class="share-btn share-x" data-share-x target="_blank" rel="noopener">X</a>
      <a class="share-btn share-li" data-share-li target="_blank" rel="noopener">LinkedIn</a>
      <button type="button" class="share-btn share-kakao" data-share-kakao hidden>카카오톡</button>
      <button type="button" class="share-btn share-cite" data-share-cite>Cite</button>
    </div>`;
};

// Reuse post.html's <body> verbatim (kept in sync automatically) with relative→absolute paths.
const postHtml = readFileSync("post.html", "utf8");
const bodyInner = (postHtml.match(/<body>([\s\S]*?)<\/body>/i)?.[1] || "")
  .replace(/(src|href)="assets\//g, '$1="/assets/')
  .replace(/(src|href)="\.\//g, '$1="/');

const head = (post, slug, url) => {
  const title = esc(post.title || "Woojae Joo");
  const desc = esc((post.summary || "AI, Robotics, Systems 공부 기록").slice(0, 200));
  const img = OG_IMAGE_URL ? ogCard(post) : firstImage(post.html);
  const card = "summary_large_image";
  const published = post.created ? new Date(post.created).toISOString() : "";
  const modified = post.updated ? new Date(post.updated).toISOString() : published;
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title || "Woojae Joo",
    description: (post.summary || "AI, Robotics, Systems 공부 기록").slice(0, 200),
    image: img,
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: { "@type": "Person", name: "Woojae Joo", url: "https://github.com/ursonice" },
    publisher: { "@type": "Person", name: "Woojae Joo" },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  }).replace(/</g, "\\u003c");
  const cat = post.category || "Notes";
  const bc = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: cat, item: `${SITE}/topics/${topicSlug(cat)}/` },
      { "@type": "ListItem", position: 3, name: post.title || "글", item: url },
    ],
  }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0b0e" />

    <!-- Google Analytics (GA4) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-K7VKNXKJJ7"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag("js", new Date());
      gtag("config", "G-K7VKNXKJJ7");
    </script>

    <title>${title} — Woojae Joo</title>
    <meta name="post-slug" content="${esc(slug)}" />
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${esc(url)}" />
    <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="alternate" type="application/rss+xml" title="Woojae Joo — Developer Note" href="/feed.xml" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Woojae Joo — Developer Note" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(img)}" />
    ${published ? `<meta property="article:published_time" content="${published}" />` : ""}
    ${modified ? `<meta property="article:modified_time" content="${modified}" />` : ""}
    <meta name="twitter:card" content="${card}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${esc(img)}" />

    <script type="application/ld+json">${ld}</script>
    <script type="application/ld+json">${bc}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/assets/css/styles.css?v=39" />

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" />
    <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"></script>
  </head>`;
};

// post.html's body contains an empty <article class="article" data-article>…loading…</article>
// shell. For each post we swap that shell for the prerendered article so the static HTML
// carries the full content (post.js hydrates rather than re-rendering).
const ARTICLE_SHELL_RE = /<article class="article" data-article>[\s\S]*?<\/article>/;

rmSync("posts", { recursive: true, force: true });
let count = 0;
for (const post of posts) {
  const slug = (post.slug || "").normalize("NFC").replace(/\//g, "-").trim();
  if (!slug) continue;
  const url = `${SITE}/posts/${encodeURIComponent(slug)}/`;
  const prerendered = `<article class="article" data-article data-prerendered>${articleHtml(post)}</article>`;
  const bodyForPost = bodyInner.replace(ARTICLE_SHELL_RE, prerendered);
  mkdirSync(`posts/${slug}`, { recursive: true });
  writeFileSync(`posts/${slug}/index.html`, `${head(post, slug, url)}\n  <body>${bodyForPost}</body>\n</html>\n`);
  count += 1;
}
console.log(`Generated ${count} static post pages under posts/`);
