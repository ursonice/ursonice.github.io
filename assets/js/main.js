const DATA_URL = "data/notion-posts.json";

const state = {
  posts: [],
  about: null,
  profile: null,
  activeTopic: "all",
  activeTag: null,
  query: "",
  pageSize: 12,
  visible: 12,
};

const $ = (selector, scope = document) => scope.querySelector(selector);

// Apply contact links (GitHub / LinkedIn / Email) pulled from the Notion Profile page.
const applyProfile = () => {
  const p = state.profile;
  if (!p) return;
  document.querySelectorAll('[data-profile-link="github"]').forEach((a) => {
    if (p.github) a.href = p.github;
  });
  document.querySelectorAll('[data-profile-link="linkedin"]').forEach((a) => {
    if (p.linkedin) a.href = p.linkedin;
  });
  document.querySelectorAll('[data-profile-link="email"]').forEach((a) => {
    if (p.email) a.href = `mailto:${p.email}`;
  });
};

const formatDate = (value) => {
  if (!value) return "날짜 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(date);
};

const normalize = (value = "") => value.toString().trim().toLowerCase();

const escAttr = (value = "") =>
  value.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const sortedByRecent = (posts) =>
  [...posts].sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));

// Post list order: newest *created* first (creation order), independent of later edits.
const sortedByCreated = (posts) =>
  [...posts].sort((a, b) => new Date(b.created || b.updated) - new Date(a.created || a.updated));

const uniqueTopics = (posts) => {
  const counts = new Map();
  posts.forEach((post) => {
    const topic = post.category || "Notes";
    counts.set(topic, (counts.get(topic) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const renderFilters = () => {
  const container = $("[data-filters]");
  const topics = uniqueTopics(state.posts);
  const buttons = [["all", `All ${state.posts.length}`], ...topics.map(([topic, count]) => [topic, `${topic} ${count}`])];
  container.innerHTML = buttons
    .map(
      ([value, label]) =>
        `<button class="filter-button" type="button" data-filter="${value}" aria-pressed="${value === state.activeTopic}">${label}</button>`,
    )
    .join("");
};

// Plain-text search haystack (title + summary + category + tags + body), computed once per post.
const searchText = (post) => {
  if (post._search == null) {
    const body = (post.html || "").replace(/<[^>]+>/g, " ");
    post._search = normalize([post.title, post.summary, post.category, ...(post.tags || []), body].join(" "));
  }
  return post._search;
};

const filteredPosts = () => {
  const q = normalize(state.query);
  return state.posts.filter((post) => {
    const topicMatch = state.activeTopic === "all" || post.category === state.activeTopic;
    const tagMatch = !state.activeTag || (post.tags || []).includes(state.activeTag);
    return topicMatch && tagMatch && (!q || searchText(post).includes(q));
  });
};

const renderPosts = () => {
  const container = $("[data-posts]");
  const empty = $("[data-empty]");
  const posts = filteredPosts();
  const shown = posts.slice(0, state.visible);

  empty.hidden = posts.length > 0;
  container.innerHTML = shown
    .map((post) => {
      const tags = (post.tags || []).slice(0, 2);
      const href = `post.html?slug=${encodeURIComponent(post.slug)}`;
      return `
        <a class="post-card" href="${href}">
          <div class="post-meta">
            <span class="cat">${post.category || "Notes"}</span>
            ${tags
              .map((tag) => `<span class="badge" data-tag="${escAttr(tag)}" role="button" tabindex="0" title="${escAttr(tag)} 태그로 필터">${tag}</span>`)
              .join("")}
          </div>
          <h3>${post.title}</h3>
          <p>${post.summary || "노션에서 가져온 공부 기록입니다."}</p>
          <div class="post-footer">
            <span>${formatDate(post.created || post.updated)}</span>
          </div>
        </a>`;
    })
    .join("");

  // "Load more" button (created once, kept in sync).
  let more = $("[data-load-more]");
  const remaining = posts.length - shown.length;
  if (remaining > 0) {
    if (!more) {
      more = document.createElement("button");
      more.type = "button";
      more.className = "load-more";
      more.setAttribute("data-load-more", "");
      more.addEventListener("click", () => {
        state.visible += state.pageSize;
        renderPosts();
      });
      container.after(more);
    }
    more.textContent = `더 보기 (${remaining})`;
    more.hidden = false;
  } else if (more) {
    more.hidden = true;
  }
};

// Indicator shown above the grid when filtering by a clicked tag.
const renderActiveTag = () => {
  const grid = $("[data-posts]");
  if (!grid) return;
  let bar = $("[data-active-tag]");
  if (!state.activeTag) {
    if (bar) bar.hidden = true;
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "active-tag";
    bar.setAttribute("data-active-tag", "");
    grid.parentNode.insertBefore(bar, grid);
  }
  bar.hidden = false;
  bar.innerHTML = `<span class="active-tag-label">태그</span><strong>#${escAttr(state.activeTag)}</strong><button type="button" class="active-tag-clear" data-clear-tag>✕ 해제</button>`;
};

const setActiveTag = (tag) => {
  state.activeTag = tag || null;
  state.visible = state.pageSize;
  renderActiveTag();
  renderPosts();
};

const renderTopics = () => {
  const container = $("[data-topics]");
  container.innerHTML = uniqueTopics(state.posts)
    .map(
      ([topic, count]) =>
        `<button class="topic-card" type="button" data-topic-jump="${topic}"><strong>${topic}</strong><span>${count} notes</span></button>`,
    )
    .join("");
};

const renderStats = () => {
  const latest = sortedByRecent(state.posts)[0];
  $("[data-stat='post-count']").textContent = state.posts.length;
  $("[data-stat='topic-count']").textContent = uniqueTopics(state.posts).length;
  $("[data-stat='last-updated']").textContent = latest ? formatDate(latest.updated || latest.created) : "–";
};

const renderAbout = () => {
  const container = $("[data-about]");
  if (state.about?.html) {
    container.innerHTML = state.about.html;
  } else {
    container.innerHTML = `
      <p>아직 노션 About 페이지가 연결되지 않았습니다. 노션에 자기소개 · 경력 · 학력 · 기술 스택을 정리한 페이지를 만들고
      <code>NOTION_ABOUT_PAGE_ID</code>로 연결하면 이 영역이 자동으로 채워집니다.</p>
      <p>그 전까지는 이 자리에서 디자인과 레이아웃을 미리 확인할 수 있습니다.</p>`;
  }

  const avatarImg = $(".profile-card .avatar img");
  if (avatarImg && state.about?.avatar) {
    avatarImg.src = state.about.avatar;
    avatarImg.alt = "Woojae Joo";
    avatarImg.closest(".avatar")?.classList.add("has-photo");
  }

  const chips = $("[data-about-topics]");
  if (chips) {
    chips.innerHTML = uniqueTopics(state.posts)
      .slice(0, 8)
      .map(([topic]) => `<span class="badge">${topic}</span>`)
      .join("");
  }
};

const bindEvents = () => {
  $("[data-search]").addEventListener("input", (event) => {
    state.query = event.target.value;
    state.visible = state.pageSize;
    renderPosts();
  });

  $("[data-filters]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activeTopic = button.dataset.filter;
    state.visible = state.pageSize;
    renderFilters();
    renderPosts();
  });

  $("[data-topics]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-topic-jump]");
    if (!button) return;
    state.activeTopic = button.dataset.topicJump;
    state.visible = state.pageSize;
    renderFilters();
    renderPosts();
    $("#posts").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Clicking a tag chip on a card filters by that tag (without following the card link).
  const grid = $("[data-posts]");
  grid.addEventListener("click", (event) => {
    const tagEl = event.target.closest("[data-tag]");
    if (!tagEl) return;
    event.preventDefault();
    event.stopPropagation();
    setActiveTag(tagEl.dataset.tag);
    $("#posts").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const tagEl = event.target.closest("[data-tag]");
    if (!tagEl) return;
    event.preventDefault();
    setActiveTag(tagEl.dataset.tag);
    $("#posts").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-tag]")) setActiveTag(null);
  });
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
  $("[data-year]").textContent = new Date().getFullYear();
  initTheme();
  initHeaderScroll();

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.posts = sortedByCreated(data.posts || []);
    state.about = data.about || null;
    state.profile = data.profile || null;
  } catch (error) {
    console.warn("Failed to load Notion data", error);
  }

  const tagParam = new URLSearchParams(location.search).get("tag");
  if (tagParam) state.activeTag = tagParam;

  renderStats();
  renderFilters();
  renderActiveTag();
  renderPosts();
  renderTopics();
  renderAbout();
  applyProfile();
  bindEvents();

  if (state.activeTag) document.getElementById("posts")?.scrollIntoView({ block: "start" });
};

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
