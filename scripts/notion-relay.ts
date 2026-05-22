// Notion integration webhook -> GitHub repository_dispatch relay.
//
// This file is NOT run from this repo. Deploy it as a public HTTPS endpoint
// (val.town or Cloudflare Workers) and point your Notion integration's webhook
// subscription at it. Notion cannot call GitHub's dispatch API directly because
// GitHub requires an exact JSON body ({"event_type":"notion-sync"}) plus an
// Authorization header, and Notion's webhook body is fixed. This relay bridges
// the two and fires the sync workflow on add / delete / edit in real time.
//
// Setup: see README "실시간 동기화 (노션 → GitHub 즉시 반영)".
//
// Required env var on the relay host:
//   GITHUB_TOKEN  fine-grained PAT for ursonice/ursonice.github.io, Contents: write

const OWNER = "ursonice";
const REPO = "ursonice.github.io";
const EVENT_TYPE = "notion-sync";

// Events that should rebuild the site. Notion sends the event type in body.type.
const TRIGGER_EVENTS = new Set([
  "page.created",
  "page.deleted",
  "page.undeleted",
  "page.moved",
  "page.content_updated",
  "page.properties_updated",
  "data_source.content_updated",
]);

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    // non-JSON body; ignore
  }

  // 1) One-time subscription verification: Notion POSTs a verification_token.
  //    Copy this value from the relay logs into Notion's "Verify" form.
  if (typeof payload.verification_token === "string") {
    console.log("Notion verification_token:", payload.verification_token);
    return new Response(JSON.stringify({ verification_token: payload.verification_token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Real event: only fire the workflow for relevant event types.
  const type = typeof payload.type === "string" ? payload.type : "";
  if (type && !TRIGGER_EVENTS.has(type)) {
    return new Response(`ignored: ${type}`, { status: 200 });
  }

  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return new Response("missing GITHUB_TOKEN", { status: 500 });

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "notion-github-relay",
    },
    body: JSON.stringify({ event_type: EVENT_TYPE }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("dispatch failed:", res.status, text);
    return new Response(`dispatch failed: ${res.status}`, { status: 502 });
  }
  return new Response("dispatched", { status: 200 });
}
