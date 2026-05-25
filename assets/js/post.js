const DATA_URL = "/data/notion-posts.json";
const $ = (selector, scope = document) => scope.querySelector(selector);

// Canonical pretty URL for a post (static per-post page with correct OG tags).
const postUrl = (post) => `${location.origin}/posts/${encodeURIComponent((post.slug || "").normalize("NFC"))}/`;

// Category → /topics/<slug>/ URL. Must match scripts/gen-tag-pages.mjs & main.js.
const topicSlug = (s) =>
  (s || "").toString().toLowerCase().normalize("NFC").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "topic";

// KakaoTalk share: paste your Kakao JavaScript app key here to enable the 카카오톡 button.
// Get one (free) at https://developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키,
// and register https://ursonice.github.io under 플랫폼 → Web. Empty = button hidden.
const KAKAO_KEY = "6b60f0fffaa5128881dae4b76b0a165a";

// View counts: paste your val.town counter URL (see scripts/view-counter.ts) to enable
// the "조회 N" count on posts. Empty = disabled.
const VIEW_COUNTER_URL = "https://ursonice--635302de577811f18749ee650bb23af1.web.val.run";

// OG share-card image service (val.town, see scripts/og-image.ts). Link previews use a
// generated card with the post title. This only affects JS-running crawlers here; static
// /posts/ pages set it at build time (scripts/gen-post-pages.mjs). Keep the two in sync.
const OG_IMAGE_URL = "https://ursonice--8ca24676580f11f18cd8ee650bb23af1.web.val.run/";
const ogCardUrl = (title, category) => {
  const sep = OG_IMAGE_URL.includes("?") ? "&" : "?";
  return `${OG_IMAGE_URL}${sep}title=${encodeURIComponent((title || "Woojae Joo").slice(0, 120))}&cat=${encodeURIComponent(category || "Notes")}`;
};

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

  // Mobile bottom-sheet TOC: the sidebar is desktop-only, so on phones we open the
  // same list from a floating "목차" button instead of burying it under the article.
  const drawer = document.createElement("div");
  drawer.className = "toc-drawer";
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="toc-drawer-backdrop" data-toc-close></div>
    <nav class="toc-drawer-panel" aria-label="목차">
      <div class="toc-drawer-head"><strong>목차</strong><button type="button" class="toc-drawer-x" data-toc-close aria-label="닫기">✕</button></div>
      <div class="toc-drawer-links"></div>
    </nav>`;
  document.body.appendChild(drawer);
  const drawerLinks = drawer.querySelector(".toc-drawer-links");
  const closeDrawer = () => (drawer.hidden = true);
  drawer.querySelectorAll("[data-toc-close]").forEach((el) => el.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) closeDrawer();
  });

  const addDrawerLink = (id, text, { lvl3 = false, comment = false } = {}) => {
    const a = document.createElement("a");
    a.href = `#${id}`;
    a.textContent = text;
    if (lvl3) a.classList.add("lvl-3");
    if (comment) a.classList.add("toc-comment");
    a.addEventListener("click", closeDrawer);
    drawerLinks.append(a);
    return a;
  };

  const links = [];
  headings.forEach((heading, index) => {
    const id = heading.id || `section-${index + 1}`;
    heading.id = id;
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = heading.textContent;
    const lvl3 = heading.tagName === "H3";
    if (lvl3) link.classList.add("lvl-3");
    side.append(link);
    const mlink = addDrawerLink(id, heading.textContent, { lvl3 });
    links.push({ id, link, mlink });
  });

  // Jump-to-comments entry at the end of the table of contents.
  const commentsEl = document.getElementById("comments");
  if (commentsEl) {
    const clink = document.createElement("a");
    clink.href = "#comments";
    clink.className = "toc-comment";
    clink.textContent = "Comment";
    side.append(clink);
    const mlink = addDrawerLink("comments", "Comment", { comment: true });
    links.push({ id: "comments", link: clink, mlink });
  }

  // Floating button that opens the drawer (shown on mobile via CSS).
  const fabStack =
    document.querySelector(".fab-stack") ||
    (() => {
      const s = document.createElement("div");
      s.className = "fab-stack";
      document.body.appendChild(s);
      return s;
    })();
  const tocFab = document.createElement("button");
  tocFab.type = "button";
  tocFab.className = "fab toc-fab";
  tocFab.setAttribute("aria-label", "목차");
  tocFab.setAttribute("title", "목차");
  tocFab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tocFab.addEventListener("click", () => (drawer.hidden = !drawer.hidden));
  fabStack.insertBefore(tocFab, fabStack.firstChild);

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
        links.forEach(({ id, link, mlink }) => {
          const active = id === entry.target.id;
          link.classList.toggle("is-active", active);
          mlink?.classList.toggle("is-active", active);
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

// Number display equations (1),(2)… down the right margin. Inline math is untouched.
const numberEquations = (scope) => {
  const el = scope || $(".article-content");
  if (!el) return;
  let n = 0;
  el.querySelectorAll(".katex-display").forEach((eq) => {
    if (eq.querySelector(".eq-number")) return; // idempotent
    n += 1;
    const tag = document.createElement("span");
    tag.className = "eq-number";
    tag.textContent = `(${n})`;
    eq.appendChild(tag);
  });
};

// Number figures that carry a caption ("그림 N." into the <figcaption>). Uncaptioned
// images (most screenshots) are left as-is, following the usual scholarly convention.
const numberFigures = () => {
  const content = $(".article-content");
  if (!content) return;
  let n = 0;
  content.querySelectorAll("figure").forEach((fig) => {
    const cap = fig.querySelector("figcaption");
    if (!cap || cap.querySelector(".fig-number")) return;
    n += 1;
    const tag = document.createElement("span");
    tag.className = "fig-number";
    tag.textContent = `그림 ${n}.`;
    cap.prepend(tag, document.createTextNode(" "));
  });
};

const typesetMath = () => {
  const el = $(".article-content");
  if (!el) return;
  const run = () => {
    window.renderMathInElement?.(el, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
    numberEquations(el);
  };
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

// Footnotes: when the body contains footnote references (<sup><a href="#...">) or a
// footnotes list, jumping smooth-scrolls and briefly highlights the target. Dormant
// when a post has no footnotes.
const initFootnotes = () => {
  const content = $(".article-content");
  if (!content) return;
  content.querySelectorAll("sup a[href^='#'], a.footnote-ref[href^='#']").forEach((a) => a.classList.add("fn-ref"));
  content.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    const isFn = a.matches("sup a, .fn-ref") || a.closest(".footnotes, ol[id^='fn'], [data-footnotes]");
    if (!isFn) return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    if (!target || !content.contains(target)) return;
    e.preventDefault();
    history.replaceState(null, "", a.getAttribute("href"));
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("fn-flash");
    setTimeout(() => target.classList.remove("fn-flash"), 1200);
  });
};

// In-article search: highlight matches inside the post body and cycle with Enter.
// Lives at the top of the TOC sidebar (only shown when the TOC is present).
const initArticleSearch = () => {
  const side = $("[data-article-side]");
  const content = $(".article-content");
  if (!side || side.hidden || !content) return;

  const box = document.createElement("div");
  box.className = "toc-search";
  box.innerHTML =
    '<input type="search" placeholder="이 글에서 검색" aria-label="이 글에서 검색" /><span class="toc-search-count" aria-live="polite" hidden></span>';
  side.insertBefore(box, side.firstChild);
  const input = box.querySelector("input");
  const countEl = box.querySelector(".toc-search-count");
  let hits = [];
  let idx = -1;

  const clear = () => {
    content.querySelectorAll("mark.search-hit").forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    content.normalize();
    hits = [];
    idx = -1;
    countEl.hidden = true;
  };

  const focusHit = () => {
    hits.forEach((h, i) => h.classList.toggle("current", i === idx));
    hits[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
    countEl.textContent = `${idx + 1}/${hits.length}`;
  };

  const run = (q) => {
    clear();
    if (q.length < 2) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeValue.trim() && !n.parentElement.closest("pre, code, .code-block, script, style, mark") && re.test(n.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach((n) => {
      const frag = document.createDocumentFragment();
      const s = n.nodeValue;
      let last = 0;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        frag.append(document.createTextNode(s.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.textContent = m[0];
        frag.append(mark);
        last = m.index + m[0].length;
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
      frag.append(document.createTextNode(s.slice(last)));
      n.replaceWith(frag);
    });
    hits = [...content.querySelectorAll("mark.search-hit")];
    countEl.hidden = false;
    if (hits.length) {
      idx = 0;
      focusHit();
    } else {
      countEl.textContent = "0건";
    }
  };

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value.trim()), 200);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && hits.length) {
      e.preventDefault();
      idx = (idx + (e.shiftKey ? -1 : 1) + hits.length) % hits.length;
      focusHit();
    } else if (e.key === "Escape") {
      input.value = "";
      clear();
    }
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
  const img = OG_IMAGE_URL ? ogCardUrl(post.title, post.category) : firstImage(post);
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
  if (!m) return `${location.origin}/assets/og/default.png`;
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

// "Cite" button → modal with BibTeX + APA citations for this post.
const initCite = (post) => {
  const btn = document.querySelector("[data-share-cite]");
  if (!btn) return;
  const url = postUrl(post);
  const title = (post.title || "Woojae Joo").replace(/\s+/g, " ").trim();
  const year = new Date(post.created || post.updated || Date.now()).getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const key = ((post.slug || "post").normalize("NFC").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "post").toLowerCase();
  const bibtex = `@online{joo${year}_${key},
  author  = {Joo, Woojae},
  title   = {${title}},
  year    = {${year}},
  url     = {${url}},
  urldate = {${today}},
  note    = {Tech Blog}
}`;
  const apa = `Woojae Joo. (${year}). ${title}. — Tech Blog   ${url}`;

  let overlay = null;
  const close = () => overlay && (overlay.hidden = true);
  const build = () => {
    overlay = document.createElement("div");
    overlay.className = "cite-modal";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="cite-backdrop" data-cite-close></div>
      <div class="cite-panel" role="dialog" aria-modal="true" aria-label="이 글 인용">
        <div class="cite-head"><strong>이 글 인용</strong><button type="button" class="cite-x" data-cite-close aria-label="닫기">✕</button></div>
        <div class="cite-block">
          <div class="cite-row"><span>BibTeX</span><button type="button" class="cite-copy" data-cite="bibtex">복사</button></div>
          <pre data-cite-bibtex></pre>
        </div>
        <div class="cite-block">
          <div class="cite-row"><span>Citation</span><button type="button" class="cite-copy" data-cite="apa">복사</button></div>
          <pre data-cite-apa></pre>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cite-bibtex]").textContent = bibtex;
    overlay.querySelector("[data-cite-apa]").textContent = apa;
    overlay.querySelectorAll("[data-cite-close]").forEach((el) => el.addEventListener("click", close));
    overlay.querySelectorAll("[data-cite]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.cite === "bibtex" ? bibtex : apa);
          b.textContent = "복사됨";
        } catch {
          b.textContent = "실패";
        }
        setTimeout(() => (b.textContent = "복사"), 1500);
      }),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay && !overlay.hidden) close();
    });
  };
  btn.addEventListener("click", () => {
    if (!overlay) build();
    overlay.hidden = false;
  });
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

// "조회 N" view count (requires VIEW_COUNTER_URL). Counts once per browser session per post.
const initViewCount = (post) => {
  if (!VIEW_COUNTER_URL) return;
  const meta = $(".article-meta");
  if (!meta) return;
  const slug = (post.slug || "").normalize("NFC");
  const key = `viewed:${slug}`;
  const hit = sessionStorage.getItem(key) ? "0" : "1";
  fetch(`${VIEW_COUNTER_URL}?slug=${encodeURIComponent(slug)}&hit=${hit}`)
    .then((r) => r.json())
    .then((d) => {
      if (typeof d.count !== "number") return;
      const dot = document.createElement("span");
      dot.className = "dot";
      const span = document.createElement("span");
      span.textContent = `조회 ${d.count.toLocaleString()}`;
      // Keep views with the date, left of the font-size control.
      const rs = meta.querySelector(".reading-size");
      if (rs) {
        meta.insertBefore(dot, rs);
        meta.insertBefore(span, rs);
      } else {
        meta.append(dot, span);
      }
      if (hit === "1") sessionStorage.setItem(key, "1");
    })
    .catch(() => {});
};

// Reading font-size preference (작게/보통/크게), persisted in localStorage.
const initReadingSize = () => {
  const group = $(".reading-size");
  if (!group) return;
  const apply = (size) => {
    document.documentElement.dataset.reading = size;
    localStorage.setItem("reading", size);
    group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.readingSize === size)));
  };
  apply(localStorage.getItem("reading") || "md");
  group.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-reading-size]");
    if (btn) apply(btn.dataset.readingSize);
  });
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
    <nav class="breadcrumb" aria-label="breadcrumb">
      <a href="/">홈</a>
      <span class="bc-sep" aria-hidden="true">›</span>
      <a href="/topics/${topicSlug(post.category || "Notes")}/">${post.category || "Notes"}</a>
    </nav>
    <h1>${post.title}</h1>
    <div class="article-meta">
      ${(post.tags || [])
        .map((tag) => `<a class="meta-tag" href="/index.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
        .join("")}
      ${(post.tags || []).length ? '<span class="dot"></span>' : ""}
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
  buildToc();
  initShare(post);
  initCite(post);
  initViewCount(post);
  initReadingSize();
  addHeadingAnchors();
  initMermaid();
  highlightCode();
  decorateCodeBlocks();
  initLightbox();
  initFootnotes();
  initArticleSearch();
  numberFigures();
  typesetMath();
};

// Absolute, NFC-normalized URL for a stored asset path (works from nested /posts/<slug>/ URLs).
const absAsset = (src) => {
  if (!src) return "";
  const s = src.normalize("NFC");
  return /^https?:/i.test(s) ? s : `/${s.replace(/^\/+/, "")}`;
};

// Author box at the end of the article (avatar + name + bio + profile links).
const renderAuthorBox = (about, profile) => {
  const article = $("[data-article]");
  if (!article) return;
  const shareBar = article.querySelector(".share-bar");
  const avatar = absAsset(about?.avatar);
  const p = profile || {};
  const links = [
    p.github ? `<a href="${p.github}" target="_blank" rel="noopener">GitHub</a>` : "",
    p.linkedin ? `<a href="${p.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : "",
    p.email ? `<a href="mailto:${p.email}">Email</a>` : "",
  ]
    .filter(Boolean)
    .join("");
  const box = document.createElement("div");
  box.className = "author-box";
  box.innerHTML = `
    ${avatar ? `<img class="author-avatar" src="${avatar}" alt="Woojae Joo" loading="lazy" />` : ""}
    <div class="author-info">
      <strong class="author-name">Woojae Joo</strong>
      <p class="author-bio">AI · Robotics · Systems를 공부하고 기록합니다.</p>
      ${links ? `<div class="author-links">${links}</div>` : ""}
    </div>`;
  if (shareBar) article.insertBefore(box, shareBar);
  else article.appendChild(box);
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
  document.documentElement.dataset.reading = localStorage.getItem("reading") || "md";
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
    window.__POSTS__ = data.posts || []; // shared with the ⌘K palette
    const p = data.profile;
    if (p) {
      if (p.github) document.querySelectorAll('[data-profile-link="github"]').forEach((a) => (a.href = p.github));
      if (p.linkedin) document.querySelectorAll('[data-profile-link="linkedin"]').forEach((a) => (a.href = p.linkedin));
      if (p.email) document.querySelectorAll('[data-profile-link="email"]').forEach((a) => (a.href = `mailto:${p.email}`));
    }
    const post = (data.posts || []).find((item) => (item.slug || "").normalize("NFC") === slug);
    if (post) {
      renderPost(post);
      renderAuthorBox(data.about, data.profile);
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
