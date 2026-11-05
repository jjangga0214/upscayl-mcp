import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { version } from "../package.json";
import { CACHE_MS } from "./jobs";
import { skillBundles } from "./skills";

export const repo = "https://github.com/jjangga0214/upscayl-mcp";
export const platforms = [
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "linux-arm64",
  "windows-x64",
];
export const packages = platforms.map((p) => "upscayl-mcp-" + p + ".zip");
export function download(name: string) {
  const bundle = Object.values(skillBundles).find((b) => b.filename === name);
  if (bundle)
    return new Response(Buffer.from(bundle.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=" + bundle.filename,
      },
    });
  if (![...packages, "SHA256SUMS"].includes(name))
    return new Response("Unknown download", { status: 404 });
  const dir = process.env.UPSCAYL_DIST || dirname(process.execPath);
  const file = Bun.file(join(resolve(dir), name));
  if (existsSync(file.name!))
    return new Response(file, {
      headers: { "Content-Disposition": "attachment; filename=" + name },
    });
  return Response.redirect(
    repo + "/releases/download/v" + version + "/" + name,
    302,
  );
}
export function manifest(base: string) {
  const link = (bundle: typeof skillBundles.client) => ({
    name: bundle.name,
    url: base + "/downloads/" + bundle.filename,
    sha256: bundle.sha256,
  });
  const skills = {
    client: link(skillBundles.client),
    host: link(skillBundles.host),
  };
  return {
    name: "upscayl-mcp",
    version,
    repository: repo,
    app: base + "/",
    setup: base + "/setup",
    manifest: base + "/manifest.json",
    cache_ttl_seconds: CACHE_MS / 1000,
    transport: "streamable-http",
    authentication: "none (trusted home LAN)",
    mcp: base + "/mcp",
    uploads: base + "/files",
    skills,
    skill: skills.client.url,
    skill_sha256: skills.client.sha256,
    checksums: base + "/downloads/SHA256SUMS",
    downloads: Object.fromEntries(
      platforms.map((p, i) => [p, base + "/downloads/" + packages[i]]),
    ),
    codex: "codex mcp add upscayl --url " + base + "/mcp",
    opencode: {
      mcp: {
        upscayl: {
          type: "remote",
          url: base + "/mcp",
          oauth: false,
          enabled: true,
        },
      },
    },
    instructions:
      "For a client PC, use skills.client (also exposed as skill). Verify its SHA-256 and extract the upscayl folder into ~/.agents/skills. Connect this MCP endpoint in Codex or OpenCode. POST image bytes to /files, call upscale with file_id and options, poll get_job, and save the result on the requesting device within five minutes of completion. The remote CLI is optional for shell use.",
  };
}
