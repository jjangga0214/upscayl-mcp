import { networkInterfaces } from "node:os";
import { isIPv4 } from "node:net";
import { domainToASCII } from "node:url";

export function privateIPv4(ip: string) {
  if (!isIPv4(ip)) return false;
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}
export function listenAddress(requested?: string) {
  const interfaces = networkInterfaces();
  if (requested) {
    if (
      !privateIPv4(requested) ||
      !Object.values(interfaces)
        .flat()
        .some((i) => i?.address === requested)
    )
      throw Error("Host must be an assigned private IPv4 or loopback address.");
    return requested;
  }
  const route =
    process.platform === "darwin"
      ? Bun.spawnSync(["/sbin/route", "-n", "get", "default"])
          .stdout.toString()
          .match(/interface:\s*(\S+)/)?.[1]
      : undefined;
  const addresses = [
    ...(route ? (interfaces[route] ?? []) : []),
    ...Object.entries(interfaces)
      .filter(([key]) => !/^utun|^bridge|^docker|^veth/.test(key))
      .flatMap(([, v]) => v ?? []),
  ];
  const lan = addresses.find((i) => !i.internal && privateIPv4(i.address));
  if (!lan)
    throw Error(
      "No private LAN IPv4 address available. For local testing specify --host 127.0.0.1.",
    );
  return lan.address;
}
export function portNumber(value: unknown) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535)
    throw Error("Port must be an integer from 1 to 65535.");
  return n;
}

export function domainName(value: string) {
  if (value === "") return undefined;
  const input = value.replace(/\.$/, "");
  const name = domainToASCII(input).toLowerCase();
  if (
    !/^[\p{L}\p{N}\p{M}.\-]+$/u.test(input) ||
    !name ||
    name.length > 253 ||
    isIPv4(name) ||
    !name
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw Error(
      "Use a DNS hostname for --domain and a private IPv4 for --host.",
    );
  return name;
}

export function serverOrigin(
  scheme: "http" | "https",
  name: string,
  port: number,
) {
  return new URL(scheme + "://" + name + ":" + port).origin;
}
