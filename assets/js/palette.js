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

// Sliding liquid-glass nav indicator: one frosted capsule that glides between
// menu items on hover/focus and rests on the current item (Apple dock style).
(() => {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll("a"));
  if (!links.length) return;

  const glass = document.createElement("span");
  glass.className = "nav-glass no-anim";
  glass.setAttribute("aria-hidden", "true");
  nav.insertBefore(glass, nav.firstChild);

  let activeLink = null;
  let mouseOver = false;

  const interacting = () => mouseOver || nav.contains(document.activeElement);

  const withoutAnim = (fn) => {
    glass.classList.add("no-anim");
    fn();
    void glass.offsetWidth; // flush layout so the next change animates
    glass.classList.remove("no-anim");
  };

  const placeAt = (link, animate) => {
    if (!link) return;
    const apply = () => {
      glass.style.width = link.offsetWidth + "px";
      glass.style.height = link.offsetHeight + "px";
      glass.style.transform = "translate(" + link.offsetLeft + "px," + link.offsetTop + "px)";
      glass.style.opacity = "1";
    };
    animate ? apply() : withoutAnim(apply);
  };

  const hide = (animate) => {
    const apply = () => {
      glass.style.opacity = "0";
    };
    animate ? apply() : withoutAnim(apply);
  };

  const restore = () => (activeLink ? placeAt(activeLink, true) : hide(true));

  const findActive = () => {
    const current = nav.querySelector("a[aria-current]");
    if (current) return current;
    const hash = location.hash;
    if (hash) {
      const match = links.find((a) => {
        try {
          return new URL(a.getAttribute("href"), location.href).hash === hash;
        } catch {
          return false;
        }
      });
      if (match) return match;
    }
    return null;
  };

  const syncActive = () => {
    const next = findActive();
    links.forEach((a) => a.classList.toggle("is-active", a === next));
    activeLink = next || null;
    if (!interacting()) restore();
  };

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => placeAt(link, true));
    link.addEventListener("focus", () => placeAt(link, true));
  });

  nav.addEventListener("mouseenter", () => (mouseOver = true));
  nav.addEventListener("mouseleave", () => {
    mouseOver = false;
    restore();
  });
  nav.addEventListener("focusout", (e) => {
    if (!nav.contains(e.relatedTarget) && !mouseOver) restore();
  });

  window.addEventListener("hashchange", syncActive);

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!interacting()) (activeLink ? placeAt(activeLink, false) : hide(false));
    }, 120);
  });

  const init = () => {
    syncActive();
    if (activeLink) placeAt(activeLink, false);
  };
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
  // Re-place once webfonts settle (they change link widths).
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (!interacting() && activeLink) placeAt(activeLink, false);
    });
  }
})();

// Keyboard shortcuts + a "?" help overlay (works on every page).
(() => {
  const isTyping = () => {
    const el = document.activeElement;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };

  let overlay = null;
  const close = () => overlay && (overlay.hidden = true);
  const rows = [
    ["⌘&nbsp;K", "검색 열기"],
    ["/", "검색 열기"],
    ["?", "이 도움말 열기"],
    ["T", "테마 전환 (라이트 / 다크)"],
    ["G&nbsp;H", "홈으로 이동"],
    ["Esc", "닫기"],
  ];
  const build = () => {
    overlay = document.createElement("div");
    overlay.className = "kbd-help";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="kbd-backdrop" data-kbd-close></div>
      <div class="kbd-panel" role="dialog" aria-modal="true" aria-label="키보드 단축키">
        <div class="kbd-head"><strong>키보드 단축키</strong><button type="button" class="kbd-x" data-kbd-close aria-label="닫기">✕</button></div>
        <ul class="kbd-list">${rows.map(([k, d]) => `<li><kbd>${k}</kbd><span>${d}</span></li>`).join("")}</ul>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-kbd-close]").forEach((el) => el.addEventListener("click", close));
  };
  const openHelp = () => {
    if (!overlay) build();
    overlay.hidden = false;
  };

  let gPending = 0;
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave ⌘K and OS shortcuts alone
    if (isTyping()) return;
    const k = e.key;
    if (k === "Escape") return close();
    if (k === "?") {
      e.preventDefault();
      return overlay && !overlay.hidden ? close() : openHelp();
    }
    if (k === "/") {
      e.preventDefault();
      return document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    }
    if (k === "t" || k === "T") return document.querySelector("[data-theme-toggle]")?.click();
    if (k === "g" || k === "G") {
      gPending = Date.now();
      return;
    }
    if ((k === "h" || k === "H") && Date.now() - gPending < 700) {
      gPending = 0;
      location.href = "/";
    }
  });
})();

// Mobile menu: the nav is hidden on small screens (CSS), so inject a bottom-right FAB that
// opens it. Skipped on post pages — those already have a bottom-right 목차(TOC) button, so
// the site-nav menu only appears where there's no TOC (home, topics, CV, archive).
(() => {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".site-nav");
  if (!header || !nav) return;
  if (document.querySelector(".article-shell")) return; // post page → TOC button owns the corner

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fab nav-toggle";
  btn.setAttribute("aria-label", "메뉴 열기");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  // Bottom-right floating button, in the FAB stack (post pages already have one; the
  // menu then opens just above it — same corner as the post-page action buttons).
  let stack = document.querySelector(".fab-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "fab-stack";
    document.body.appendChild(stack);
  }
  stack.appendChild(btn);

  const setOpen = (open) => {
    header.toggleAttribute("data-nav-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!header.hasAttribute("data-nav-open"));
  });
  // Tapping a link, clicking outside, Escape, or growing past the breakpoint closes it.
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (header.hasAttribute("data-nav-open") && !header.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.hasAttribute("data-nav-open")) setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setOpen(false);
  });
})();
