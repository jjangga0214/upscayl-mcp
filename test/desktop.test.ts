import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  batchFiles,
  engine,
  optionsSchema,
  plan,
  selectModel,
  upscale,
} from "../src/engine";
import { privateIPv4 } from "../src/network";

export const fixture = join(import.meta.dir, "fixtures/gradient.png");
const standard = { id: "upscayl-standard-4x", folder: "", nativeScale: 4 };
test("Double uses the first encoded output as the second input; width only applies on the final pass", () => {
  const result = plan(
    { width: 32, height: 24 },
    optionsSchema.parse({ double: true, width: 51, scale: 8, tta: true }),
    standard,
  );
  expect(
    result.passes.map((p) => [
      p.ai.width,
      p.output.width,
      p.output.height,
      p.tta,
    ]),
  ).toEqual([
    [128, 128, 96, false],
    [512, 51, 38, true],
  ]);
});
test("LAN host validation", () => {
  for (const ip of ["127.0.0.1", "192.168.0.1", "172.31.255.255", "10.1.2.3"])
    expect(privateIPv4(ip)).toBe(true);
  for (const ip of [
    "0.0.0.0",
    "8.8.8.8",
    "172.32.0.1",
    "192.168.999.1",
    "localhost",
  ])
    expect(privateIPv4(ip)).toBe(false);
});
test("Desktop batch names disambiguate colliding stems", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "upscayl-batch-test-"));
  try {
    for (const name of ["猫.jpg", "猫.png"])
      await copyFile(fixture, join(tmp, name));
    expect(batchFiles(tmp, optionsSchema.parse({})).map((f) => f.name)).toEqual(
      ["猫.png", "猫.png.png"],
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
let ready = false;
try {
  ready = engine().models.has(standard.id);
} catch {}
describe.skipIf(!ready)("installed desktop engine", () => {
  for (const [title, rawOpts, first, second] of [
    ["normal", {}, ["-c", "0"], null],
    ["8x", { scale: 8 }, ["-s", "8", "-c", "0"], null],
    ["Double", { double: true }, [], ["-c", "0"]],
    [
      "Double width TTA",
      { double: true, width: 51, format: "webp", tta: true, compression: 12 },
      [],
      ["-w", "51", "-c", "12", "-x"],
    ],
    [
      "JPEG tile",
      { scale: 2, format: "jpg", tile: 64, compression: 35 },
      ["-s", "2", "-t", "64", "-c", "35"],
      null,
    ],
  ] as const) {
    test(
      "compares output bytes to desktop arguments: " + title,
      async () => {
        const backend = engine();
        const opt = optionsSchema.parse(rawOpts);
        const model = selectModel(backend, opt);
        const tmp = await mkdtemp(join(tmpdir(), "upscayl-parity-test-"));
        try {
          const dest = join(tmp, "result." + opt.format);
          const reference = join(tmp, "desktop." + opt.format);
          const native = async (input: string, extra: readonly string[]) => {
            const p = Bun.spawn(
              [
                backend.bin,
                "-i",
                input,
                "-o",
                reference,
                "-m",
                model.folder,
                "-n",
                model.id,
                "-f",
                opt.format,
                ...extra,
              ],
              { stdout: "ignore", stderr: "ignore" },
            );
            expect(await p.exited).toBe(0);
          };
          await native(fixture, first);
          if (second) await native(reference, second);
          await upscale(backend, fixture, dest, opt, false);
          expect(
            Buffer.compare(await readFile(dest), await readFile(reference)),
          ).toBe(0);
        } finally {
          await rm(tmp, { recursive: true, force: true });
        }
      },
      60000,
    );
  }
  test("same-format batch outputs match the engine's directory mode", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "upscayl-folder-test-"));
    try {
      const input = join(tmp, "input"),
        native = join(tmp, "native");
      await mkdir(input);
      await mkdir(native);
      for (const name of ["a.png", "한 글.png"])
        await copyFile(fixture, join(input, name));
      const backend = engine(),
        opt = optionsSchema.parse({ scale: 2 }),
        model = selectModel(backend, opt);
      const p = Bun.spawn(
        [
          backend.bin,
          "-i",
          input,
          "-o",
          native,
          "-m",
          model.folder,
          "-n",
          model.id,
          "-f",
          "png",
          "-s",
          "2",
          "-c",
          "0",
        ],
        { stdout: "ignore", stderr: "ignore" },
      );
      expect(await p.exited).toBe(0);
      for (const f of batchFiles(input, opt)) {
        const dest = join(tmp, "batch", f.name);
        await upscale(backend, f.input, dest, opt, false);
        expect(
          Buffer.compare(
            await readFile(dest),
            await readFile(join(native, f.name)),
          ),
        ).toBe(0);
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }, 60000);
});
