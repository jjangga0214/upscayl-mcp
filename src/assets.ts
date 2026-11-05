import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { version } from "../package.json";
import { CACHE_MS } from "./jobs";
import { skillBundles } from "./skills";
import type { Locale } from "./locale";

import type { httpsSettings } from "./tls";

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
export function manifest(
  base: string,
  locale: Locale = "en",
  secure?: ReturnType<typeof httpsSettings>,
) {
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
    tls: secure
      ? ({
          enabled: true,
          url: secure.url,
          ca: secure.ca
            ? { url: base + "/pwa-ca.cer", sha256: secure.ca.fingerprint256 }
            : null,
        } as const)
      : ({ enabled: false } as const),
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
      locale === "ko"
        ? "클라이언트 PC에는 skills.client(또는 skill)의 ZIP을 사용하세요. 스킬을 설치하려면 SHA-256을 확인하고 에이전트의 스킬 디렉터리에 압축을 풉니다. Streamable HTTP를 지원하는 MCP 클라이언트에 mcp 주소를 연결하고 /files로 이미지를 전송하세요. 받은 file_id와 설정으로 upscale을 호출하고 get_job으로 확인한 뒤 완료 후 5분 이내에 결과를 이 기기에 저장하세요. 터미널에서는 원격 CLI도 쓸 수 있습니다."
        : "For a client PC, use skills.client (also exposed as skill). To install the optional skill, verify its SHA-256 and extract the upscayl folder into your agent’s skills directory. Connect the mcp URL in a client that supports Streamable HTTP. POST image bytes to /files, call upscale with file_id and options, poll get_job, and save the result on the requesting device within five minutes of completion. The remote CLI is optional for shell use.",
  };
}
