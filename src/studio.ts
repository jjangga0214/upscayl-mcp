import html from "./web/studio.html" with { type: "text" };
import css from "./web/studio.css" with { type: "text" };
import javascript from "./web/app.js" with { type: "text" };
import zip from "../node_modules/fflate/esm/browser.js" with { type: "text" };
import sample from "./web/rainier.jpg" with { type: "file" };
import sampleResult from "./web/rainier-4x.png" with { type: "file" };

export function studio(path: string) {
  const headers = { "Cache-Control": "no-cache" };
  switch (path) {
    case "/":
      return new Response(String(html), {
        headers: {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
          Link: '</manifest.json>; rel="describedby"; type="application/json", </setup>; rel="help"',
        },
      });
    case "/studio/style.css":
      return new Response(css, {
        headers: { ...headers, "Content-Type": "text/css; charset=utf-8" },
      });
    case "/studio/app.js":
      return new Response(javascript, {
        headers: {
          ...headers,
          "Content-Type": "text/javascript; charset=utf-8",
        },
      });
    case "/studio/zip.js":
      return new Response(String(zip), {
        headers: {
          ...headers,
          "Content-Type": "text/javascript; charset=utf-8",
        },
      });
    case "/studio/sample.jpg":
      return new Response(Bun.file(sample), { headers });
    case "/studio/sample-4x.png":
      return new Response(Bun.file(sampleResult), { headers });
  }
}
