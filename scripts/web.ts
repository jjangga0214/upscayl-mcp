import { mkdir } from "node:fs/promises";

await mkdir("build/web", { recursive: true });
const result = await Bun.build({
  entrypoints: ["src/web/main.tsx"],
  outdir: "build/web",
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!result.success) throw new AggregateError(result.logs, "Web build failed");
const css = Bun.spawnSync(
  [
    "bun",
    "run",
    "tailwindcss",
    "-i",
    "src/web/studio.css",
    "-o",
    "build/web/studio.css",
    "--minify",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (css.exitCode) throw Error("CSS build failed");
