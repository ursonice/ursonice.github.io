import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
const OUTPUT = process.env.NOTION_OUTPUT || "data/notion-posts.json";
const ASSET_DIR = process.env.NOTION_ASSET_DIR || "assets/notion";
const SOURCE_CONFIG = process.env.NOTION_SOURCE_CONFIG || "notion.sources.json";
const PAGE_SIZE = Number(process.env.NOTION_PAGE_SIZE || 100);
const TITLE_PROP = process.env.NOTION_TITLE_PROPERTY || "이름";
const TAG_PROP = process.env.NOTION_TAG_PROPERTY || "Tag";
const SUMMARY_PROP = process.env.NOTION_SUMMARY_PROPERTY || "Summary";
const SLUG_PROP = process.env.NOTION_SLUG_PROPERTY || "Slug";
const SERIES_PROP = process.env.NOTION_SERIES_PROPERTY || "Series";
const SERIES_ORDER_PROP = process.env.NOTION_SERIES_ORDER_PROPERTY || "SeriesOrder";
const STATUS_PROP = process.env.NOTION_STATUS_PROPERTY || "";
const PUBLISHED_STATUS = process.env.NOTION_PUBLISHED_STATUS || "Published";
const ABOUT_PAGE_ID = process.env.NOTION_ABOUT_PAGE_ID || "";
const FORCE_FULL = ["1", "true", "yes"].includes((process.env.NOTION_FORCE_FULL || "").toLowerCase());

const stats = { rendered: 0, reused: 0 };

if (!TOKEN) {
  throw new Error("NOTION_TOKEN 또는 NOTION_API_KEY 환경 변수가 필요합니다.");
}

const notion = async (path, init = {}) => {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
};

// Auto-discover every database/data source the integration can access via Notion search,
// so a DB newly created (and shared with the integration) shows up without editing config.
// Fail-soft: any error here just falls back to the explicitly-configured sources.
const discoverSources = async () => {
  const found = [];
  const seenTypes = {};
  let cursor;
  try {
    do {
      const res = await notion("/search", {
        method: "POST",
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      for (const item of res.results || []) {
        seenTypes[item.object] = (seenTypes[item.object] || 0) + 1;
        if (item.object === "data_source") {
          found.push({ dataSourceId: item.id, name: textFromRich(item.title || []) });
        } else if (item.object === "database") {
          // The search result may or may not include data_sources — fetch the DB if not.
          let dses = Array.isArray(item.data_sources) ? item.data_sources : null;
          if (!dses) {
            try {
              const db = await notion(`/databases/${item.id}`);
              dses = db.data_sources || [];
            } catch (e) {
              console.warn(`  db ${item.id} fetch failed: ${e.message}`);
              dses = [];
            }
          }
          for (const ds of dses) {
            found.push({ dataSourceId: ds.id, name: ds.name || textFromRich(item.title || []) });
          }
        }
      }
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);
    console.log(
      `auto-discovery: search objects ${JSON.stringify(seenTypes)} → ${found.length} data sources [${found
        .map((s) => s.name || s.dataSourceId)
        .join(", ")}]`,
    );
  } catch (error) {
    console.warn(`source auto-discovery skipped: ${error.message}`);
  }
  return found;
};

const readSources = async () => {
  const fromEnv = (process.env.NOTION_DATA_SOURCE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((dataSourceId) => ({ dataSourceId }));
  const config = await readConfig();
  const configured = fromEnv.length ? fromEnv : config.sources || [];

  // Union of configured + auto-discovered (dedup by id; an explicit config name wins).
  const byId = new Map();
  for (const s of configured) if (s.dataSourceId) byId.set(s.dataSourceId, s);
  for (const s of await discoverSources()) {
    if (s.dataSourceId && !byId.has(s.dataSourceId)) byId.set(s.dataSourceId, s);
  }
  const all = [...byId.values()];
  console.log(`sources total: ${all.length} → [${all.map((s) => s.name || s.dataSourceId).join(", ")}]`);
  return all;
};

let configCache;
const readConfig = async () => {
  if (configCache) return configCache;
  try {
    configCache = JSON.parse(await readFile(SOURCE_CONFIG, "utf8"));
  } catch {
    configCache = {};
  }
  return configCache;
};

const readAboutPageId = async () => {
  if (ABOUT_PAGE_ID) return ABOUT_PAGE_ID.replace(/-/g, "");
  const config = await readConfig();
  const id = config.about?.pageId || "";
  return id ? id.replace(/-/g, "") : "";
};

const textFromRich = (items = []) => items.map((item) => item.plain_text || item.text?.content || "").join("");

const propertyValue = (properties, name) => properties?.[name];

const titleFromPage = (page) => {
  const title = propertyValue(page.properties, TITLE_PROP);
  if (title?.type === "title") return textFromRich(title.title);
  const fallback = Object.values(page.properties || {}).find((prop) => prop.type === "title");
  return fallback ? textFromRich(fallback.title) : "Untitled";
};

const tagsFromPage = (page) => {
  const prop = propertyValue(page.properties, TAG_PROP);
  if (!prop) return [];
  if (prop.type === "multi_select") return prop.multi_select.map((item) => item.name);
  if (prop.type === "select" && prop.select) return [prop.select.name];
  if (prop.type === "status" && prop.status) return [prop.status.name];
  return [];
};

const summaryFromPage = (page, plainText) => {
  const prop = propertyValue(page.properties, SUMMARY_PROP);
  if (prop?.type === "rich_text") return textFromRich(prop.rich_text);
  if (prop?.type === "title") return textFromRich(prop.title);
  return plainText.replace(/\s+/g, " ").slice(0, 170);
};

const slugify = (value) =>
  value
    .toString()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase()
    .slice(0, 80);

const slugFromPage = (page, title) => {
  const prop = propertyValue(page.properties, SLUG_PROP);
  if (prop?.type === "rich_text") {
    const value = textFromRich(prop.rich_text).trim();
    if (value) return slugify(value);
  }
  return slugify(title || page.id);
};

// Series grouping: read an optional "Series" (text/select) + "SeriesOrder" (number) property.
const seriesFromPage = (page) => {
  const prop = propertyValue(page.properties, SERIES_PROP);
  if (!prop) return null;
  if (prop.type === "select") return prop.select?.name || null;
  if (prop.type === "multi_select") return prop.multi_select?.[0]?.name || null;
  if (prop.type === "rich_text") return textFromRich(prop.rich_text).trim() || null;
  return null;
};

const seriesOrderFromPage = (page) => {
  const prop = propertyValue(page.properties, SERIES_ORDER_PROP);
  return prop?.type === "number" && typeof prop.number === "number" ? prop.number : null;
};

const isPublished = (page) => {
  if (!STATUS_PROP) return true;
  const prop = propertyValue(page.properties, STATUS_PROP);
  if (!prop) return true;
  const value = prop.status?.name || prop.select?.name || textFromRich(prop.rich_text || []);
  return value === PUBLISHED_STATUS;
};

const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Track the page currently being rendered so in-page Notion links (e.g. a manual
// table of contents) become same-page anchors instead of links back to Notion.
let currentPageId = "";

const normalizeId = (value = "") => value.replace(/-/g, "").toLowerCase();
const headingAnchor = (blockId) => `block-${normalizeId(blockId)}`;

// Map Notion code-language names to highlight.js identifiers.
const HLJS_LANG = {
  "c++": "cpp",
  "c#": "csharp",
  "objective-c": "objectivec",
  shell: "bash",
  "plain text": "plaintext",
  "f#": "fsharp",
  "visual basic": "vbnet",
};
const codeLangClass = (lang) => (lang ? `language-${HLJS_LANG[lang.toLowerCase()] || lang.toLowerCase()}` : "");

const inPageAnchor = (href = "") => {
  const hashIndex = href.indexOf("#");
  if (hashIndex < 0) return null;
  const frag = normalizeId(href.slice(hashIndex + 1));
  if (!/^[0-9a-f]{32}$/.test(frag)) return null;
  const before = normalizeId(href.slice(0, hashIndex));
  const page = normalizeId(currentPageId);
  if (before && page && !before.includes(page)) return null;
  return `block-${frag}`;
};

const renderRich = (items = []) =>
  items
    .map((item) => {
      if (item.type === "equation" && item.equation?.expression) {
        return `\\(${escapeHtml(item.equation.expression)}\\)`;
      }
      const text = escapeHtml(item.plain_text || item.text?.content || "");
      const href = item.href || item.text?.link?.url;
      let html = text;
      if (href) {
        const anchor = inPageAnchor(href);
        html = anchor
          ? `<a href="#${anchor}">${text}</a>`
          : `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${text}</a>`;
      }
      const a = item.annotations || {};
      if (a.code) html = `<code>${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.underline) html = `<u>${html}</u>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      return html;
    })
    .join("");

const extensionFrom = (url, contentType) => {
  const pathname = new URL(url).pathname;
  const ext = pathname.split(".").pop()?.toLowerCase();
  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "jpg";
};

const downloadImage = async (url, pageSlug, blockId) => {
  const safeBlockId = blockId.replace(/[^a-zA-Z0-9-]/g, "");
  const dir = `${ASSET_DIR}/${pageSlug}`;

  try {
    const existing = (await readdir(dir)).find((file) => file.startsWith(`${safeBlockId}.`));
    if (existing) return `${dir}/${existing}`;
  } catch {
    // directory not created yet — fall through to download
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`image download failed: ${response.status} ${url}`);
  const contentType = response.headers.get("content-type") || "";
  const ext = extensionFrom(url, contentType);
  const output = `${dir}/${safeBlockId}.${ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  return output;
};

const childrenOf = async (blockId) => {
  const children = [];
  let cursor;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data = await notion(`/blocks/${blockId}/children?${qs.toString()}`);
    children.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return children;
};

const renderBlocks = async (blockId, context) => {
  const blocks = await childrenOf(blockId);
  const html = [];
  const plain = [];

  const renderListItem = async (block) => {
    const value = block[block.type] || {};
    const rich = value.rich_text || [];
    const itemText = textFromRich(rich);
    if (itemText) plain.push(itemText);

    let inner = renderRich(rich);
    if (block.type === "to_do") {
      inner = `<input type="checkbox" disabled${value.checked ? " checked" : ""} /> <span>${inner}</span>`;
    }

    let childHtml = "";
    if (block.has_children) {
      const nested = await renderBlocks(block.id, context);
      childHtml = nested.html;
      plain.push(nested.plainText);
    }
    return `<li>${inner}${childHtml}</li>`;
  };

  const renderContainerChildren = async (block) => {
    if (!block.has_children) return "";
    const nested = await renderBlocks(block.id, context);
    plain.push(nested.plainText);
    return nested.html;
  };

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const type = block.type;
    const value = block[type] || {};
    const rich = value.rich_text || [];

    // Group consecutive list items of the same type into one list.
    if (type === "bulleted_list_item" || type === "numbered_list_item" || type === "to_do") {
      const tag = type === "numbered_list_item" ? "ol" : "ul";
      const cls = type === "to_do" ? ' class="todo-list"' : "";
      const items = [];
      while (i < blocks.length && blocks[i].type === type) {
        items.push(await renderListItem(blocks[i]));
        i += 1;
      }
      html.push(`<${tag}${cls}>${items.join("")}</${tag}>`);
      continue;
    }

    const text = textFromRich(rich);
    if (text) plain.push(text);

    switch (type) {
      case "paragraph":
        if (rich.length) html.push(`<p>${renderRich(rich)}</p>`);
        break;
      case "heading_1":
      case "heading_2":
        html.push(`<h2 id="${headingAnchor(block.id)}">${renderRich(rich)}</h2>`);
        break;
      case "heading_3":
        html.push(`<h3 id="${headingAnchor(block.id)}">${renderRich(rich)}</h3>`);
        break;
      case "quote":
        html.push(`<blockquote>${renderRich(rich)}${await renderContainerChildren(block)}</blockquote>`);
        break;
      case "callout": {
        const icon = value.icon?.emoji ? `<span class="callout-icon">${escapeHtml(value.icon.emoji)}</span>` : "";
        html.push(
          `<div class="callout">${icon}<div class="callout-body">${renderRich(rich)}${await renderContainerChildren(block)}</div></div>`,
        );
        break;
      }
      case "toggle":
        html.push(
          `<details class="toggle"><summary>${renderRich(rich)}</summary><div class="toggle-body">${await renderContainerChildren(block)}</div></details>`,
        );
        break;
      case "code": {
        const lang = value.language || "";
        const codeClass = codeLangClass(lang);
        html.push(
          `<pre data-lang="${escapeHtml(lang)}"><code${codeClass ? ` class="${codeClass}"` : ""}>${escapeHtml(text)}</code></pre>`,
        );
        break;
      }
      case "equation":
        if (value.expression) html.push(`<div class="math-block">\\[${escapeHtml(value.expression)}\\]</div>`);
        break;
      case "divider":
        html.push("<hr />");
        break;
      case "image": {
        const src = value.external?.url || value.file?.url;
        if (src) {
          let stableSrc = src;
          if (value.file?.url) {
            try {
              stableSrc = await downloadImage(src, context.pageSlug, block.id);
            } catch (error) {
              console.warn(`image skipped (${block.id}): ${error.message}`);
            }
          }
          const caption = textFromRich(value.caption || []);
          html.push(
            `<figure><img src="${escapeHtml(stableSrc)}" alt="${escapeHtml(caption)}" loading="lazy" />${
              caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""
            }</figure>`,
          );
        }
        break;
      }
      case "table": {
        const rows = await childrenOf(block.id);
        const headerRow = value.has_column_header;
        const trs = rows
          .map((row, idx) => {
            const cells = (row.table_row?.cells || [])
              .map((cell) => {
                const cellHtml = renderRich(cell);
                return headerRow && idx === 0 ? `<th>${cellHtml}</th>` : `<td>${cellHtml}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        html.push(`<div class="table-wrap"><table>${trs}</table></div>`);
        break;
      }
      case "column_list": {
        const columns = await childrenOf(block.id);
        const cols = [];
        for (const column of columns) {
          const nested = await renderBlocks(column.id, context);
          plain.push(nested.plainText);
          cols.push(`<div class="column">${nested.html}</div>`);
        }
        html.push(`<div class="columns">${cols.join("")}</div>`);
        break;
      }
      case "bookmark":
      case "embed":
      case "link_preview":
        if (value.url) {
          html.push(`<p><a href="${escapeHtml(value.url)}" target="_blank" rel="noreferrer">${escapeHtml(value.url)}</a></p>`);
        }
        break;
      case "video":
      case "file":
      case "pdf": {
        const src = value.external?.url || value.file?.url;
        if (src) {
          const label = textFromRich(value.caption || []) || src;
          html.push(`<p><a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></p>`);
        }
        break;
      }
      case "child_page":
      case "child_database":
        break;
      default:
        if (block.has_children) html.push(await renderContainerChildren(block));
        break;
    }
    i += 1;
  }

  return { html: html.join("\n"), plainText: plain.join(" ") };
};

const queryDataSource = async (source, cache) => {
  const sourceMeta = await notion(`/data_sources/${source.dataSourceId}`);
  const posts = [];
  let cursor;

  do {
    const body = {
      page_size: PAGE_SIZE,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notion(`/data_sources/${source.dataSourceId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const page of data.results || []) {
      try {
        if (!isPublished(page)) continue;

        // Incremental: reuse the cached post if Notion's last edit hasn't changed.
        const cached = cache.get(page.id);
        if (cached && !FORCE_FULL && cached.updated === page.last_edited_time) {
          stats.reused += 1;
          posts.push(cached);
          continue;
        }
        stats.rendered += 1;

        const title = titleFromPage(page);
        const pageSlug = slugFromPage(page, title);
        currentPageId = page.id;
        const rendered = await renderBlocks(page.id, { pageSlug });
        const tags = tagsFromPage(page);
        const category = source.name || textFromRich(sourceMeta.title || []) || "Notes";
        const summary = summaryFromPage(page, rendered.plainText);

        const series = seriesFromPage(page);
        posts.push({
          id: page.id,
          title,
          slug: pageSlug,
          category,
          tags,
          created: page.created_time,
          updated: page.last_edited_time,
          readingTime: Math.max(1, Math.round(rendered.plainText.length / 600)),
          summary,
          sourceUrl: page.url,
          html: rendered.html,
          ...(series ? { series, seriesOrder: seriesOrderFromPage(page) } : {}),
        });
      } catch (error) {
        console.warn(`page skipped (${page.id}): ${error.message}`);
      }
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return posts;
};

const fetchAbout = async (cachedAbout) => {
  const pageId = await readAboutPageId();
  if (!pageId) return null;

  const page = await notion(`/pages/${pageId}`);
  if (cachedAbout && !FORCE_FULL && cachedAbout.updated === page.last_edited_time) {
    return cachedAbout;
  }
  const title = titleFromPage(page);
  currentPageId = pageId;
  const rendered = await renderBlocks(pageId, { pageSlug: "about" });

  // Profile photo: use the About page's icon if it's an uploaded/external image.
  let avatar = null;
  const iconUrl =
    page.icon?.type === "file" ? page.icon.file?.url
    : page.icon?.type === "external" ? page.icon.external?.url
    : null;
  if (iconUrl) {
    try {
      avatar = await downloadImage(iconUrl, "about", "avatar");
    } catch (error) {
      console.warn(`about avatar skipped: ${error.message}`);
    }
  }

  return {
    title,
    html: rendered.html,
    avatar,
    updated: page.last_edited_time,
  };
};

// Read contact/profile links from a dedicated Notion "Profile" page whose body is
// a bulleted list of "key: value" items (Email / LinkedIn / GitHub). Links use the
// item's hyperlink target when present.
const fetchProfile = async () => {
  const config = await readConfig();
  const id = (config.profile?.pageId || "").replace(/-/g, "");
  if (!id) return null;

  const blocks = await childrenOf(id);
  const profile = {};
  for (const block of blocks) {
    if (block.type !== "bulleted_list_item") continue;
    const rich = block.bulleted_list_item.rich_text || [];
    const text = textFromRich(rich);
    const href = rich.map((r) => r.href || r.text?.link?.url).find(Boolean);
    const idx = text.indexOf(":");
    if (idx < 0) continue;
    const key = text.slice(0, idx).trim().toLowerCase();
    const val = text.slice(idx + 1).trim();
    if (key === "email") profile.email = (val || href || "").replace(/^mailto:/, "");
    else if (key === "linkedin") profile.linkedin = (href || val || "").replace(/^http:\/\//, "https://");
    else if (key === "github") profile.github = href || val;
  }
  return Object.keys(profile).length ? profile : null;
};

const readExistingOutput = async () => {
  try {
    return JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    return {};
  }
};

const main = async () => {
  const sources = await readSources();
  const existing = await readExistingOutput();
  const cache = new Map((existing.posts || []).map((post) => [post.id, post]));

  const nestedPosts = [];
  for (const source of sources) {
    try {
      nestedPosts.push(await queryDataSource(source, cache));
    } catch (error) {
      console.warn(`source skipped (${source.name || source.dataSourceId}): ${error.message}`);
    }
  }

  const posts = nestedPosts
    .flat()
    .sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));

  let about = null;
  try {
    about = await fetchAbout(existing.about || null);
  } catch (error) {
    console.warn(`about skipped: ${error.message}`);
  }

  let profile = null;
  try {
    profile = await fetchProfile();
  } catch (error) {
    console.warn(`profile skipped: ${error.message}`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    site: {
      title: "Woojae Joo — Developer Note",
      description: "AI, Robotics, Systems 공부 기록",
    },
    sources: sources.map(({ name, dataSourceId }) => ({ name, id: dataSourceId })),
    about,
    profile: profile || existing.profile || null,
    posts,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Synced ${posts.length} posts (${stats.rendered} re-rendered, ${stats.reused} reused)${about ? " + about page" : ""} to ${OUTPUT}`,
  );

  // --- RSS feed + sitemap (regenerated each sync) ---
  const SITE = process.env.SITE_URL || "https://ursonice.github.io";
  const xmlEsc = (s = "") =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  const postUrl = (p) => `${SITE}/posts/${encodeURIComponent((p.slug || "").normalize("NFC"))}/`;

  const items = posts
    .slice(0, 30)
    .map(
      (p) =>
        `    <item>\n      <title>${xmlEsc(p.title)}</title>\n      <link>${xmlEsc(postUrl(p))}</link>\n      <guid isPermaLink="false">${p.id}</guid>\n      <pubDate>${new Date(p.created || p.updated).toUTCString()}</pubDate>\n      <category>${xmlEsc(p.category || "Notes")}</category>\n      <description>${xmlEsc(p.summary || "")}</description>\n    </item>`,
    )
    .join("\n");
  const feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${xmlEsc(payload.site.title)}</title>\n    <link>${SITE}/</link>\n    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n    <description>${xmlEsc(payload.site.description)}</description>\n    <language>ko</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>\n`;
  await writeFile("feed.xml", feed);

  const urlEntries = [
    `  <url><loc>${SITE}/</loc></url>`,
    ...posts.map(
      (p) =>
        `  <url><loc>${xmlEsc(postUrl(p))}</loc><lastmod>${new Date(p.updated || p.created).toISOString().slice(0, 10)}</lastmod></url>`,
    ),
  ].join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  await writeFile("sitemap.xml", sitemap);
  console.log(`Wrote feed.xml (${Math.min(30, posts.length)} items) + sitemap.xml (${posts.length + 1} urls)`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
