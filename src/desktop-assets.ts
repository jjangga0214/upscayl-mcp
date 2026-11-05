import { extractFile, listPackage } from "@electron/asar";
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { builtins } from "./catalog";

// Only these UI resources from the installed desktop app are exposed on the LAN.
export async function desktopAssets(binary: string) {
  const resources = dirname(dirname(binary));
  const archive = join(resources, "app.asar");
  const files = new Map<string, Blob>();
  let version = "";
  const icon = join(resources, "512x512.png");
  if (existsSync(icon)) {
    files.set("/studio/icon-512.png", Bun.file(icon));
    const small = await new Bun.Image(Bun.file(icon))
      .resize(192, 192)
      .png()
      .blob();
    files.set("/studio/icon-192.png", small);
  }
  const previews: string[] = [];
  if (existsSync(archive)) {
    const paths = listPackage(archive, { isPack: false }).map((p) =>
      p.replaceAll("\\", "/"),
    );
    if (paths.includes("/package.json")) {
      const metadata = JSON.parse(
        extractFile(archive, "package.json").toString(),
      );
      if (typeof metadata.version === "string") version = metadata.version;
    }
    const add = (url: string, path: string, type: string) =>
      files.set(
        url,
        new Blob([extractFile(archive, normalize(path.slice(1)))], { type }),
      );
    for (const weight of ["Bold", "Regular"]) {
      const path = paths.find(
        (p) =>
          p.startsWith(
            "/renderer/out/_next/static/media/Poppins-" + weight + ".",
          ) && p.endsWith(".ttf"),
      );
      if (path) add("/studio/brand-" + weight + ".ttf", path, "font/ttf");
    }
    for (const id of Object.keys(builtins)) {
      const prefix = "/renderer/out/model-comparison/" + id + "/";
      if (
        !["before", "after"].every((side) =>
          paths.includes(prefix + side + ".webp"),
        )
      )
        continue;
      previews.push(id);
      for (const side of ["before", "after"])
        add(
          "/studio/models/" + id + "/" + side + ".webp",
          prefix + side + ".webp",
          "image/webp",
        );
    }
  }
  if (
    !version &&
    process.platform === "darwin" &&
    existsSync(join(resources, "../Info.plist"))
  ) {
    const revision = Bun.spawnSync([
      "/usr/bin/plutil",
      "-extract",
      "CFBundleShortVersionString",
      "raw",
      join(resources, "../Info.plist"),
    ]);
    if (revision.exitCode === 0) version = revision.stdout.toString().trim();
  }
  return { version, previews, files };
}
