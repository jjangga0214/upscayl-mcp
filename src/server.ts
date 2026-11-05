import { rm } from "node:fs/promises";
import { engine, optionsSchema } from "./engine";
import { Jobs, maxUpload } from "./jobs";
import { handleMcp } from "./mcp";
import { studio, discoveryLinks } from "./studio";
import { agentGuide, rootFormat } from "./discovery";
import { desktopAssets } from "./desktop-assets";
import { builtins, describeModel } from "./catalog";
import { httpsSettings } from "./tls";
import { home } from "./home";
import { comparison } from "./compare";
import { download, manifest } from "./assets";
import { privateIPv4 } from "./network";
import { version } from "../package.json";
import { z } from "zod";

import { selectLocale } from "./locale";
const requestSettings = z
  .object({ file_id: z.string().uuid(), options: optionsSchema.optional() })
  .strict();
const text = (message: string, status: number) =>
  Response.json({ error: message }, { status });
export async function serve(host: string, port: number) {
  const jobs = await Jobs.create(engine());
  const assets = desktopAssets(jobs.backend.bin, jobs.root);
  let secure: ReturnType<typeof httpsSettings>;
  const plain = new URL("http://" + host + ":" + port).origin;
  const listen = (
    base: string,
    listenPort: number,
    tls?: { cert: Buffer; key: Buffer },
  ) => {
    const manifests = { en: manifest(base, "en"), ko: manifest(base, "ko") };
    return Bun.serve({
      hostname: host,
      port: listenPort,
      tls,
      maxRequestBodySize: maxUpload,
      idleTimeout: 60,
      async fetch(req, server) {
        const url = new URL(req.url);
        const origin = req.headers.get("origin");
        const peer = server.requestIP(req)?.address ?? "";
        if (
          !privateIPv4(peer.replace(/^::ffff:/, "")) ||
          req.headers.get("host") !== url.host ||
          url.origin !== base ||
          (origin && origin !== base)
        )
          return text("Unrecognized LAN address, Host or Origin.", 403);
        const p = url.pathname;
        const locale = selectLocale(req.headers.get("accept-language"));
        const info = manifests[locale];
        const languageHeaders = {
          "Content-Language": locale,
          Vary: "Accept-Language",
        };
        try {
          if (Date.now() >= jobs.nextExpiry) await jobs.expire();
          if (p === "/mcp") {
            if (req.method !== "POST")
              return new Response(null, {
                status: 405,
                headers: { Allow: "POST" },
              });
            return await handleMcp(req, jobs, locale);
          }
          if (req.method === "GET" || req.method === "HEAD") {
            if (p === "/" || p === "/llms.txt") {
              const format =
                p === "/llms.txt" ? "markdown" : rootFormat(req.headers);
              const headers = {
                ...languageHeaders,
                Vary: "Accept, Sec-Fetch-Mode, Sec-Fetch-Dest, User-Agent, Accept-Language",
                Link: discoveryLinks,
                "Cache-Control": "no-cache",
              };
              if (format === "json") return Response.json(info, { headers });
              if (format === "markdown")
                return new Response(agentGuide(info, locale), {
                  headers: {
                    ...headers,
                    "Content-Type": "text/markdown; charset=utf-8",
                  },
                });
              if (format === "guideHtml")
                return new Response(home(info, secure, locale), {
                  headers: {
                    ...headers,
                    "Content-Type": "text/html; charset=utf-8",
                  },
                });
              const app = studio("/", assets, locale)!;
              app.headers.set("Vary", headers.Vary);
              return app;
            }
            const page = studio(p, assets, locale);
            if (page) return page;
            if (p === "/setup")
              return new Response(home(info, secure, locale), {
                headers: {
                  "Content-Type": "text/html; charset=utf-8",
                  ...languageHeaders,
                  Link: discoveryLinks,
                },
              });
            if (p === "/pwa-ca.cer" && secure?.ca)
              return new Response(new Uint8Array(secure.ca.raw), {
                headers: {
                  "Content-Type": "application/pkix-cert",
                  "Content-Disposition":
                    'attachment; filename="upscayl-lan-ca.cer"',
                },
              });
            if (p === "/manifest.json")
              return Response.json(info, { headers: languageHeaders });
            if (p === "/health")
              return Response.json({
                name: info.name,
                version,
                base,
                pwa: secure?.url,
                ca_sha256: secure?.ca?.fingerprint256,
                pid: process.pid,
              });
            if (p === "/models")
              return Response.json(
                [
                  ...new Set([
                    ...Object.keys(builtins),
                    ...jobs.backend.models.keys(),
                  ]),
                ]
                  .filter((id) => jobs.backend.models.has(id))
                  .map((id) => ({
                    id,
                    nativeScale: jobs.backend.models.get(id)!.nativeScale,
                    ...describeModel(id, locale),
                    preview: assets.previews.includes(id),
                  })),
                { headers: languageHeaders },
              );
            if (p.startsWith("/downloads/")) return download(p.slice(11));
          }
          if (req.method === "POST" && p === "/files") {
            if (
              req.headers.get("content-type")?.split(";")[0] !==
              "application/octet-stream"
            )
              return text("Send image bytes as application/octet-stream.", 415);
            return Response.json(await jobs.receive(req), { status: 201 });
          }
          if (req.method === "POST" && (p === "/jobs" || p === "/explain")) {
            if (
              req.headers.get("content-type")?.split(";")[0] !==
              "application/json"
            )
              return text("Expected application/json.", 415);
            const { file_id, options } = requestSettings.parse(
              await req.json(),
            );
            const opt = optionsSchema.parse(options ?? {});
            return Response.json(
              p === "/jobs"
                ? jobs.submit([file_id], opt)[0]
                : jobs.explain(file_id, opt),
              { status: p === "/jobs" ? 202 : 200 },
            );
          }
          const fileId = p.match(/^\/files\/([0-9a-f-]{36})$/)?.[1];
          if (fileId && req.method === "DELETE") {
            if (
              [...jobs.jobs.values()].some(
                (j) =>
                  j.fileId === fileId &&
                  (j.status === "queued" || j.status === "running"),
              )
            )
              return text("File in use.", 409);
            const file = jobs.uploads.get(fileId);
            jobs.uploads.delete(fileId);
            if (file) await rm(file.path, { force: true });
            return new Response(null, { status: 204 });
          }
          const match = p.match(
            /^\/jobs\/([0-9a-f-]{36})(?:\/(result|cancel|original|compare))?$/,
          );
          if (match) {
            const [, id, action] = match;
            const job = jobs.jobs.get(id);
            if (!job) return text("Unknown job.", 404);
            if (req.method === "GET" && !action)
              return Response.json(jobs.view(id));
            if (req.method === "POST" && action === "cancel")
              return Response.json(jobs.cancel(id));
            if (req.method === "DELETE" && !action) {
              await jobs.release(id);
              return new Response(null, { status: 204 });
            }
            if (req.method === "GET" && action === "original") {
              const source = jobs.uploads.get(job.fileId);
              return source
                ? new Response(Bun.file(source.path), {
                    headers: { "Cache-Control": "no-store" },
                  })
                : text("Source released.", 404);
            }
            if (
              req.method === "GET" &&
              action === "compare" &&
              job.status === "done"
            )
              return new Response(comparison("original", "result", locale), {
                headers: {
                  ...languageHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "no-store",
                },
              });
            if (req.method === "GET" && action === "result") {
              if (job.status !== "done")
                return text("Result not available.", 409);
              return new Response(Bun.file(jobs.resultPath(job)), {
                headers: { "Cache-Control": "no-store" },
              });
            }
          }
          return text("Unknown route.", 404);
        } catch (err) {
          return text(err instanceof Error ? err.message : String(err), 400);
        }
      },
    });
  };
  const web = listen(plain, port);
  let https: typeof web | undefined;
  try {
    secure = httpsSettings(host, port);
    if (secure) https = listen(secure.url, secure.port, secure.tls);
  } catch (error) {
    secure = undefined;
    console.error(
      "HTTPS unavailable:",
      error instanceof Error ? error.message : String(error),
    );
  }
  console.log(plain, secure?.url ?? "");
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await Promise.all([web.stop(true), https?.stop(true)]);
    for (const id of jobs.jobs.keys()) jobs.cancel(id);
    await rm(jobs.root, { recursive: true, force: true });
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return web;
}
