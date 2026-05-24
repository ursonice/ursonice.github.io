// ⌘K / Ctrl+K command palette: quick post search + jump, on every page.
// Reuses posts already loaded by main.js / post.js (window.__POSTS__), or fetches once on demand.
(() => {
  const DATA_URL = "/data/notion-posts.json";
  let overlay = null;
  let input = null;
  let list = null;
  let emptyEl = null;
  let results = [];
  let active = 0;
  let fetched = null;

  const esc = (s = "") =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const postUrl = (p) => `/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;

  const data = async () => {
    if (Array.isArray(window.__POSTS__) && window.__POSTS__.length) return window.__POSTS__;
    if (fetched) return fetched;
    try {
      const r = await fetch(DATA_URL, { cache: "force-cache" });
      fetched = (await r.json()).posts || [];
    } catch {
      fetched = [];
    }
    return fetched;
  };

  const build = () => {
    overlay = document.createElement("div");
    overlay.className = "cmdk";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="cmdk-backdrop" data-cmdk-close></div>
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="글 검색">
        <input class="cmdk-input" type="text" placeholder="글 제목·태그 검색…" aria-label="글 검색" autocomplete="off" />
        <ul class="cmdk-list" role="listbox"></ul>
        <div class="cmdk-empty" hidden>결과가 없습니다</div>
      </div>`;
    document.body.appendChild(overlay);
    input = overlay.querySelector(".cmdk-input");
    list = overlay.querySelector(".cmdk-list");
    emptyEl = overlay.querySelector(".cmdk-empty");
    overlay.querySelector("[data-cmdk-close]").addEventListener("click", close);
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", onKey);
  };

  const open = async () => {
    if (!overlay) build();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    input.value = "";
    await data();
    render("");
    input.focus();
  };

  const close = () => {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
  };

  const render = async (q) => {
    const query = q.trim().toLowerCase();
    const all = await data();
    results = (
      query
        ? all.filter((p) =>
            [p.title, p.summary, p.category, ...(p.tags || [])].join(" ").toLowerCase().includes(query),
          )
        : all.slice(0, 8)
    ).slice(0, 20);
    active = 0;
    list.innerHTML = results
      .map(
        (p, i) =>
          `<li class="cmdk-item${i === 0 ? " is-active" : ""}" role="option" data-i="${i}"><span class="cmdk-item-title">${esc(p.title)}</span><span class="cmdk-item-cat">${esc(p.category || "Notes")}</span></li>`,
      )
      .join("");
    emptyEl.hidden = results.length > 0;
    list.querySelectorAll(".cmdk-item").forEach((li) => {
      li.addEventListener("click", () => go(Number(li.dataset.i)));
      li.addEventListener("mousemove", () => setActive(Number(li.dataset.i)));
    });
  };

  const setActive = (i) => {
    active = i;
    list.querySelectorAll(".cmdk-item").forEach((li, idx) => li.classList.toggle("is-active", idx === i));
  };

  const go = (i) => {
    const p = results[i];
    if (p) location.href = postUrl(p);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(active + 1, results.length - 1));
      list.children[active]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
      list.children[active]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      overlay && !overlay.hidden ? close() : open();
    }
  });
})();

// Prefetch post pages on hover → with View Transitions, navigation feels instant.
(() => {
  if (navigator.connection?.saveData) return;
  const seen = new Set();
  const isPost = (href) => {
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return false;
      if (!(u.pathname.startsWith("/posts/") || u.pathname === "/post.html")) return false;
      // Skip same-page links (e.g. heading anchors that only change the hash).
      return u.pathname !== location.pathname || u.search !== location.search;
    } catch {
      return false;
    }
  };
  document.addEventListener(
    "pointerover",
    (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || seen.has(a.href) || !isPost(a.href)) return;
      seen.add(a.href);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = a.href;
      document.head.appendChild(link);
    },
    { passive: true },
  );
})();
