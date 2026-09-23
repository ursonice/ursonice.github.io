// Standalone profile / CV page — reuses the Notion-synced about, profile, and posts
// from the lightweight index. Theme toggle / header scroll live in assets/js/theme.js.
const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
    data = await (await fetch("/data/posts-index.json")).json();
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
      .map(([c, n]) => `<span class="badge">${esc(c)} <em>${n}</em></span>`)
      .join("");
  }

  const set = (sel, v) => {
    const e = $(sel);
    if (e) e.textContent = v;
  };
  set("[data-cv-postcount]", posts.length);
  set("[data-cv-topiccount]", Object.keys(counts).length);

  // "Last updated" reflects THIS CV's own revision (the Notion About page's
  // modified date), not the latest blog post.
  if (about.updated) {
    const time = $("[data-cv-updated]");
    if (time) {
      time.textContent = fmtDate(about.updated);
      time.setAttribute("datetime", new Date(about.updated).toISOString());
    }
    $("[data-cv-updated-wrap]")?.removeAttribute("hidden");
  }
};

render();
