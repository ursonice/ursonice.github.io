// Standalone profile / CV page — reuses the Notion-synced about, profile, and posts.
const $ = (sel, root = document) => root.querySelector(sel);

const applyThemeIcon = () => {
  const icon = $("[data-theme-icon]");
  if (icon) icon.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "◐";
};

const initTheme = () => {
  applyThemeIcon();
  $("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    applyThemeIcon();
  });
};

const initHeaderScroll = () => {
  const header = $("[data-header]");
  if (!header) return;
  const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
};

const fmtDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
};

const render = async () => {
  let data = {};
  try {
    data = await (await fetch("/data/notion-posts.json", { cache: "no-cache" })).json();
  } catch {
    /* offline / fetch failed → leave placeholders */
  }
  const about = data.about || {};
  const profile = data.profile || {};
  const posts = Array.isArray(data.posts) ? data.posts : [];

  const aboutEl = $("[data-cv-about]");
  if (aboutEl) aboutEl.innerHTML = about.html || "<p>소개를 불러오지 못했습니다.</p>";

  const avatar = $("[data-cv-avatar]");
  if (avatar && about.avatar) avatar.src = about.avatar.normalize("NFC");

  const setLink = (sel, href) => {
    const a = $(sel);
    if (a && href) a.href = href;
  };
  setLink('[data-profile-link="github"]', profile.github);
  setLink('[data-profile-link="linkedin"]', profile.linkedin);
  setLink('[data-profile-link="email"]', profile.email ? `mailto:${profile.email}` : null);

  // Focus areas = categories the author writes about, by volume.
  const counts = {};
  posts.forEach((p) => {
    const c = p.category || "Notes";
    counts[c] = (counts[c] || 0) + 1;
  });
  const focus = $("[data-cv-focus]");
  if (focus) {
    focus.innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<span class="badge">${c} <em>${n}</em></span>`)
      .join("");
  }

  const set = (sel, v) => {
    const e = $(sel);
    if (e) e.textContent = v;
  };
  set("[data-cv-postcount]", posts.length);
  set("[data-cv-topiccount]", Object.keys(counts).length);
  const latest = posts
    .map((p) => p.updated || p.created)
    .filter(Boolean)
    .sort()
    .pop();
  if (latest) set("[data-cv-updated]", fmtDate(latest));
};

initTheme();
initHeaderScroll();
const yearEl = $("[data-year]");
if (yearEl) yearEl.textContent = new Date().getFullYear();
render();
