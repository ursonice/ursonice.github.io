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

const readSources = async () => {
  const fromEnv = (process.env.NOTION_DATA_SOURCE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((dataSourceId) => ({ dataSourceId }));

  if (fromEnv.length) return fromEnv;

  const config = await readConfig();
  return config.sources || [];
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

  const payload = {
    generatedAt: new Date().toISOString(),
    site: {
      title: "Woojae Joo — Developer Note",
      description: "AI, Robotics, Systems 공부 기록",
    },
    sources: sources.map(({ name, dataSourceId }) => ({ name, id: dataSourceId })),
    about,
    posts,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Synced ${posts.length} posts (${stats.rendered} re-rendered, ${stats.reused} reused)${about ? " + about page" : ""} to ${OUTPUT}`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
