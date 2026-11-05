import html from "./web/studio.html" with { type: "text" };
import css from "../build/web/studio.css" with { type: "file" };
import javascript from "../build/web/main.js" with { type: "file" };
import worker from "../build/web/sw.js" with { type: "text" };
import zip from "../node_modules/fflate/esm/browser.js" with { type: "text" };
import sample from "./web/rainier.jpg" with { type: "file" };
import sampleResult from "./web/rainier-4x.png" with { type: "file" };
import { version } from "../package.json";
import type { desktopAssets } from "./desktop-assets";

import { localized, type Locale } from "./locale";
const appManifest = {
  id: "/app",
  start_url: "/app",
  scope: "/",
  name: "Upscayl",
  short_name: "Upscayl",
  display: "standalone",
  theme_color: "#1d293b",
  background_color: "#101827",
  icons: [192, 512].map((size) => ({
    src: "/studio/icon-" + size + ".png",
    type: "image/png",
    sizes: size + "x" + size,
    purpose: "any",
  })),
};
export const discoveryLinks =
  '</manifest.json>; rel="describedby"; type="application/json", </llms.txt>; rel="alternate"; type="text/markdown", </app>; rel="alternate"; type="text/html"';
export function studio(
  path: string,
  assets: ReturnType<typeof desktopAssets>,
  locale: Locale,
) {
  const t = localized(locale);
  const languageHeaders = {
    "Content-Language": locale,
    Vary: "Accept-Language",
  };
  const headers = { "Cache-Control": "no-cache" };
  const serve = (body: BodyInit, type: string) =>
    new Response(body, { headers: { ...headers, "Content-Type": type } });
  const asset = assets.files.get(path);
  if (asset) return serve(asset, asset.type);
  switch (path) {
    case "/":
    case "/app":
      return new Response(
        String(html)
          .replace("__LANG__", locale)
          .replace(
            "__NOSCRIPT__",
            t(
              "Enable JavaScript to use Upscayl.",
              "Upscayl을 사용하려면 JavaScript를 켜세요.",
            ),
          )
          .replace("__SETUP__", t("Setup", "연결 및 설치"))
          .replace(
            "__DESKTOP_VERSION__",
            assets.version.replace(/[^a-z0-9. +-]/gi, ""),
          ),
        {
          headers: {
            ...headers,
            "Content-Type": "text/html; charset=utf-8",
            ...languageHeaders,
            Link: discoveryLinks,
          },
        },
      );
    case "/studio/style.css":
      return serve(Bun.file(css), "text/css; charset=utf-8");
    case "/studio/app.js":
      return serve(Bun.file(javascript), "text/javascript; charset=utf-8");
    case "/studio/zip.js":
      return serve(String(zip), "text/javascript; charset=utf-8");
    case "/app.webmanifest":
      return Response.json(
        {
          ...appManifest,
          lang: locale,
          description: t(
            "Upscale photos and illustrations on your home server.",
            "홈 서버에서 사진과 일러스트를 업스케일합니다.",
          ),
        },
        {
          headers: {
            ...headers,
            ...languageHeaders,
            "Content-Type": "application/manifest+json",
          },
        },
      );
    case "/sw.js": {
      const shell = [
        "/studio/style.css",
        "/studio/app.js",
        ...[...assets.files.keys()].filter(
          (key) => !key.startsWith("/studio/models/"),
        ),
      ];
      return serve(
        worker
          .replace("__SHELL__", JSON.stringify(shell))
          .replace("__REVISION__", version + "-" + assets.version),
        "text/javascript; charset=utf-8",
      );
    }
    case "/studio/sample.jpg":
      return new Response(Bun.file(sample), { headers });
    case "/studio/sample-4x.png":
      return new Response(Bun.file(sampleResult), { headers });
  }
}
