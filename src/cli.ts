#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { version } from "../package.json";
import {
  batchFiles,
  engine,
  inspect,
  label,
  optionsSchema,
  outputName,
  plan,
  selectModel,
  upscale,
} from "./engine";
import { terminalLocale } from "./terminal-locale";
import { describeModel } from "./catalog";
import { endpoint, remoteFile, remoteModels } from "./client";
import { installSkill } from "./skills";
import { configureHost, hasTlsOptions } from "./host-config";
import { service } from "./service";
import { compareLocal } from "./compare";
import { serve } from "./server";

const s = (description: string) => ({ type: "string" as const, description });
const b = (description: string) => ({ type: "boolean" as const, description });
const remote = s("Home server URL or IP:port");
const hostArgs = {
  host: s("Assigned private IPv4 or auto (default: primary LAN)"),
  domain: s(
    "LAN DNS name for client URLs; pass an empty string to use the bind IP",
  ),
  "https-port": s("HTTPS listener port (default: HTTP port + 1)"),
  "tls-cert": s("PEM server certificate, including intermediates if needed"),
  "tls-key": s("PEM private key matching the server certificate"),
  "tls-ca": s(
    "Optional public CA certificate to share; empty string clears it",
  ),
  "http-only": b("Clear HTTPS settings and serve HTTP only"),
  port: s("TCP port, default 8765"),
};
const show = (value: unknown) => console.log(JSON.stringify(value, null, 2));
const run = defineCommand({
  meta: {
    name: "upscale",
    description: "Upscale an image or folder locally or on a LAN host",
  },
  args: {
    input: {
      type: "positional",
      required: true,
      description: "Image file or batch folder",
    },
    server: remote,
    model: s("Installed model ID"),
    scale: s("Per-pass output scale, 1–16 (default 4)"),
    width: s("Target width in pixels; overrides scale"),
    double: b("Run two AI passes on a single image"),
    format: s("png (default), jpg or webp"),
    compression: s("Desktop compression setting, 0–100"),
    tile: s("Tile size: 0 auto or at least 32"),
    gpu: s("GPU ID(s), e.g. 0 or 0,1"),
    tta: b("Enable test-time augmentation"),
    output: { ...s("Exact output file for single images"), alias: "o" },
    "output-dir": s("Parent directory for generated names"),
    overwrite: b("Replace existing results"),
    explain: b("Show processing plan without running inference"),
    json: b("Print machine-readable JSON"),
  },
  async run({ args: a }) {
    const input = resolve(a.input);
    const directory = (await stat(input)).isDirectory();
    if (a.output && (directory || a["output-dir"]))
      throw Error(
        "--output is for a single image and cannot be combined with --output-dir.",
      );
    const inferred = a.output
      ? extname(a.output)
          .slice(1)
          .toLowerCase()
          .replace(/^jpeg$/, "jpg")
      : undefined;
    const n = (v: string | undefined) =>
      v === undefined ? undefined : Number(v);
    const opt = optionsSchema.parse({
      model: a.model,
      scale: n(a.scale),
      width: n(a.width),
      double: a.double,
      format: a.format || inferred,
      compression: n(a.compression),
      tile: n(a.tile),
      gpu: a.gpu,
      tta: a.tta,
    });
    const base = a.server ? endpoint(a.server) : undefined;
    const backend = base ? undefined : engine();
    const parent = resolve(
      a["output-dir"] || (directory ? input : dirname(input)),
    );
    const batchDir = join(
      parent,
      "upscayl_" + opt.format + "_" + opt.model + "_" + label(opt),
    );
    const files = directory
      ? batchFiles(input, opt).map((f) => ({
          input: f.input,
          dest: join(batchDir, f.name),
        }))
      : [
          {
            input,
            dest: a.output
              ? resolve(a.output)
              : join(parent, outputName(input, opt)),
          },
        ];
    const controller = new AbortController();
    const onSignal = () => controller.abort(Error("Interrupted."));
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    const progress =
      process.stderr.isTTY && !a.json
        ? (p: string) => process.stderr.write("\r" + p + "       ")
        : undefined;
    const replace = !!a.overwrite || (!a.output && (directory || opt.double));
    const results = [];
    try {
      for (const f of files) {
        controller.signal.throwIfAborted();
        let result;
        if (base)
          result = await remoteFile(
            base,
            f.input,
            f.dest,
            opt,
            !!a.explain,
            replace,
            controller.signal,
            progress,
          );
        else if (a.explain)
          result = plan(
            await inspect(f.input),
            opt,
            selectModel(backend!, opt),
          );
        else
          result = await upscale(
            backend!,
            f.input,
            f.dest,
            opt,
            replace,
            controller.signal,
            progress,
          );
        results.push(result);
        if (!a.json) {
          if (a.explain) {
            console.log(f.input);
            show(result);
          } else
            console.log(
              (result.reused ? "Existing" : "Saved") +
                " " +
                result.width +
                "×" +
                result.height +
                "  " +
                result.path,
            );
        }
      }
      if (a.json) show(directory ? results : results[0]);
    } finally {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
    }
  },
});
const managed = (action: string, description: string) =>
  defineCommand({
    meta: { name: action, description },
    async run() {
      show(await service(action));
    },
  });
const cli = defineCommand({
  meta: {
    name: "upscayl-mcp",
    version,
    description: "Use Upscayl Desktop locally or over your home LAN",
  },
  subCommands: {
    upscale: run,
    compare: defineCommand({
      meta: {
        name: "compare",
        description: "Open an original/result slider or lens in your browser",
      },
      args: {
        original: { type: "positional", required: true },
        result: { type: "positional", required: true },
      },
      async run({ args }) {
        console.log(await compareLocal(args.original, args.result));
      },
    }),
    models: defineCommand({
      meta: {
        name: "models",
        description: "List installed models and native scale",
      },
      args: { server: remote },
      async run({ args }) {
        show(
          args.server
            ? await remoteModels(endpoint(args.server))
            : [...engine().models.values()].map(({ id, nativeScale }) => ({
                id,
                nativeScale,
                ...describeModel(id, terminalLocale()),
              })),
        );
      },
    }),
    skill: defineCommand({
      meta: {
        name: "skill",
        description: "Install a client or host skill for compatible agents",
      },
      subCommands: {
        install: defineCommand({
          meta: {
            name: "install",
            description: "Install the client (default) or host skill",
          },
          args: {
            dir: s("Parent skills directory (default: ~/.agents/skills)"),
            role: {
              type: "string",
              default: "client",
              description:
                "client (remote MCP or CLI) or host (local engine and server)",
            },
          },
          async run({ args }) {
            if (args.role !== "client" && args.role !== "host")
              throw Error("Choose --role client or --role host.");
            console.log(
              await installSkill(
                args.role,
                args.dir ? resolve(args.dir) : undefined,
              ),
            );
          },
        }),
      },
    }),
    server: defineCommand({
      meta: {
        name: "server",
        description: "Run the LAN host and manage its macOS login service",
      },
      subCommands: {
        run: defineCommand({
          meta: { name: "run", description: "Serve in the foreground" },
          args: hostArgs,
          async run({ args }) {
            await serve(configureHost(args), hasTlsOptions(args));
          },
        }),
        start: defineCommand({
          meta: {
            name: "start",
            description: "Start the macOS launchd service now",
          },
          args: hostArgs,
          async run({ args }) {
            show(await service("start", undefined, args));
          },
        }),
        stop: managed("stop", "Stop the macOS launchd service"),
        status: managed("status", "Show macOS launchd status and LAN URL"),
        autostart: defineCommand({
          meta: {
            name: "autostart",
            description: "Control launchd startup at macOS login",
          },
          args: {
            state: {
              type: "positional",
              required: true,
              description: "on or off",
            },
            ...hostArgs,
          },
          async run({ args }) {
            show(await service("autostart", args.state, args));
          },
        }),
      },
    }),
  },
});
runMain(cli);
