// Notion-backed comments API for the blog. Deployed on val.town (NOT run from this repo).
//
//   GET  ?postId=<notion_page_id>   -> { comments: [{ id, name, body, created }] }
//   POST { postId, name, body }     -> creates a Notion comment on that page
//
// Comments are stored as Notion page comments and moderated in Notion (delete / resolve).
// Visitor comments (created by this integration/bot) store the name on the first line.
// Replies you write directly in Notion are authored by a person and shown as "Woojae Joo".
//
// Required env var: NOTION_TOKEN (integration with read + insert comment capability;
// each post page must be shared with the integration — they already are via sync).
//
// Security: comment read/create only; CORS limited to the site origin; length caps + honeypot.

const NOTION_VERSION = "2022-06-28";
const ALLOW_ORIGIN = "https://ursonice.github.io";
const OWNER_NAME = "Woojae Joo";

const cors = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const notion = async (path, init = {}) => {
  const res = await fetch("https://api.notion.com/v1" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + Deno.env.get("NOTION_TOKEN"),
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  return { ok: res.ok, status: res.status, data };
};

const isPageId = (s) => /^[0-9a-f]{32}$/.test((s || "").replace(/-/g, ""));

export default async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);

  if (req.method === "GET") {
    const postId = url.searchParams.get("postId") || "";
    if (!isPageId(postId)) return json({ error: "bad postId" }, 400);

    const comments = [];
    let cursor;
    do {
      const qs = new URLSearchParams({ block_id: postId, page_size: "100" });
      if (cursor) qs.set("start_cursor", cursor);
      const r = await notion("/comments?" + qs.toString());
      if (!r.ok) break;
      for (const c of r.data.results || []) {
        const raw = (c.rich_text || []).map((t) => t.plain_text || "").join("");
        let name = OWNER_NAME;
        let body = raw;
        if (c.created_by && c.created_by.type !== "person") {
          const nl = raw.indexOf("\n");
          if (nl >= 0) { name = raw.slice(0, nl).trim() || "익명"; body = raw.slice(nl + 1); }
          else { name = "익명"; body = raw; }
        }
        comments.push({ id: c.id, name, body, created: c.created_time });
      }
      cursor = r.data.has_more ? r.data.next_cursor : undefined;
    } while (cursor);

    return json({ comments });
  }

  if (req.method === "POST") {
    let payload = {};
    try { payload = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
    if (payload.website) return json({ ok: true });

    const postId = String(payload.postId || "");
    const name = String(payload.name || "익명").trim().slice(0, 40) || "익명";
    const body = String(payload.body || "").trim().slice(0, 2000);
    if (!isPageId(postId)) return json({ error: "bad postId" }, 400);
    if (!body) return json({ error: "empty body" }, 400);

    const content = name + "\n" + body;
    const r = await notion("/comments", {
      method: "POST",
      body: JSON.stringify({ parent: { page_id: postId }, rich_text: [{ text: { content } }] }),
    });
    if (!r.ok) return json({ error: "notion error", status: r.status, detail: r.data && r.data.message }, 502);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}
