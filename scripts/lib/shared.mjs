// Shared helpers for the build/sync scripts. Single source of truth for the
// escaping, slug, URL and date logic that used to be copy-pasted across
// sync-notion / gen-post-pages / gen-tag-pages / gen-home-page / notify-indexnow
// (guarded only by "MUST match" comments — which is how the theme and ?v=
// version drift bugs happened).
//
// The browser-side copies live in assets/js/*.js and must produce the same
// URLs: postPath() ↔ main.js/post.js/palette.js postUrl(), topicSlug() ↔ theirs.

export const SITE = "https://ursonice.github.io";

// Cache-busting versions for static assets referenced from generated pages.
// Bump when the corresponding file changes.
export const ASSET_VER = {
  css: 40,
  theme: 1,
  palette: 9,
};

export const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const xmlEsc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

// Category → /topics/<slug>/ URL segment. Mirrors main.js/post.js topicSlug().
export const topicSlug = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "topic";

// Canonical on-disk/pretty slug form: NFC, no "/", trimmed.
export const cleanSlug = (slug = "") => slug.normalize("NFC").replace(/\//g, "-").trim();

export const postPath = (p) => `/posts/${encodeURIComponent(cleanSlug(p.slug || ""))}/`;
export const postUrl = (p) => `${SITE}${postPath(p)}`;

export const fmtDateKo = (value, options = { year: "numeric", month: "long", day: "numeric" }) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", options).format(date);
};

// The pre-paint theme bootstrap embedded in every generated <head>: applies the
// saved theme (LIGHT default — never prefers-color-scheme) plus the matching
// mobile theme-color before first paint. Keep in sync with the inline copies in
// index.html / post.html / archive.html / cv.html / 404.html.
export const THEME_BOOTSTRAP =
  '<script>(function(){try{var t=localStorage.getItem("theme")||"light";document.documentElement.dataset.theme=t;var r=localStorage.getItem("reading");if(r)document.documentElement.dataset.reading=r;var m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.setAttribute("content",t==="dark"?"#0a0b0e":"#fbfaf7");}catch(e){}})();</script>';

// Fails the build early instead of generating (and committing) an empty site
// when the sync produced no/too little data.
export const assertPosts = (posts, scriptName) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    console.error(`${scriptName}: data/notion-posts.json has no posts — refusing to generate (guard against wiping the live site).`);
    process.exit(1);
  }
};
