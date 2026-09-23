// Homepage: search / topic filters / tag filters / load-more over the post list.
// Fetches the lightweight data/posts-index.json (list fields + text excerpt), not the
// full notion-posts.json with every post body. Theme toggle / header scroll / footer
// year live in assets/js/theme.js (shared by every page).
const DATA_URL = "/data/posts-index.json";

const state = {
  posts: [],
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

const esc = (value = "") =>
  value.toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

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

// Topic → URL slug. Mirrors scripts/lib/shared.mjs topicSlug() (static /topics/<slug>/ pages).
const topicSlug = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "topic";

const renderFilters = () => {
  const container = $("[data-filters]");
  const topics = uniqueTopics(state.posts);
  const buttons = [["all", `All ${state.posts.length}`], ...topics.map(([topic, count]) => [topic, `${topic} ${count}`])];
  container.innerHTML = buttons
    .map(
      ([value, label]) =>
        `<button class="filter-button" type="button" data-filter="${esc(value)}" aria-pressed="${value === state.activeTopic}">${esc(label)}</button>`,
    )
    .join("");
};

// Plain-text search haystack (title + summary + category + tags + body excerpt).
const searchText = (post) => {
  if (post._search == null) {
    post._search = normalize([post.title, post.summary, post.category, ...(post.tags || []), post.plain || ""].join(" "));
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
      const href = `/posts/${encodeURIComponent((post.slug || "").normalize("NFC"))}/`;
      return `
        <a class="post-card" href="${href}">
          <div class="post-meta">
            <span class="cat">${esc(post.category || "Notes")}</span>
            ${tags
              .map((tag) => `<span class="badge" data-tag="${esc(tag)}" role="button" tabindex="0" title="${esc(tag)} 태그로 필터">${esc(tag)}</span>`)
              .join("")}
          </div>
          <h3>${esc(post.title)}</h3>
          <p>${esc(post.summary || "노션에서 가져온 공부 기록입니다.")}</p>
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
  bar.innerHTML = `<span class="active-tag-label">태그</span><strong>#${esc(state.activeTag)}</strong><button type="button" class="active-tag-clear" data-clear-tag>✕ 해제</button>`;
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
        `<a class="topic-card" href="/topics/${topicSlug(topic)}/"><strong>${esc(topic)}</strong><span>${count} notes</span></a>`,
    )
    .join("");
};

const renderStats = () => {
  const latest = sortedByRecent(state.posts)[0];
  $("[data-stat='post-count']").textContent = state.posts.length;
  $("[data-stat='topic-count']").textContent = uniqueTopics(state.posts).length;
  $("[data-stat='last-updated']").textContent = latest ? formatDate(latest.updated || latest.created) : "–";
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

const init = async () => {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.posts = sortedByCreated(data.posts || []);
    state.profile = data.profile || null;
    window.__POSTS__ = state.posts; // shared with the ⌘K palette
  } catch (error) {
    // Keep the prerendered grid/topics/stats (gen-home-page.mjs) instead of
    // wiping them with an empty re-render.
    console.warn("Failed to load post index — keeping prerendered content", error);
    return;
  }

  const tagParam = new URLSearchParams(location.search).get("tag");
  if (tagParam) state.activeTag = tagParam;

  renderStats();
  renderFilters();
  renderActiveTag();
  renderPosts();
  renderTopics();
  applyProfile();
  bindEvents();

  if (state.activeTag) document.getElementById("posts")?.scrollIntoView({ block: "start" });
};

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
