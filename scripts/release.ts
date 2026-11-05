import { mkdir, rm, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { packages, platforms } from "../src/assets";
import { skillBundles } from "../src/skills";
const dist = resolve("dist");
await mkdir(dist, { recursive: true });
const bunLicense = await fetch(
  "https://raw.githubusercontent.com/oven-sh/bun/bun-v" +
    Bun.version +
    "/LICENSE.md",
);
if (!bunLicense.ok)
  throw Error("Could not retrieve the license for Bun " + Bun.version);
const notices = ["Bun " + Bun.version, await bunLicense.text()];
for (const entry of await readdir("node_modules", { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const folders = entry.name.startsWith("@")
    ? (await readdir(join("node_modules", entry.name))).map((n) =>
        join("node_modules", entry.name, n),
      )
    : [join("node_modules", entry.name)];
  for (const folder of folders) {
    const names = (await readdir(folder)).filter((n) =>
      /^(licen[sc]e|notice|copying)(\..*)?$/i.test(n),
    );
    for (const name of names)
      notices.push(
        folder.slice(13) + "/" + name,
        await readFile(join(folder, name), "utf8"),
      );
  }
}
const noticePath = join(dist, "THIRD-PARTY-NOTICES.txt");
await Bun.write(noticePath, notices.join("\n\n"));
for (const [i, platform] of platforms.entries()) {
  const scratch = join(dist, "build-" + platform);
  await mkdir(scratch, { recursive: true });
  const exe = join(
    scratch,
    "upscayl-mcp" + (platform.startsWith("windows") ? ".exe" : ""),
  );
  const result = Bun.spawnSync(
    [
      "bun",
      "build",
      "src/cli.ts",
      "--compile",
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      "--target=bun-" + platform,
      "--outfile",
      exe,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode) throw Error("Build failed for " + platform);
  const archive = join(dist, packages[i]);
  await rm(archive, { force: true });
  const zip = Bun.spawnSync(
    ["zip", "-q", "-j", archive, exe, resolve("LICENSE"), noticePath],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (zip.exitCode) throw Error("ZIP failed for " + platform);
  if (platform === "darwin-arm64")
    await Bun.write(join(dist, "upscayl-mcp"), Bun.file(exe));
  await rm(scratch, { recursive: true, force: true });
}
const bundles = Object.values(skillBundles);
for (const bundle of bundles)
  await Bun.write(join(dist, bundle.filename), bundle.zip);
const sums = [];
for (const name of [...packages, ...bundles.map((b) => b.filename)]) {
  const hash = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(join(dist, name)).stream())
    hash.update(chunk);
  sums.push(hash.digest("hex") + "  " + name);
}
await Bun.write(join(dist, "SHA256SUMS"), sums.join("\n") + "\n");
if (process.platform === "darwin")
  await import("node:fs/promises").then((fs) =>
    fs.chmod(join(dist, "upscayl-mcp"), 0o755),
  );
