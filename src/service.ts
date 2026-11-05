import { existsSync, realpathSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { listenAddress, portNumber } from "./network";

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
type Config = { host?: string; port: number; env: Record<string, string> };
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
function plist(cfg: Config) {
  const exe = realpathSync(process.execPath);
  const cmd = [exe];
  if (/[/\\]bun(?:\.exe)?$/.test(exe)) cmd.push(resolve(process.argv[1]));
  cmd.push("server", "run", "--port", String(cfg.port));
  if (cfg.host) cmd.push("--host", cfg.host);
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
  host?: string,
  port?: string,
) {
  if (process.platform !== "darwin")
    throw Error("Service control runs on the host Mac.");
  const before = ctl("print", target);
  const loaded = before.exitCode === 0;
  const cfg: Config = existsSync(config)
    ? await Bun.file(config).json()
    : { port: 8765, env: {} };
  if (host || port) {
    if (
      loaded &&
      ((host && cfg.host !== host) || (port && cfg.port !== portNumber(port)))
    )
      throw Error("Stop the service before changing its address.");
    if (host) cfg.host = listenAddress(host);
    if (port) cfg.port = portNumber(port);
  }
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
  if (action === "start" || (action === "autostart" && toggle === "on")) {
    for (const key of ["UPSCAYL_APP", "UPSCAYL_MODELS_DIR", "UPSCAYL_DIST"])
      if (process.env[key]) cfg.env[key] = resolve(process.env[key]!);
    await mkdir(logDir, { recursive: true });
    await atomic(config, JSON.stringify(cfg));
    const definition = plist(cfg);
    if (existsSync(persistent) || action === "autostart")
      await atomic(persistent, definition);
    if (action === "start" && !loaded) {
      await atomic(manual, definition);
      runCtl("bootstrap", domain, existsSync(persistent) ? persistent : manual);
    }
  }
  const address = (() => {
    try {
      return "http://" + listenAddress(cfg.host) + ":" + cfg.port;
    } catch {
      return undefined;
    }
  })();
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
      return r.ok && info.name === "upscayl-mcp" && Number(pid) === info.pid;
    } catch {
      return false;
    }
  };
  if (action === "start") {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      if (await health()) {
        ok = true;
        break;
      }
      await Bun.sleep(170);
    }
    if (!ok)
      throw Error(
        "Service did not become ready. Inspect " +
          join(logDir, "server.err.log"),
      );
  }
  const running = ctl("print", target).exitCode === 0;
  return {
    running: running && (await health()),
    loaded: running,
    autostart: existsSync(persistent),
    url: address,
    log: join(logDir, "server.err.log"),
  };
}
