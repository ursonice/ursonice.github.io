// Generates a static page per category (topic) at topics/<slug>/index.html.
// The post list is server-rendered (crawlable) so each topic has a real,
// shareable, SEO-friendly URL. Run after the Notion sync, like gen-post-pages.
//
// Keep slugify() in sync with assets/js/main.js (topic-card hrefs point here).

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const SITE = "https://ursonice.github.io";
const CSS_V = "37";

const data = JSON.parse(readFileSync("data/notion-posts.json", "utf8"));
const posts = Array.isArray(data.posts) ? data.posts : [];

const esc = (v = "") =>
  String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const slugify = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "topic";

const postUrl = (p) => `${SITE}/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;
const fmtDate = (s) => {
  try {
    return new Date(s).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
};

const byCat = new Map();
posts.forEach((p) => {
  const c = p.category || "Notes";
  if (!byCat.has(c)) byCat.set(c, []);
  byCat.get(c).push(p);
});

const card = (p) => `
          <a class="post-card" href="${postUrl(p)}">
            <div class="post-meta"><span class="cat">${esc(p.category || "Notes")}</span></div>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.summary || "노션에서 가져온 공부 기록입니다.")}</p>
            <div class="post-footer"><span>${fmtDate(p.created || p.updated)}</span></div>
          </a>`;

const page = (cat, list) => {
  const sorted = [...list].sort((a, b) => new Date(b.created || b.updated) - new Date(a.created || a.updated));
  const url = `${SITE}/topics/${slugify(cat)}/`;
  const desc = `${cat} 관련 글 ${list.length}개 — Woojae Joo 개발 노트.`;
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0b0e" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-K7VKNXKJJ7"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-K7VKNXKJJ7");</script>
    <title>${esc(cat)} — Woojae Joo</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${esc(url)}" />
    <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.json" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(cat)} — Woojae Joo" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${SITE}/assets/og/default.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>(function(){var s=localStorage.getItem("theme");var d=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=s||(d?"dark":"light");})();</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/assets/css/styles.css?v=${CSS_V}" />
  </head>
  <body>
    <a class="skip-link" href="#topic">본문으로 이동</a>
    <header class="site-header" data-header>
      <a class="brand" href="/" aria-label="Woojae Joo home">
        <span class="brand-mark"><img src="/assets/images/favicon.svg" alt="" /></span>
        <span class="brand-text"><span class="brand-name">Woojae Joo</span><span class="brand-sub">ursonice</span></span>
      </a>
      <nav class="site-nav" aria-label="주요 메뉴">
        <a href="/#posts">Writing</a>
        <a href="/#topics">Topics</a>
        <a href="/cv.html">CV</a>
        <a href="/archive.html">Archive</a>
        <a href="https://github.com/ursonice" data-profile-link="github" rel="me" target="_blank">GitHub</a>
      </nav>
      <button class="icon-button" type="button" data-theme-toggle aria-label="테마 전환"><span aria-hidden="true" data-theme-icon>◐</span></button>
    </header>
    <main class="section shell" id="topic">
      <div class="section-heading">
        <p class="eyebrow"><a href="/#topics">← Topics</a></p>
        <h1>${esc(cat)}</h1>
        <p>${list.length} notes</p>
      </div>
      <div class="post-grid">${sorted.map(card).join("")}
      </div>
    </main>
    <footer class="site-footer"><div class="footer-inner"><p>© <span data-year></span> Woojae Joo · ursonice</p><div class="footer-links"><a href="/">← Blog</a></div></div></footer>
    <script>
      (function () {
        var t = document.querySelector("[data-theme-icon]");
        function icon() { if (t) t.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐"; }
        icon();
        var b = document.querySelector("[data-theme-toggle]");
        if (b) b.addEventListener("click", function () { var n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; localStorage.setItem("theme", n); icon(); });
        var h = document.querySelector("[data-header]");
        function s() { if (h) h.toggleAttribute("data-scrolled", window.scrollY > 8); }
        s(); window.addEventListener("scroll", s, { passive: true });
        var y = document.querySelector("[data-year]"); if (y) y.textContent = new Date().getFullYear();
      })();
    </script>
    <script src="/assets/js/palette.js?v=7" defer></script>
  </body>
</html>
`;
};

rmSync("topics", { recursive: true, force: true });
let count = 0;
for (const [cat, list] of byCat) {
  const slug = slugify(cat);
  mkdirSync(`topics/${slug}`, { recursive: true });
  writeFileSync(`topics/${slug}/index.html`, page(cat, list));
  count += 1;
}
console.log(`Generated ${count} topic pages under topics/`);
