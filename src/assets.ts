import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import skill from "../skills/upscayl/SKILL.md" with { type: "text" };
import cli from "../skills/upscayl/references/cli.md" with { type: "text" };
import mcp from "../skills/upscayl/references/mcp.md" with { type: "text" };
import behavior from "../skills/upscayl/references/behavior.md" with { type: "text" };
import { version } from "../package.json";

export const repo = "https://github.com/jjangga0214/upscayl-mcp";
const skillFiles = {
  "SKILL.md": skill,
  "references/cli.md": cli,
  "references/mcp.md": mcp,
  "references/behavior.md": behavior,
};
export const skillName = "upscayl-skill.zip";
export const platforms = [
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "linux-arm64",
  "windows-x64",
];
export const packages = platforms.map((p) => "upscayl-mcp-" + p + ".zip");
export function skillArchive() {
  return zipSync(
    Object.fromEntries(
      Object.entries(skillFiles).map(([k, v]) => [
        "upscayl/" + k,
        [strToU8(v), { mtime: new Date(2020, 0, 1) }] as [
          Uint8Array,
          { mtime: Date },
        ],
      ]),
    ),
  );
}
export const digest = (b: Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
export async function installSkill() {
  const root = join(homedir(), ".agents/skills");
  const dest = join(root, "upscayl");
  await mkdir(root, { recursive: true });
  if (existsSync(dest)) {
    for (const [k, v] of Object.entries(skillFiles)) {
      if (
        !(await Bun.file(join(dest, k)).exists()) ||
        (await Bun.file(join(dest, k)).text()) !== v
      )
        throw Error(
          "Skill already exists with different content at " +
            dest +
            ". Review it before replacing.",
        );
    }
    return dest;
  }
  const tmp = await mkdtemp(join(root, ".upscayl-"));
  try {
    await mkdir(join(tmp, "references"));
    for (const [name, content] of Object.entries(skillFiles))
      await Bun.write(join(tmp, name), content);
    await rename(tmp, dest);
    return dest;
  } finally {
    await rm(tmp, { force: true, recursive: true });
  }
}
export function download(name: string) {
  if (name === skillName)
    return new Response(Buffer.from(skillArchive()), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=" + skillName,
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
  return {
    name: "upscayl-mcp",
    version,
    repository: repo,
    transport: "streamable-http",
    authentication: "none (trusted home LAN)",
    mcp: base + "/mcp",
    uploads: base + "/files",
    skill: base + "/downloads/" + skillName,
    skill_sha256: digest(skillArchive()),
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
      "Extract the skill ZIP (upscayl/SKILL.md and references) into ~/.agents/skills. The executable ZIP contains the CLI and MCP server. Only the Mac host needs Upscayl. POST image bytes to /files, then call upscale with file_id and options, poll get_job, GET its result path.",
  };
}
