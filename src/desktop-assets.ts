import { extractFile, listPackage } from "@electron/asar";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { builtins } from "./catalog";

// Only these UI resources from the installed desktop app are exposed on the LAN.
export function desktopAssets(binary: string, scratch: string) {
  const resources = dirname(dirname(binary));
  const archive = join(resources, "app.asar");
  const files = new Map<string, Blob>();
  let version = "";
  const revision = Bun.spawnSync([
    "/usr/bin/plutil",
    "-extract",
    "CFBundleShortVersionString",
    "raw",
    join(resources, "../Info.plist"),
  ]);
  if (revision.exitCode === 0) version = revision.stdout.toString().trim();
  const icon = join(resources, "512x512.png");
  if (existsSync(icon)) {
    files.set("/studio/icon-512.png", Bun.file(icon));
    const small = join(scratch, "icon-192.png");
    if (
      Bun.spawnSync(["/usr/bin/sips", "-z", "192", "192", icon, "--out", small])
        .exitCode === 0
    )
      files.set("/studio/icon-192.png", Bun.file(small));
  }
  const previews: string[] = [];
  if (existsSync(archive)) {
    const paths = listPackage(archive, { isPack: false });
    const add = (url: string, path: string, type: string) =>
      files.set(
        url,
        new Blob([extractFile(archive, path.replace(/^\//, ""))], { type }),
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
  return { version, previews, files };
}
