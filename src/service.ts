import { existsSync, realpathSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { listenAddress, serverOrigin } from "./network";
import {
  configureHost,
  hasTlsOptions,
  type HostConfig,
  type HostOptions,
} from "./host-config";
import { httpsSettings } from "./tls";
import { isDeepStrictEqual } from "node:util";

const label = "io.github.jjangga0214.upscayl-mcp";
const home = homedir();
const support = join(home, "Library/Application Support/upscayl-mcp");
const agents = join(home, "Library/LaunchAgents");
const persistent = join(agents, label + ".plist");
const manual = join(support, label + ".plist");
const config = join(support, "service.json");
const logDir = join(home, "Library/Logs/upscayl-mcp");
const domain = "gui/" + process.getuid?.();
const target = domain + "/" + label;
const ctl = (...args: string[]) => Bun.spawnSync(["/bin/launchctl", ...args]);
function runCtl(...args: string[]) {
  const r = ctl(...args);
  if (r.exitCode !== 0)
    throw Error("launchctl " + args[0] + ": " + r.stderr.toString().trim());
}
const xml = (v: string) =>
  v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function atomic(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + "." + crypto.randomUUID();
  try {
    await Bun.write(tmp, value, { mode: 0o600 });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
}
function plist(cfg: HostConfig) {
  const exe = realpathSync(process.execPath);
  const cmd = [exe];
  if (/[/\\]bun(?:\.exe)?$/.test(exe)) cmd.push(resolve(process.argv[1]));
  cmd.push("server", "run", "--port", String(cfg.port));
  if (cfg.host) cmd.push("--host", cfg.host);
  if (cfg.domain) cmd.push("--domain", cfg.domain);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>' +
    "<key>Label</key><string>" +
    label +
    "</string><key>ProgramArguments</key><array>" +
    cmd.map((v) => "<string>" + xml(v) + "</string>").join("") +
    "</array>" +
    "<key>EnvironmentVariables</key><dict>" +
    Object.entries(cfg.env)
      .map(([k, v]) => "<key>" + k + "</key><string>" + xml(v) + "</string>")
      .join("") +
    "</dict>" +
    "<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>" +
    "<key>StandardOutPath</key><string>" +
    xml(join(logDir, "server.log")) +
    "</string>" +
    "<key>StandardErrorPath</key><string>" +
    xml(join(logDir, "server.err.log")) +
    "</string></dict></plist>\n"
  );
}
export async function service(
  action: string,
  toggle?: string,
  options: HostOptions = {},
) {
  if (process.platform !== "darwin")
    throw Error(
      "Managed service commands use macOS launchd. Use upscayl-mcp server run for a foreground server on this host.",
    );
  const before = ctl("print", target);
  const loaded = before.exitCode === 0;
  let cfg: HostConfig = existsSync(config)
    ? await Bun.file(config).json()
    : { port: 8765, env: {} };
  if (action === "stop" && loaded) {
    runCtl("bootout", target);
    for (let i = 0; i < 40 && ctl("print", target).exitCode === 0; i++)
      await Bun.sleep(100);
    if (ctl("print", target).exitCode === 0)
      throw Error("launchd is still stopping the service.");
  }
  if (action === "autostart" && toggle !== "on" && toggle !== "off")
    throw Error("Use autostart on or off.");
  if (action === "autostart" && toggle === "off")
    await rm(persistent, { force: true });
  let definition: string | undefined;
  let expectedHttps: string | undefined;
  if (action === "start" || (action === "autostart" && toggle === "on")) {
    const next = configureHost(options, cfg);
    const changed = !isDeepStrictEqual(next, cfg);
    if (loaded && changed)
      throw Error(
        "Stop the service before changing its address or TLS settings.",
      );
    if (changed || next.domain || hasTlsOptions(options))
      expectedHttps = httpsSettings(
        next.domain ?? listenAddress(next.host),
        next.port,
        next.env,
      )?.url;
    cfg = next;
    await mkdir(logDir, { recursive: true });
    definition = plist(cfg);
    if (action === "start" && !loaded) {
      await atomic(manual, definition);
      runCtl("bootstrap", domain, manual);
    }
  }
  const address = (() => {
    try {
      return serverOrigin("http", listenAddress(cfg.host), cfg.port);
    } catch {
      return undefined;
    }
  })();
  let pwa: string | undefined, ca_sha256: string | undefined;
  const health = async () => {
    if (!address) return false;
    try {
      const r = await fetch(address + "/health", {
        signal: AbortSignal.timeout(600),
      });
      const info = await r.json();
      const pid = ctl("print", target)
        .stdout.toString()
        .match(/^\s*pid = (\d+)$/m)?.[1];
      if (!r.ok || info.name !== "upscayl-mcp" || Number(pid) !== info.pid)
        return false;
      pwa = info.pwa;
      ca_sha256 = info.ca_sha256;
      return true;
    } catch {
      return false;
    }
  };
  if (action === "start") {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      if ((await health()) && (!expectedHttps || pwa === expectedHttps)) {
        ok = true;
        break;
      }
      await Bun.sleep(170);
    }
    if (!ok) {
      if (!loaded) runCtl("bootout", target);
      throw Error(
        "Service did not become ready. Inspect " +
          join(logDir, "server.err.log"),
      );
    }
  }
  // Only replace the saved configuration and login agent after a new start is healthy.
  if (definition) {
    if (existsSync(persistent) || action === "autostart")
      await atomic(persistent, definition);
    await atomic(config, JSON.stringify(cfg));
  }
  const running = ctl("print", target).exitCode === 0;
  return {
    running: running && (await health()),
    loaded: running,
    autostart: existsSync(persistent),
    url: cfg.domain ? serverOrigin("http", cfg.domain, cfg.port) : address,
    bind_url: address,
    pwa,
    ca_sha256,
    log: join(logDir, "server.err.log"),
  };
}
