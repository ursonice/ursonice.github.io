// OG share-card generator — DEPLOYED as a val.town HTTP val (owner: ursonice, name: ogImage).
// Live at: https://ursonice--8ca24676580f11f18cd8ee650bb23af1.web.val.run
//
// Renders a 1200x630 PNG with the post title for link previews (KakaoTalk, Slack, X).
// Non-JSX (object syntax) so it runs as a plain main.ts on val.town. The site points at it
// via OG_IMAGE_URL in scripts/gen-post-pages.mjs and assets/js/post.js.
// Query: ?title=<post title>&cat=<category>
//
// To change the card design: edit the `ogImage` val on val.town (paste this file's contents),
// or edit here and re-paste. Korean text uses Pretendard (OFL); swap FONT_URL for another
// Korean TTF/OTF if that CDN URL ever breaks.
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf";

let fontPromise: Promise<ArrayBuffer> | null = null;
const font = () =>
  (fontPromise ??= fetch(FONT_URL).then((r) => {
    if (!r.ok) throw new Error("font fetch " + r.status);
    return r.arrayBuffer();
  }));

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// deno-lint-ignore-file no-explicit-any
const el = (type: string, style: Record<string, any>, children?: any) => ({
  type,
  props: children === undefined ? { style } : { style, children },
});

export default async function (req: Request): Promise<Response> {
  try {
    const u = new URL(req.url);
    const title = clamp((u.searchParams.get("title") || "Woojae Joo").trim(), 80);
    const cat = clamp((u.searchParams.get("cat") || "Notes").trim(), 28);
    const fontData = await font();

    const tree = el(
      "div",
      {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(135deg, #0a0b0e 0%, #11161f 60%, #0d1a2b 100%)",
        color: "#f4f4f6",
      },
      [
        el("div", { display: "flex" }, [
          el(
            "div",
            {
              display: "flex",
              padding: "10px 22px",
              borderRadius: "999px",
              border: "1px solid rgba(90,140,255,0.45)",
              background: "rgba(74,163,255,0.14)",
              color: "#7fb6ff",
              fontSize: 30,
            },
            cat,
          ),
        ]),
        el("div", { display: "flex", fontSize: title.length > 40 ? 64 : 78, lineHeight: 1.18 }, title),
        el("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
          el("div", { display: "flex", flexDirection: "column" }, [
            el("div", { display: "flex", fontSize: 34, color: "#ffffff" }, "Woojae Joo"),
            el("div", { display: "flex", fontSize: 26, color: "#9aa3b2" }, "ursonice.github.io"),
          ]),
          el("div", { display: "flex", width: 120, height: 8, borderRadius: 8, background: "#0a84ff" }),
        ]),
      ],
    );

    return new ImageResponse(tree, {
      width: 1200,
      height: 630,
      fonts: [{ name: "Pretendard", data: fontData, weight: 700, style: "normal" }],
    });
  } catch (err) {
    return new Response("OG error: " + (err instanceof Error ? err.message : String(err)), { status: 500 });
  }
}
