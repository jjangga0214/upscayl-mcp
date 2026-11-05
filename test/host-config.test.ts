import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpsSettings } from "../src/tls";
import { manifest } from "../src/assets";
import { agentGuide } from "../src/discovery";
import { home } from "../src/home";
import { configureHost } from "../src/host-config";
import { domainName, serverOrigin } from "../src/network";

test("a saved IP-only service can add and remove a name and TLS overrides", () => {
  const saved = {
    host: "127.0.0.1",
    port: 8765,
    env: { UPSCAYL_TLS_CERT: "/legacy/cert", UPSCAYL_TLS_KEY: "/legacy/key" },
  };
  const next = configureHost(
    {
      domain: "Studio.Home.ARPA.",
      port: "9080",
      "https-port": "9443",
      "tls-ca": "/new/root",
      "tls-cert": "/new/cert",
    },
    saved,
    { UPSCAYL_TLS_CERT: "/ignored/cert" },
  );
  expect(next.domain).toBe("studio.home.arpa");
  expect(next.port).toBe(9080);
  expect(next.env).toEqual({
    UPSCAYL_TLS_CERT: "/new/cert",
    UPSCAYL_TLS_KEY: "/legacy/key",
    UPSCAYL_TLS_PORT: "9443",
    UPSCAYL_TLS_CA: "/new/root",
  });
  expect(configureHost({}, next, {})).toEqual(next);
  expect(
    configureHost({ "tls-ca": "" }, next, {}).env.UPSCAYL_TLS_CA,
  ).toBeUndefined();
  expect(
    configureHost({ host: "auto", domain: "", "http-only": true }, next, {}),
  ).toEqual({ port: 9080, env: {} });
  expect(saved.env.UPSCAYL_TLS_CERT).toBe("/legacy/cert");
});

test("addresses use configured DNS names or IPs and normalize default ports", () => {
  expect(serverOrigin("https", domainName("사진.home.arpa")!, 443)).toBe(
    new URL("https://사진.home.arpa").origin,
  );
  expect(serverOrigin("http", "127.0.0.1", 80)).toBe("http://127.0.0.1");
  for (const bad of [
    "https://studio.home.arpa",
    "*.local",
    "a:123",
    "u@host",
    "ok.com/other",
    "192.168.1.1",
    "a..b",
    "foo%2ecom",
    "-d.test",
    "0x7f000001",
  ])
    expect(() => domainName(bad)).toThrow();
});

test.skipIf(!Bun.which("openssl"))(
  "a DNS-only certificate can advertise a custom HTTPS port and an optional verifiable CA",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "upscayl-domain-test-"));
    try {
      const key = join(root, "key.pem"),
        cert = join(root, "cert.pem"),
        conf = join(root, "openssl.cnf");
      await Bun.write(
        conf,
        "[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=LAN test\n[ext]\nsubjectAltName=DNS:studio.home.arpa\nbasicConstraints=critical,CA:TRUE\n",
      );
      const gen = Bun.spawnSync([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-config",
        conf,
        "-out",
        cert,
        "-keyout",
        key,
      ]);
      expect(gen.exitCode).toBe(0);
      const env = {
        UPSCAYL_TLS_KEY: key,
        UPSCAYL_TLS_CERT: cert,
        UPSCAYL_TLS_PORT: "9443",
      };
      const base = "http://studio.home.arpa:9080";
      const external = manifest(
        base,
        "en",
        httpsSettings("studio.home.arpa", 9080, env),
      );
      expect(external.tls).toEqual({
        enabled: true,
        url: "https://studio.home.arpa:9443",
        ca: null,
      });
      const secure = httpsSettings("studio.home.arpa", 9080, {
        ...env,
        UPSCAYL_TLS_CA: cert,
      })!;
      const info = manifest(base, "en", secure);
      expect(info.tls).toEqual({
        enabled: true,
        url: "https://studio.home.arpa:9443",
        ca: { url: base + "/pwa-ca.cer", sha256: secure.ca!.fingerprint256 },
      });
      expect(info.opencode.mcp.upscayl.url).toBe(base + "/mcp");
      for (const locale of ["en", "ko"] as const) {
        for (const guide of [agentGuide(info, locale), home(info, locale)]) {
          expect(guide).toContain(secure.url);
          expect(guide).toContain(secure.ca!.fingerprint256);
          expect(guide).toContain(base + "/pwa-ca.cer");
        }
      }
      expect(() => httpsSettings("127.0.0.1", 9080, env)).toThrow(
        /subjectAltName/,
      );
      expect(() => httpsSettings("other.home.arpa", 9080, env)).toThrow(
        /subjectAltName/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
