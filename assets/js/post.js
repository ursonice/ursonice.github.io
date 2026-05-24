const DATA_URL = "data/notion-posts.json";
// Notion-backed comments API (val.town). Empty = comments disabled.
const COMMENTS_API = "https://ursonice--923e1e4a572211f196ffee650bb23af1.web.val.run";
const $ = (selector, scope = document) => scope.querySelector(selector);

const setupComments = (postId) => {
  const section = $("[data-comments]");
  if (!section || !postId || !COMMENTS_API || COMMENTS_API.startsWith("__")) return;
  section.hidden = false;

  const list = $("[data-comment-list]", section);
  const countEl = $("[data-comments-count]", section);
  const form = $("[data-comment-form]", section);
  const statusEl = $("[data-comment-status]", section);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (iso) => {
    try { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); }
    catch { return ""; }
  };

  const load = async () => {
    try {
      const res = await fetch(`${COMMENTS_API}?postId=${encodeURIComponent(postId)}`);
      const data = await res.json();
      const comments = (data.comments || []).sort((a, b) => new Date(a.created) - new Date(b.created));
      countEl.textContent = comments.length ? `(${comments.length})` : "";
      list.innerHTML = comments.length
        ? comments.map((c) => `
          <li class="comment">
            <div class="comment-head">
              <span class="comment-name">${esc(c.name)}</span>
              <span class="comment-date">${fmt(c.created)}</span>
            </div>
            <div class="comment-body">${esc(c.body).replace(/\n/g, "<br>")}</div>
          </li>`).join("")
        : `<li class="comment-empty">첫 댓글을 남겨보세요.</li>`;
    } catch {
      list.innerHTML = `<li class="comment-empty">댓글을 불러오지 못했습니다.</li>`;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const body = String(fd.get("body") || "").trim();
    if (!body) return;
    const button = form.querySelector("button");
    button.disabled = true;
    statusEl.textContent = "등록 중…";
    try {
      const res = await fetch(COMMENTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          name: String(fd.get("name") || "").trim(),
          body,
          website: String(fd.get("website") || ""),
        }),
      });
      if (!res.ok) throw new Error("post failed");
      form.reset();
      statusEl.textContent = "등록되었습니다.";
      await load();
      setTimeout(() => { statusEl.textContent = ""; }, 2500);
    } catch {
      statusEl.textContent = "등록 실패. 잠시 후 다시 시도해주세요.";
    } finally {
      button.disabled = false;
    }
  });

  load();
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

const renderPost = (post) => {
  document.title = `${post.title} — Woojae Joo`;
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
  typesetMath();
  highlightCode();
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
  const slug = new URLSearchParams(location.search).get("slug");
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
    const post = (data.posts || []).find((item) => item.slug === slug);
    if (post) {
      renderPost(post);
      setupComments(post.id);
    } else {
      renderMissing();
    }
  } catch (error) {
    console.warn("Failed to load post", error);
    renderMissing();
  }
};

init();
