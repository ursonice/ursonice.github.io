/** @jsxImportSource https://esm.sh/react@18.2.0 */
//
// OG share-card generator — deploy this as a val.town HTTP val (Deno).
//
// It returns a 1200×630 PNG with the post title rendered on a branded card, so link
// previews (KakaoTalk, Slack, X, Facebook) show the title instead of the first in-body
// image. Mirrors the existing val.town pieces (notionRelay, view-counter).
//
// ── Deploy ───────────────────────────────────────────────────────────────────────
// 1. https://www.val.town → New → HTTP val. Paste this whole file. Name it e.g. `ogImage`.
// 2. Save. Open the val's public URL in a browser with a test query:
//      https://<you>-ogimage.web.val.run/?title=테스트%20제목&cat=AI
//    You should see a PNG card. (First request is slow — it fetches the font once.)
// 3. Once it works, set that base URL (without query) as the site's OG_IMAGE_URL:
//      • scripts/gen-post-pages.mjs  → OG_IMAGE_URL env var (a GitHub Actions repo
//        Variable named OG_IMAGE_URL is the cleanest), and/or edit the constant.
//      • assets/js/post.js           → const OG_IMAGE_URL = "https://<you>-ogimage.web.val.run/";
//    The next Notion sync regenerates /posts/ pages with og:image pointing at the card.
//
// Query params: ?title=<post title>&cat=<category>. Both are URL-encoded by the site.
//
// Note: the Korean font below is Pretendard (OFL). If the URL ever 404s, swap it for any
// reliable Korean-capable TTF/OTF — satori needs the actual font bytes to draw Hangul.

import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf";

// Fetch the font once per warm instance (not on every request).
let fontPromise: Promise<ArrayBuffer> | null = null;
const font = () => (fontPromise ??= fetch(FONT_URL).then((r) => {
  if (!r.ok) throw new Error(`font fetch failed: ${r.status}`);
  return r.arrayBuffer();
}));

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export default async function (req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const title = clamp((searchParams.get("title") || "Woojae Joo").trim(), 80);
    const cat = clamp((searchParams.get("cat") || "Notes").trim(), 28);
    const fontData = await font();

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 80px",
            background: "linear-gradient(135deg, #0a0b0e 0%, #11161f 60%, #0d1a2b 100%)",
            color: "#f4f4f6",
          }}
        >
          {/* top row: category chip */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: "999px",
                border: "1px solid rgba(90,140,255,0.45)",
                background: "rgba(74,163,255,0.14)",
                color: "#7fb6ff",
                fontSize: 30,
              }}
            >
              {cat}
            </div>
          </div>

          {/* title */}
          <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 78, lineHeight: 1.18 }}>
            {title}
          </div>

          {/* bottom row: brand + accent rule */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 34, color: "#ffffff" }}>Woojae Joo</div>
              <div style={{ display: "flex", fontSize: 26, color: "#9aa3b2" }}>
                ursonice.github.io
              </div>
            </div>
            <div style={{ display: "flex", width: 120, height: 8, borderRadius: 8, background: "#0a84ff" }} />
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }],
        headers: { "cache-control": "public, max-age=86400, immutable" },
      },
    );
  } catch (err) {
    return new Response(`OG image error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
}
