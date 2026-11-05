import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import client from "../skills/upscayl/SKILL.md" with { type: "text" };
import remote from "../skills/upscayl/references/cli.md" with { type: "text" };
import mcp from "../skills/upscayl/references/mcp.md" with { type: "text" };
import behavior from "../skills/upscayl/references/behavior.md" with { type: "text" };
import host from "../skills/upscayl-host/SKILL.md" with { type: "text" };
import local from "../skills/upscayl-host/references/cli.md" with { type: "text" };
import operations from "../skills/upscayl-host/references/server.md" with { type: "text" };

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function bundle(name: string, files: Record<string, string>) {
  files = { ...files, "references/behavior.md": behavior };
  const zip = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, contents]) => [
        name + "/" + path,
        [strToU8(contents), { mtime: new Date(2020, 0, 1) }] as const,
      ]),
    ),
  );
  return {
    name,
    filename: name + "-skill.zip",
    files,
    zip,
    sha256: sha256(zip),
  };
}

export const skillBundles = {
  client: bundle("upscayl", {
    "SKILL.md": client,
    "references/cli.md": remote,
    "references/mcp.md": mcp,
  }),
  host: bundle("upscayl-host", {
    "SKILL.md": host,
    "references/cli.md": local,
    "references/server.md": operations,
  }),
};

// Exact earlier official file contents accepted for in-place upgrades.
const previousClient: Record<string, string[]> = {
  "SKILL.md": [
    "8b7c4897f98d3e70a7d934c298966890678c4839a51d3ef1f4329ae929125768",
    "ec14805f1b8ff3fed81f149023193ef64b91802ac208693759dc9f2dc8cdfd18",
    "9a57eb39fb761697d7009354f363aa0dac72ea4855ac0f87bf91ac204e036f12",
  ],
  "references/cli.md": [
    "8ff434b1d8628f88e517430baff2cd54d49dfb39a8ba7897360d1ed2c881d8bf",
  ],
  "references/mcp.md": [
    "df41aa69f7ced7896c259acb36830f50830741e723be4c6bec0c62af131cc0ef",
    "97611f3340d6ab0bc3e36dbd2bb6c0f3998394b0f319799e6cf84ca51967ee6a",
  ],
  "references/behavior.md": [
    "2bcecdbc45887184a836476f1aa538a11d4c691c67bb3ffe007b338c23fe19d5",
  ],
};

const previousHost: Record<string, string[]> = {
  "SKILL.md": [
    "6fda146fc3d19551b16a3e13c10c59756def7f5a69174b61c9ccb1c45ec9d0ba",
  ],
};
export async function installSkill(
  role: keyof typeof skillBundles,
  root = join(homedir(), ".agents/skills"),
) {
  const skill = skillBundles[role],
    dest = join(root, skill.name);
  await mkdir(root, { recursive: true });
  const files = Object.entries(skill.files);
  const stat = await lstat(dest).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
    return undefined;
  });
  if (stat) {
    if (
      !stat.isDirectory() ||
      !(await lstat(join(dest, "references"))).isDirectory()
    )
      throw Error("Review the existing skill at " + dest);
    // Preflight every owned file before replacing any. Extra user files are retained.
    const updates: Array<[string, string]> = [];
    for (const [name, content] of files) {
      const path = join(dest, name);
      if (!(await lstat(path)).isFile())
        throw Error("Review the existing skill file " + path);
      const existing = await readFile(path);
      if (existing.equals(Buffer.from(content))) continue;
      const previous = role === "client" ? previousClient : previousHost;
      if (!previous[name]?.includes(sha256(existing)))
        throw Error(
          "Skill file has different content. Review it before replacing: " +
            path,
        );
      updates.push([path, content]);
    }
    for (const [path, content] of updates) {
      const tmp = path + "." + crypto.randomUUID();
      try {
        await Bun.write(tmp, content);
        await rename(tmp, path);
      } finally {
        await rm(tmp, { force: true });
      }
    }
    return dest;
  }
  const tmp = await mkdtemp(join(root, "." + skill.name + "-"));
  try {
    await mkdir(join(tmp, "references"));
    for (const [name, content] of files)
      await Bun.write(join(tmp, name), content);
    await rename(tmp, dest);
  } finally {
    await rm(tmp, { force: true, recursive: true });
  }
  return dest;
}
