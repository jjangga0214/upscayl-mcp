import { resolve } from "node:path";
import { listenAddress, portNumber, domainName } from "./network";

export type HostConfig = {
  host?: string;
  domain?: string;
  port: number;
  env: Record<string, string>;
};

export type HostOptions = {
  host?: string;
  domain?: string;
  port?: string;
  "https-port"?: string;
  "tls-cert"?: string;
  "tls-key"?: string;
  "tls-ca"?: string;
  "http-only"?: boolean;
};

export function hasTlsOptions(options: HostOptions) {
  return (
    options["tls-cert"] !== undefined ||
    options["tls-key"] !== undefined ||
    options["tls-ca"] !== undefined ||
    options["https-port"] !== undefined
  );
}

export function configureHost(
  options: HostOptions,
  previous: HostConfig = { port: 8765, env: {} },
  environment: NodeJS.ProcessEnv = process.env,
): HostConfig {
  const cfg = { ...previous, env: { ...previous.env } };
  if (options.host === "auto") delete cfg.host;
  else if (options.host !== undefined) cfg.host = listenAddress(options.host);
  if (options.domain === "") delete cfg.domain;
  else if (options.domain !== undefined)
    cfg.domain = domainName(options.domain);
  if (options.port !== undefined) cfg.port = portNumber(options.port);

  for (const k of ["UPSCAYL_APP", "UPSCAYL_MODELS_DIR", "UPSCAYL_DIST"])
    if (environment[k]) cfg.env[k] = resolve(environment[k]!);

  const entries = [
    ["UPSCAYL_TLS_CERT", options["tls-cert"]],
    ["UPSCAYL_TLS_KEY", options["tls-key"]],
    ["UPSCAYL_TLS_CA", options["tls-ca"]],
    ["UPSCAYL_TLS_PORT", options["https-port"]],
  ] as const;
  for (const [key, option] of entries) {
    if (options["http-only"] && option !== undefined)
      throw Error("Use --http-only on its own when clearing HTTPS settings.");
    const value = options["http-only"] ? "" : (option ?? environment[key]);
    if (value === undefined) continue;
    if (!value) delete cfg.env[key];
    else
      cfg.env[key] =
        key === "UPSCAYL_TLS_PORT" ? String(portNumber(value)) : resolve(value);
  }
  return cfg;
}
