// Shared page chrome: theme toggle (+icon, +mobile theme-color), header scroll state,
// footer year. Loaded (deferred) by every page so the behavior can't drift per-page again.
// The pre-paint theme itself is applied by the tiny inline snippet in each <head>
// (localStorage "theme", default "light") — this file only handles interaction.
(() => {
  const META_COLORS = { light: "#fbfaf7", dark: "#0a0b0e" };
  const icon = document.querySelector("[data-theme-icon]");
  const toggle = document.querySelector("[data-theme-toggle]");
  const meta = document.querySelector('meta[name="theme-color"]');

  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    if (icon) icon.textContent = theme === "dark" ? "☀" : "◐";
    if (toggle) toggle.setAttribute("aria-pressed", String(theme === "dark"));
    if (meta) meta.setAttribute("content", META_COLORS[theme] || META_COLORS.light);
  };

  apply(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  toggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — theme still applies for this page */
    }
    // Pages with theme-dependent embeds (giscus, mermaid) listen for this.
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  });

  const header = document.querySelector("[data-header]");
  if (header) {
    const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
})();
