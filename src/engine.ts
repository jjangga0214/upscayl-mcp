import { constants, existsSync, statSync, readdirSync } from "node:fs";
import {
  chmod,
  copyFile,
  link,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, parse, resolve } from "node:path";
import { imageSize } from "image-size";
import { z } from "zod";

export const optionsSchema = z
  .object({
    model: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[^/\\\x00-\x1f]+$/)
      .default("upscayl-standard-4x")
      .describe("Installed model ID from models."),
    scale: z
      .number()
      .int()
      .min(1)
      .max(16)
      .default(4)
      .describe("Output multiplier per pass, 1–16. Width takes precedence."),
    width: z
      .number()
      .int()
      .positive()
      .max(65535)
      .optional()
      .describe("Final width in pixels; engine preserves aspect ratio."),
    double: z
      .boolean()
      .default(false)
      .describe("Run the model again on the saved first pass (single image)."),
    format: z
      .enum(["png", "jpg", "webp"])
      .default("png")
      .describe("Encoded output file format."),
    compression: z
      .number()
      .int()
      .min(0)
      .max(100)
      .default(0)
      .describe("Desktop compression setting 0–100; PNG remains lossless."),
    tile: z
      .number()
      .int()
      .min(0)
      .max(8192)
      .refine((v) => v === 0 || v >= 32, "Use 0 (auto) or at least 32")
      .default(0),
    gpu: z
      .string()
      .regex(/^\d+(,\d+)*$/)
      .optional()
      .describe("Engine GPU indices; omit for automatic selection."),
    tta: z
      .boolean()
      .default(false)
      .describe("Test-time augmentation on final pass; more computation."),
  })
  .strict();
export type Options = z.output<typeof optionsSchema>;
export type Size = { width: number; height: number };
export type Model = { id: string; nativeScale: number; folder: string };

export function engine() {
  const app =
    process.env.UPSCAYL_APP ||
    [
      "/Applications/Upscayl.app",
      join(homedir(), "Applications/Upscayl.app"),
    ].find(existsSync);
  if (!app)
    throw Error(
      "Install Upscayl on the host or set UPSCAYL_APP; on a client use --server.",
    );
  const resources = join(resolve(app), "Contents/Resources");
  const bin = join(resources, "bin/upscayl-bin");
  if (!existsSync(bin)) throw Error("Missing engine in " + resources);
  const models = new Map<string, Model>();
  for (const folder of [
    join(resources, "models"),
    process.env.UPSCAYL_MODELS_DIR,
  ].filter((s): s is string => !!s)) {
    for (const name of readdirSync(folder).sort()) {
      const id = basename(name, ".param");
      if (
        name.endsWith(".param") &&
        existsSync(join(folder, id + ".bin")) &&
        !models.has(id)
      ) {
        const nativeScale = /2x|x2/i.test(id) ? 2 : /3x|x3/i.test(id) ? 3 : 4;
        models.set(id, { id, nativeScale, folder });
      }
    }
  }
  return { bin, models };
}
export type Engine = ReturnType<typeof engine>;
export function selectModel(backend: Engine, opt: Options) {
  const model = backend.models.get(opt.model);
  if (!model) throw Error("Unknown installed model: " + opt.model);
  return model;
}
export const imageExt = /\.(png|jpe?g|jfif|webp)$/i;
export async function inspect(file: string) {
  const handle = await open(file, "r");
  try {
    const buf = Buffer.alloc(
      Math.min((await handle.stat()).size, 2 * 1024 * 1024),
    );
    const { bytesRead } = await handle.read(buf);
    const { width, height, type } = imageSize(buf.subarray(0, bytesRead));
    if (!width || !height || !["png", "jpg", "webp"].includes(type ?? ""))
      throw Error("Expected PNG, JPEG or WebP.");
    return { width, height, type };
  } finally {
    await handle.close();
  }
}
export function plan(input: Size, opt: Options, model: Model) {
  let size = { width: input.width, height: input.height };
  const passes = [];
  for (let i = 0; i < (opt.double ? 2 : 1); i++) {
    const final = !opt.double || i === 1;
    const native = {
      width: size.width * model.nativeScale,
      height: size.height * model.nativeScale,
    };
    const width = final ? opt.width : undefined;
    const scale = opt.width ? model.nativeScale : opt.scale;
    const output = width
      ? { width, height: Math.floor((size.height * width) / size.width) }
      : { width: size.width * scale, height: size.height * scale };
    if (output.height < 1)
      throw Error("The requested width gives a zero-pixel height.");
    passes.push({
      input: size,
      ai: native,
      output,
      resize: native.width !== output.width || native.height !== output.height,
      tta: final && opt.tta,
    });
    size = output;
  }
  return {
    model: model.id,
    nativeScale: model.nativeScale,
    options: opt,
    passes,
    output: size,
  };
}
export function label(opt: Options) {
  return opt.width ? opt.width + "px" : opt.scale + "x";
}
export function outputName(file: string, opt: Options) {
  return (
    parse(file).name +
    "_upscayl_" +
    label(opt) +
    "_" +
    opt.model +
    "." +
    opt.format
  );
}
export function batchFiles(input: string, opt: Options) {
  if (opt.double)
    throw Error(
      "Desktop batch mode supports a single pass. Run Double on individual images.",
    );
  const names = readdirSync(input, { withFileTypes: true })
    .filter(
      (f) => f.isFile() && !f.name.startsWith(".") && imageExt.test(f.name),
    )
    .map((f) => f.name)
    .sort();
  if (!names.length) throw Error("Folder contains no supported images.");
  const used = new Set<string>();
  return names.map((name) => {
    let target = parse(name).name + "." + opt.format;
    if (used.has(target.toLowerCase())) target = name + "." + opt.format;
    while (used.has(target.toLowerCase())) target = "_" + target;
    used.add(target.toLowerCase());
    return { input: join(input, name), name: target };
  });
}
export async function publishFile(
  staged: string,
  destination: string,
  overwrite: boolean,
) {
  if (overwrite) {
    await rename(staged, destination);
    return;
  }
  try {
    await link(staged, destination);
  } catch (err) {
    // Some destination volumes lack hard links; retain exclusive-create semantics.
    if (
      !["ENOTSUP", "EPERM", "EXDEV", "ENOSYS"].includes(
        (err as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw err;
    await copyFile(staged, destination, constants.COPYFILE_EXCL);
  }
}
export async function upscale(
  backend: Engine,
  input: string,
  dest: string,
  opt: Options,
  overwrite: boolean,
  signal?: AbortSignal,
  onProgress?: (s: string) => void,
) {
  input = resolve(input);
  dest = resolve(dest);
  if (!imageExt.test(input)) throw Error("Unsupported input file extension.");
  if (extname(dest).toLowerCase().replace(".jpeg", ".jpg") !== "." + opt.format)
    throw Error("Output extension must match format " + opt.format);
  const model = selectModel(backend, opt);
  const predicted = plan(await inspect(input), opt, model);
  if (existsSync(dest)) {
    if (
      (await realpath(dest)) === (await realpath(input)) ||
      (statSync(dest).ino === statSync(input).ino &&
        statSync(dest).dev === statSync(input).dev)
    )
      throw Error("Choose a different output from the original.");
    if (!overwrite) {
      const size = await inspect(dest);
      if (
        size.width !== predicted.output.width ||
        size.height !== predicted.output.height ||
        size.type !== opt.format
      )
        throw Error(
          "Existing result has different dimensions or format. Use --overwrite or choose another output.",
        );
      return { path: dest, reused: true, ...size };
    }
  }
  await mkdir(dirname(dest), { recursive: true });
  const scratch = await mkdtemp(join(dirname(dest), ".upscayl-"));
  try {
    let from = input;
    for (const [i, pass] of predicted.passes.entries()) {
      signal?.throwIfAborted();
      const final = i === predicted.passes.length - 1;
      const out = join(scratch, "pass-" + (i + 1) + "." + opt.format);
      const args = [
        "-i",
        from,
        "-o",
        out,
        "-m",
        model.folder,
        "-n",
        model.id,
        "-f",
        opt.format,
      ];
      if (!opt.width && model.nativeScale !== opt.scale)
        args.push("-s", String(opt.scale));
      if (final && opt.width) args.push("-w", String(opt.width));
      if (opt.tile) args.push("-t", String(opt.tile));
      if (opt.gpu) args.push("-g", opt.gpu);
      if (final) args.push("-c", String(opt.compression));
      if (pass.tta) args.push("-x");
      const proc = Bun.spawn([backend.bin, ...args], {
        cwd: scratch,
        stderr: "pipe",
        stdout: "ignore",
      });
      const kill = () => proc.kill("SIGKILL");
      signal?.addEventListener("abort", kill, { once: true });
      onProgress?.("pass " + (i + 1) + "/" + predicted.passes.length);
      let tail = "";
      try {
        for await (const chunk of proc.stderr) {
          const message = Buffer.from(chunk).toString();
          tail = (tail + message).slice(-2400);
          const percent = message.match(/(\d+(?:\.\d+)?)%/g)?.at(-1);
          if (percent)
            onProgress?.(
              "pass " + (i + 1) + "/" + predicted.passes.length + " " + percent,
            );
        }
        const rc = await proc.exited;
        signal?.throwIfAborted();
        if (rc !== 0 || !existsSync(out))
          throw Error(
            "Upscayl could not write the image (" + rc + "). " + tail,
          );
      } finally {
        signal?.removeEventListener("abort", kill);
      }
      const actual = await inspect(out);
      if (
        actual.width !== pass.output.width ||
        actual.height !== pass.output.height ||
        actual.type !== opt.format
      )
        throw Error(
          "Engine output differs from expected size or format: " +
            JSON.stringify(actual),
        );
      from = out;
    }
    await chmod(from, 0o600);
    await publishFile(from, dest, overwrite);
    return { path: dest, reused: false, ...predicted.output, type: opt.format };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
