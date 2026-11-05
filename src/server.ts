import { rm } from "node:fs/promises";
import { engine, optionsSchema } from "./engine";
import { Jobs, maxUpload } from "./jobs";
import { handleMcp, models } from "./mcp";
import { home } from "./home";
import { comparison } from "./compare";
import { download, manifest } from "./assets";
import { privateIPv4 } from "./network";
import { version } from "../package.json";
import { z } from "zod";

const requestSettings = z
  .object({ file_id: z.string().uuid(), options: optionsSchema.optional() })
  .strict();
const text = (message: string, status: number) =>
  Response.json({ error: message }, { status });
export async function serve(host: string, port: number) {
  const jobs = await Jobs.create(engine());
  const base = "http://" + host + ":" + port;
  const info = manifest(base);
  const web = Bun.serve({
    hostname: host,
    port,
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
      try {
        if (p === "/mcp") {
          if (req.method !== "POST")
            return new Response(null, {
              status: 405,
              headers: { Allow: "POST" },
            });
          return await handleMcp(req, jobs);
        }
        if (req.method === "GET") {
          if (p === "/")
            return new Response(home(info), {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                Link: '</manifest.json>; rel="describedby"; type="application/json"',
              },
            });
          if (p === "/manifest.json") return Response.json(info);
          if (p === "/health")
            return Response.json({
              name: info.name,
              version,
              base,
              pid: process.pid,
            });
          if (p === "/models") return Response.json(models(jobs));
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
          const { file_id, options } = requestSettings.parse(await req.json());
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
              ? new Response(Bun.file(source.path))
              : text("Source released.", 404);
          }
          if (
            req.method === "GET" &&
            action === "compare" &&
            job.status === "done"
          )
            return new Response(comparison("original", "result"), {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
              },
            });
          if (req.method === "GET" && action === "result") {
            if (job.status !== "done")
              return text("Result not available.", 409);
            return new Response(Bun.file(jobs.resultPath(job)));
          }
        }
        return text("Unknown route.", 404);
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), 400);
      }
    },
  });
  const timer = setInterval(
    () => void jobs.expire().catch(console.error),
    60_000,
  );
  console.log(base);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await web.stop(true);
    for (const id of jobs.jobs.keys()) jobs.cancel(id);
    await rm(jobs.root, { recursive: true, force: true });
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return web;
}
