// Archive page: all posts grouped by year. Uses the lightweight post index.
// Theme toggle / header scroll live in assets/js/theme.js.
const DATA_URL = "/data/posts-index.json";
const $ = (s) => document.querySelector(s);

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const postUrl = (p) => `/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;
const md = (v) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(v));

(async () => {
  let posts = [];
  try {
    const r = await fetch(DATA_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    posts = (await r.json()).posts || [];
  } catch (e) {
    console.warn("Failed to load posts", e);
    const el = $("[data-archive]");
    if (el) el.innerHTML = '<p class="empty-state">글 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
    return;
  }
  window.__POSTS__ = posts; // shared with the ⌘K palette
  posts.sort((a, b) => new Date(b.created || b.updated) - new Date(a.created || a.updated));

  const byYear = new Map();
  posts.forEach((p) => {
    const y = new Date(p.created || p.updated).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  });

  const countEl = $("[data-count]");
  if (countEl) countEl.textContent = posts.length;

  $("[data-archive]").innerHTML = [...byYear.entries()]
    .map(
      ([year, items]) =>
        `<section class="archive-year"><h2>${year} <span>${items.length}</span></h2><ul>${items
          .map(
            (p) =>
              `<li><a href="${postUrl(p)}"><span class="archive-post-title">${esc(p.title)}</span><span class="archive-date">${md(
                p.created || p.updated,
              )}</span></a></li>`,
          )
          .join("")}</ul></section>`,
    )
    .join("");
})();
