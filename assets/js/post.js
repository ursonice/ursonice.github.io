const DATA_URL = "/data/notion-posts.json";
const $ = (selector, scope = document) => scope.querySelector(selector);

// Canonical pretty URL for a post (static per-post page with correct OG tags).
const postUrl = (post) => `${location.origin}/posts/${encodeURIComponent((post.slug || "").normalize("NFC"))}/`;

// KakaoTalk share: paste your Kakao JavaScript app key here to enable the 카카오톡 button.
// Get one (free) at https://developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키,
// and register https://ursonice.github.io under 플랫폼 → Web. Empty = button hidden.
const KAKAO_KEY = "6b60f0fffaa5128881dae4b76b0a165a";

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

  // Keep the active item centered inside the (scrollable) TOC, without moving the page.
  const keepInView = (link) => {
    if (side.scrollHeight <= side.clientHeight + 1) return; // TOC fits; nothing to scroll
    const c = side.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    // How far the link's center is from the TOC's visible center → scroll the TOC by that much.
    const delta = l.top + l.height / 2 - (c.top + side.clientHeight / 2);
    if (Math.abs(delta) < 6) return; // already ~centered; avoid micro-jitter
    side.scrollTo({ top: side.scrollTop + delta, behavior: "smooth" });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach(({ id, link }) => {
          const active = id === entry.target.id;
          link.classList.toggle("is-active", active);
          if (active) keepInView(link);
        });
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

// Wrap each code block in a window-chrome card: header (traffic-light dots +
// language label + copy button) and a line-number gutter.
const decorateCodeBlocks = () => {
  document.querySelectorAll(".article-content pre").forEach((pre) => {
    if (pre.closest(".code-block")) return; // already decorated
    const code = pre.querySelector("code");
    if (!code) return;

    const lang = (pre.dataset.lang || "code").toUpperCase();
    const lineCount = Math.max(1, code.textContent.replace(/\n+$/, "").split("\n").length);

    const block = document.createElement("div");
    block.className = "code-block";

    const head = document.createElement("div");
    head.className = "code-head";
    head.innerHTML = `<span class="code-dots"><i></i><i></i><i></i></span><span class="code-lang">${lang}</span>`;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-btn";
    copy.textContent = "복사";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        copy.textContent = "복사됨";
      } catch {
        copy.textContent = "실패";
      }
      setTimeout(() => (copy.textContent = "복사"), 1500);
    });
    head.appendChild(copy);

    const gutter = document.createElement("span");
    gutter.className = "code-gutter";
    gutter.setAttribute("aria-hidden", "true");
    gutter.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

    const scroll = document.createElement("div");
    scroll.className = "code-scroll";

    pre.replaceWith(block);
    scroll.append(gutter, pre);
    block.append(head, scroll);
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
  const url = postUrl(post);
  const img = firstImage(post);
  const upsert = (selector, make, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) { el = make(); document.head.appendChild(el); }
    el.setAttribute(attr, value);
  };
  const meta = (prop) => () => { const m = document.createElement("meta"); m.setAttribute("property", prop); return m; };
  upsert('meta[name="description"]', () => { const m = document.createElement("meta"); m.name = "description"; return m; }, "content", desc);
  upsert('meta[property="og:title"]', meta("og:title"), "content", post.title);
  upsert('meta[property="og:description"]', meta("og:description"), "content", desc);
  upsert('meta[property="og:url"]', meta("og:url"), "content", url);
  upsert('meta[property="og:image"]', meta("og:image"), "content", img);
  upsert('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l; }, "href", url);
};

// First image in the post body, as an absolute URL (used for the KakaoTalk share thumbnail).
const firstImage = (post) => {
  const m = (post.html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return `${location.origin}/assets/images/favicon.svg`;
  const src = m[1];
  const abs = /^https?:/i.test(src) ? src : src.startsWith("/") ? location.origin + src : `${location.origin}/${src.replace(/^\.?\//, "")}`;
  // Image paths in the JSON are NFD but the files are NFC → normalize so the URL resolves.
  return encodeURI(abs.normalize("NFC"));
};

// Share bar: copy link, X, LinkedIn (URL-based) + optional KakaoTalk (needs KAKAO_KEY).
const initShare = (post) => {
  const bar = $("[data-share]");
  if (!bar) return;
  const url = postUrl(post);
  const title = post.title || "Woojae Joo";

  const x = bar.querySelector("[data-share-x]");
  if (x) x.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const li = bar.querySelector("[data-share-li]");
  if (li) li.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const copy = bar.querySelector("[data-share-copy]");
  if (copy)
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = "Copied";
      } catch {
        copy.textContent = "Failed";
      }
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    });

  initKakaoShare(bar, { url, title, desc: (post.summary || "").slice(0, 100), image: firstImage(post) });
};

const initKakaoShare = (bar, payload) => {
  const btn = bar.querySelector("[data-share-kakao]");
  if (!btn || !KAKAO_KEY) return; // no key → button stays hidden
  const ready = () => {
    if (!window.Kakao) return;
    if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
    btn.hidden = false;
    btn.addEventListener("click", () => {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: payload.title,
          description: payload.desc,
          imageUrl: payload.image,
          link: { mobileWebUrl: payload.url, webUrl: payload.url },
        },
      });
    });
  };
  if (window.Kakao) return ready();
  const s = document.createElement("script");
  s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
  s.onload = ready;
  document.head.appendChild(s);
};

// Related posts (same category/tags) + previous/next navigation at the end of a post.
const renderPostNav = (post, all) => {
  const main = $(".article-shell");
  const comments = document.getElementById("comments");
  if (!main || !Array.isArray(all) || !all.length) return;

  const byCreated = [...all].sort((a, b) => new Date(b.created || b.updated) - new Date(a.created || a.updated));
  const i = byCreated.findIndex((p) => p.id === post.id);
  const newer = i > 0 ? byCreated[i - 1] : null;
  const older = i >= 0 && i < byCreated.length - 1 ? byCreated[i + 1] : null;

  let related = byCreated.filter((p) => p.id !== post.id && p.category === post.category);
  if (related.length < 3) {
    const tags = new Set(post.tags || []);
    const more = byCreated.filter(
      (p) => p.id !== post.id && p.category !== post.category && (p.tags || []).some((t) => tags.has(t)),
    );
    related = [...related, ...more];
  }
  related = related.slice(0, 3);

  const href = (p) => `/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const relatedHtml = related.length
    ? `<h2 class="post-nav-title">관련 글</h2>
       <ul class="related-list">
         ${related
           .map(
             (p) =>
               `<li><a href="${href(p)}"><span class="related-cat">${esc(p.category || "Notes")}</span><span class="related-title">${esc(p.title)}</span></a></li>`,
           )
           .join("")}
       </ul>`
    : "";
  const prevNext =
    newer || older
      ? `<div class="post-nav-links">
           ${older ? `<a class="post-nav-link" href="${href(older)}"><span>← 이전 글</span><strong>${esc(older.title)}</strong></a>` : "<span></span>"}
           ${newer ? `<a class="post-nav-link next" href="${href(newer)}"><span>다음 글 →</span><strong>${esc(newer.title)}</strong></a>` : "<span></span>"}
         </div>`
      : "";

  if (!relatedHtml && !prevNext) return;
  const section = document.createElement("section");
  section.className = "post-nav";
  section.innerHTML = relatedHtml + prevNext;
  // Comments first, then post recommendations below them.
  if (comments && comments.parentNode === main) comments.after(section);
  else main.appendChild(section);
};

// Series box: if this post belongs to a Notion "Series", show the ordered list of parts.
const renderSeries = (post, all) => {
  if (!post.series || !Array.isArray(all)) return;
  const parts = all
    .filter((p) => p.series === post.series)
    .sort((a, b) => (a.seriesOrder ?? 1e9) - (b.seriesOrder ?? 1e9) || new Date(a.created) - new Date(b.created));
  if (parts.length < 2) return;

  const idx = parts.findIndex((p) => p.id === post.id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const href = (p) => `/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;
  const items = parts
    .map((p, i) => {
      const cur = p.id === post.id;
      const inner = `<span class="series-num">${i + 1}</span><span class="series-item-title">${esc(p.title)}</span>`;
      return `<li class="${cur ? "is-current" : ""}">${cur ? inner : `<a href="${href(p)}">${inner}</a>`}</li>`;
    })
    .join("");

  const box = document.createElement("details");
  box.className = "series-box";
  box.open = true;
  box.innerHTML = `<summary><span class="series-label">📚 ${esc(post.series)}</span><span class="series-progress">${idx + 1} / ${parts.length}</span></summary><ol class="series-list">${items}</ol>`;
  const content = $(".article-content");
  if (content) content.parentNode.insertBefore(box, content);
};

const renderPost = (post) => {
  document.title = `${post.title} — Woojae Joo`;
  setMeta(post);
  const article = $("[data-article]");
  const body = post.html
    ? `<div class="article-content">${post.html.normalize("NFC")}</div>`
    : `<div class="article-content"><p>${escapeHtml(post.summary || "아직 본문이 동기화되지 않은 글입니다. 노션에서 내용을 채우면 여기에 표시됩니다.")}</p></div>`;

  const created = formatDate(post.created);
  const updated = formatDate(post.updated);
  const dateMeta =
    created && updated && created !== updated
      ? `<span>작성 ${created}</span><span class="dot"></span><span>수정 ${updated}</span>`
      : `<span>작성 ${created || updated}</span>`;

  article.innerHTML = `
    <a class="back-link" href="/#posts">← 글 목록</a>
    <p class="eyebrow">${post.category || "Note"}</p>
    <h1>${post.title}</h1>
    <div class="article-meta">
      ${(post.tags || [])
        .map((tag) => `<a class="meta-tag" href="/index.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
        .join("")}
      ${(post.tags || []).length ? '<span class="dot"></span>' : ""}
      ${dateMeta}
    </div>
    <hr class="article-divider" />
    ${body}
    <div class="share-bar" data-share>
      <span class="share-label">Share</span>
      <button type="button" class="share-btn" data-share-copy>Copy</button>
      <a class="share-btn share-x" data-share-x target="_blank" rel="noopener">X</a>
      <a class="share-btn share-li" data-share-li target="_blank" rel="noopener">LinkedIn</a>
      <button type="button" class="share-btn share-kakao" data-share-kakao hidden>카카오톡</button>
    </div>`;
  buildToc();
  initShare(post);
  addHeadingAnchors();
  initMermaid();
  highlightCode();
  decorateCodeBlocks();
  initLightbox();
  typesetMath();
};

const renderMissing = () => {
  $("[data-article]").innerHTML = `
    <a class="back-link" href="/#posts">← 글 목록</a>
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
  // Slug from the static per-post page's <meta name="post-slug"> (pretty /posts/<slug>/ URLs),
  // falling back to ?slug= (the post.html SPA). Normalize to NFC so Korean slugs always match.
  const metaSlug = document.querySelector('meta[name="post-slug"]')?.content;
  const slug = (metaSlug || new URLSearchParams(location.search).get("slug") || "").normalize("NFC");
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
      renderSeries(post, data.posts);
      renderPostNav(post, data.posts);
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
