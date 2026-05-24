const DATA_URL = "data/notion-posts.json";
const $ = (selector, scope = document) => scope.querySelector(selector);

// Giscus (GitHub Discussions) comments. Each post maps to its own discussion via data-term = slug.
const GISCUS = {
  repo: "ursonice/ursonice.github.io",
  repoId: "R_kgDOSkehSQ",
  category: "Announcements",
  categoryId: "DIC_kwDOSkehSc4C9txy",
};

// Custom giscus theme URLs (default theme + "Powered by giscus" credit hidden).
const giscusThemeUrl = (mode) =>
  `${location.origin}/assets/css/giscus-${mode === "dark" ? "dark" : "light"}.css`;

const giscusTheme = () =>
  giscusThemeUrl(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

const setGiscusTheme = (mode) => {
  const theme = giscusThemeUrl(mode);
  const frame = document.querySelector("iframe.giscus-frame");
  frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, "https://giscus.app");
};

const loadGiscus = (term) => {
  const section = $("[data-comments]");
  const mount = $("[data-giscus]");
  if (!section || !mount || !term) return;
  section.hidden = false;
  mount.innerHTML = "";

  const s = document.createElement("script");
  s.src = "https://giscus.app/client.js";
  s.async = true;
  s.crossOrigin = "anonymous";
  const attrs = {
    "data-repo": GISCUS.repo,
    "data-repo-id": GISCUS.repoId,
    "data-category": GISCUS.category,
    "data-category-id": GISCUS.categoryId,
    "data-mapping": "specific",
    "data-term": term,
    "data-strict": "1",
    "data-reactions-enabled": "1",
    "data-emit-metadata": "0",
    "data-input-position": "top",
    "data-theme": giscusTheme(),
    "data-lang": "ko",
  };
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  mount.appendChild(s);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
};

const escapeHtml = (value = "") =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const buildToc = () => {
  const headings = Array.from(document.querySelectorAll(".article-content h2, .article-content h3"));
  if (headings.length < 2) return;

  const side = $("[data-article-side]");
  side.hidden = false;
  side.innerHTML = "<strong>목차</strong>";

  const links = [];
  headings.forEach((heading, index) => {
    const id = heading.id || `section-${index + 1}`;
    heading.id = id;
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = heading.textContent;
    if (heading.tagName === "H3") link.classList.add("lvl-3");
    side.append(link);
    links.push({ id, link });
  });

  // Jump-to-comments entry at the end of the table of contents.
  const commentsEl = document.getElementById("comments");
  if (commentsEl) {
    const clink = document.createElement("a");
    clink.href = "#comments";
    clink.className = "toc-comment";
    clink.textContent = "Comment";
    side.append(clink);
    links.push({ id: "comments", link: clink });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach(({ id, link }) => link.classList.toggle("is-active", id === entry.target.id));
      });
    },
    { rootMargin: "-80px 0px -70% 0px" },
  );
  headings.forEach((heading) => observer.observe(heading));
  if (commentsEl) observer.observe(commentsEl);
};

// Floating "jump to comments" button: appears once you scroll down, hides when comments are in view.
const initJumpToComments = () => {
  const btn = $("[data-jump-comments]");
  const target = document.getElementById("comments");
  if (!btn || !target) return;

  const update = () => {
    const commentsReached = target.getBoundingClientRect().top < window.innerHeight * 0.85;
    const show = window.scrollY > 320 && !commentsReached;
    btn.toggleAttribute("hidden", !show);
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
};

const typesetMath = () => {
  const el = $(".article-content");
  if (!el) return;
  const run = () =>
    window.renderMathInElement?.(el, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  if (window.renderMathInElement) return run();
  let tries = 0;
  const timer = setInterval(() => {
    if (window.renderMathInElement || tries++ > 60) {
      clearInterval(timer);
      run();
    }
  }, 50);
};

const highlightCode = () => {
  const blocks = [...document.querySelectorAll(".article-content pre code")];
  if (!blocks.length) return;
  const run = () => {
    if (!window.hljs) return;
    blocks.forEach((code) => {
      const lang = code.closest("pre")?.getAttribute("data-lang");
      if (lang && !/\blanguage-/.test(code.className)) code.classList.add(`language-${lang}`);
      try {
        window.hljs.highlightElement(code);
      } catch {
        /* unknown language — leave as plain */
      }
    });
  };
  if (window.hljs) return run();
  let tries = 0;
  const timer = setInterval(() => {
    if (window.hljs || tries++ > 60) {
      clearInterval(timer);
      run();
    }
  }, 50);
};

// "Copy" button on each code block.
const addCopyButtons = () => {
  document.querySelectorAll(".article-content pre").forEach((pre) => {
    if (pre.querySelector(".copy-btn")) return;
    const code = pre.querySelector("code");
    if (!code) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "복사";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = "복사됨";
      } catch {
        btn.textContent = "실패";
      }
      setTimeout(() => (btn.textContent = "복사"), 1500);
    });
    pre.appendChild(btn);
  });
};

// Clickable "#" anchor on headings that also copies the section link.
const addHeadingAnchors = () => {
  document.querySelectorAll(".article-content h2[id], .article-content h3[id]").forEach((h) => {
    if (h.querySelector(".heading-anchor")) return;
    const a = document.createElement("a");
    a.className = "heading-anchor";
    a.href = `#${h.id}`;
    a.textContent = "#";
    a.setAttribute("aria-label", "이 섹션 링크 복사");
    a.addEventListener("click", () => {
      const url = `${location.origin}${location.pathname}${location.search}#${h.id}`;
      navigator.clipboard?.writeText(url).catch(() => {});
    });
    h.appendChild(a);
  });
};

// Click article images to view them full-screen.
const initLightbox = () => {
  const imgs = document.querySelectorAll(".article-content img");
  if (!imgs.length) return;
  let overlay = $(".lightbox");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.innerHTML = '<img alt="" />';
    overlay.addEventListener("click", () => overlay.classList.remove("is-open"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") overlay.classList.remove("is-open");
    });
    document.body.appendChild(overlay);
  }
  const big = overlay.querySelector("img");
  imgs.forEach((img) => {
    img.classList.add("zoomable");
    img.addEventListener("click", () => {
      big.src = img.currentSrc || img.src;
      overlay.classList.add("is-open");
    });
  });
};

// Render ```mermaid code blocks as diagrams (loaded from CDN on demand).
const initMermaid = () => {
  const blocks = [...document.querySelectorAll('.article-content pre[data-lang="mermaid"]')];
  if (!blocks.length) return;
  const nodes = blocks.map((pre) => {
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = (pre.querySelector("code") || pre).textContent;
    pre.replaceWith(div);
    return div;
  });
  const render = () => {
    if (!window.mermaid) return;
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "default";
    try {
      window.mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict" });
      window.mermaid.run({ nodes });
    } catch {
      /* leave source as-is on error */
    }
  };
  if (window.mermaid) return render();
  const s = document.createElement("script");
  s.type = "module";
  s.textContent =
    'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"; window.mermaid = mermaid; window.dispatchEvent(new Event("mermaid-ready"));';
  window.addEventListener("mermaid-ready", render, { once: true });
  document.head.appendChild(s);
};

// Top scroll-progress bar.
const initReadProgress = () => {
  const bar = $("[data-read-progress]");
  if (!bar) return;
  const update = () => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
};

// Back-to-top button (appears once scrolled down).
const initBackToTop = () => {
  const btn = $("[data-back-to-top]");
  if (!btn) return;
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const update = () => btn.toggleAttribute("hidden", window.scrollY < 600);
  window.addEventListener("scroll", update, { passive: true });
  update();
};

// Per-post SEO/social meta (works for crawlers that run JS, e.g. Google).
const setMeta = (post) => {
  const desc = (post.summary || "AI, Robotics, Systems 공부 기록").slice(0, 200);
  const url = `${location.origin}/post.html?slug=${encodeURIComponent(post.slug)}`;
  const upsert = (selector, make, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) { el = make(); document.head.appendChild(el); }
    el.setAttribute(attr, value);
  };
  upsert('meta[name="description"]', () => { const m = document.createElement("meta"); m.name = "description"; return m; }, "content", desc);
  upsert('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; }, "content", post.title);
  upsert('meta[property="og:description"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m; }, "content", desc);
  upsert('meta[property="og:url"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:url"); return m; }, "content", url);
  upsert('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l; }, "href", url);
};

const renderPost = (post) => {
  document.title = `${post.title} — Woojae Joo`;
  setMeta(post);
  const article = $("[data-article]");
  const body = post.html
    ? `<div class="article-content">${post.html}</div>`
    : `<div class="article-content"><p>${escapeHtml(post.summary || "아직 본문이 동기화되지 않은 글입니다. 노션에서 내용을 채우면 여기에 표시됩니다.")}</p></div>`;

  const created = formatDate(post.created);
  const updated = formatDate(post.updated);
  const dateMeta =
    created && updated && created !== updated
      ? `<span>작성 ${created}</span><span class="dot"></span><span>수정 ${updated}</span>`
      : `<span>작성 ${created || updated}</span>`;

  article.innerHTML = `
    <a class="back-link" href="./#posts">← 글 목록</a>
    <p class="eyebrow">${post.category || "Note"}</p>
    <h1>${post.title}</h1>
    <div class="article-meta">
      ${(post.tags || []).map((tag) => `<span>${tag}</span><span class="dot"></span>`).join("")}
      ${dateMeta}
    </div>
    <hr class="article-divider" />
    ${body}`;
  buildToc();
  addHeadingAnchors();
  initMermaid();
  highlightCode();
  addCopyButtons();
  initLightbox();
  typesetMath();
};

const renderMissing = () => {
  $("[data-article]").innerHTML = `
    <a class="back-link" href="./#posts">← 글 목록</a>
    <p class="eyebrow">Not found</p>
    <h1>글을 찾을 수 없습니다</h1>
    <p class="article-summary">주소가 바뀌었거나 아직 노션에서 동기화되지 않은 글입니다.</p>`;
};

const applyThemeIcon = () => {
  const icon = $("[data-theme-icon]");
  if (icon) icon.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐";
};

const initTheme = () => {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = saved || (prefersDark ? "dark" : "light");
  applyThemeIcon();
  $("[data-theme-toggle]").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    applyThemeIcon();
    setGiscusTheme(next);
  });
};

const initHeaderScroll = () => {
  const header = $("[data-header]");
  const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
};

const init = async () => {
  initTheme();
  initHeaderScroll();
  // Normalize to NFC so Korean slugs match regardless of NFC/NFD form (direct URLs vs JSON).
  const slug = (new URLSearchParams(location.search).get("slug") || "").normalize("NFC");
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const p = data.profile;
    if (p) {
      if (p.github) document.querySelectorAll('[data-profile-link="github"]').forEach((a) => (a.href = p.github));
      if (p.linkedin) document.querySelectorAll('[data-profile-link="linkedin"]').forEach((a) => (a.href = p.linkedin));
      if (p.email) document.querySelectorAll('[data-profile-link="email"]').forEach((a) => (a.href = `mailto:${p.email}`));
    }
    const post = (data.posts || []).find((item) => (item.slug || "").normalize("NFC") === slug);
    if (post) {
      renderPost(post);
      loadGiscus(post.slug);
      initJumpToComments();
      initReadProgress();
      initBackToTop();
    } else {
      renderMissing();
    }
  } catch (error) {
    console.warn("Failed to load post", error);
    renderMissing();
  }
};

init();
