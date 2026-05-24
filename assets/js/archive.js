const DATA_URL = "/data/notion-posts.json";
const $ = (s) => document.querySelector(s);

// Theme toggle (theme itself is applied inline in <head> to avoid a flash).
const applyThemeIcon = () => {
  const i = $("[data-theme-icon]");
  if (i) i.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐";
};
applyThemeIcon();
$("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  applyThemeIcon();
});

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const postUrl = (p) => `/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;
const md = (v) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(v));

(async () => {
  let posts = [];
  try {
    const r = await fetch(DATA_URL, { cache: "no-store" });
    posts = (await r.json()).posts || [];
  } catch (e) {
    console.warn("Failed to load posts", e);
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
