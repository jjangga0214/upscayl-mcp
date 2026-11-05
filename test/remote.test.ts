import { expect, test } from "bun:test";
import { createServer } from "node:net";
import { once } from "node:events";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { engine } from "../src/engine";

let ready = false;
try {
  ready = engine().models.has("upscayl-standard-4x");
} catch {}
test.skipIf(!ready)(
  "MCP handshake, real upscaling, preview, limits, download and cleanup",
  async () => {
    const probe = createServer().listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>((r) => probe.close(() => r()));
    const base = "http://127.0.0.1:" + port;
    const child = Bun.spawn(
      [
        process.execPath,
        "src/cli.ts",
        "server",
        "run",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { stdout: "ignore", stderr: "inherit" },
    );
    const client = new Client({ name: "upscayl-test", version: "1" });
    try {
      let ok = false;
      for (let i = 0; i < 60; i++) {
        try {
          ok = (await fetch(base + "/health")).ok;
        } catch {}
        if (ok) break;
        await Bun.sleep(100);
      }
      expect(ok).toBe(true);
      expect(await (await fetch(base)).text()).toContain(
        base + "/downloads/upscayl-skill.zip",
      );
      expect(
        await (await fetch(base, { headers: { Accept: "text/html" } })).text(),
      ).toContain('href="/manifest.json"');
      const manifest = await (await fetch(base + "/manifest.json")).json();
      expect(manifest.mcp).toBe(base + "/mcp");
      expect(manifest.cache_ttl_seconds).toBe(300);
      expect(
        await (
          await fetch(base, { headers: { Accept: "application/json" } })
        ).json(),
      ).toEqual(manifest);
      expect(await (await fetch(manifest.setup)).text()).toContain(
        manifest.codex,
      );
      expect(
        (await fetch(base + "/studio/sample-4x.png")).headers.get(
          "Content-Type",
        ),
      ).toContain("image/png");
      expect(
        (
          await fetch(base, {
            headers: {
              Accept: "text/html",
              "User-Agent": "Mozilla/5.0 (compatible; GPTBot/1.2)",
            },
          })
        ).headers.get("Vary"),
      ).toContain("User-Agent");
      expect(
        await (
          await fetch(base, {
            headers: { Accept: "text/html", "User-Agent": "GPTBot/1.2" },
          })
        ).text(),
      ).toContain(manifest.codex);
      expect(
        (await fetch(base + "/llms.txt")).headers.get("Content-Type"),
      ).toContain("text/markdown");
      const webManifest = await (await fetch(base + "/app.webmanifest")).json();
      expect(webManifest.start_url).toBe("/app");
      for (const icon of webManifest.icons) {
        const iconData = Buffer.from(
          await (await fetch(base + icon.src)).arrayBuffer(),
        );
        expect(
          iconData.readUInt32BE(16) + "x" + iconData.readUInt32BE(20),
        ).toBe(icon.sizes);
      }
      const catalog = await (await fetch(base + "/models")).json();
      const standard = catalog.find(
        (m: { id: string }) => m.id === "upscayl-standard-4x",
      );
      expect(standard.description).toContain("대부분");
      if (standard.preview)
        for (const side of ["before", "after"])
          expect(
            (
              await fetch(
                base + "/studio/models/" + standard.id + "/" + side + ".webp",
              )
            ).headers.get("Content-Type"),
          ).toBe("image/webp");
      expect(manifest.skills.client.url).toBe(manifest.skill);
      expect(manifest.skills.client.sha256).toBe(manifest.skill_sha256);
      const hostZip = await fetch(manifest.skills.host.url);
      expect(hostZip.status).toBe(200);
      expect(
        new Bun.CryptoHasher("sha256")
          .update(await hostZip.arrayBuffer())
          .digest("hex"),
      ).toBe(manifest.skills.host.sha256);
      const bytes = await (await fetch(manifest.skill)).arrayBuffer();
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(
        manifest.skill_sha256,
      );
      expect(
        (
          await fetch(base + "/files", {
            method: "POST",
            headers: { origin: "https://elsewhere.example" },
          })
        ).status,
      ).toBe(403);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(manifest.mcp)),
      );
      expect((await client.listTools()).tools.map((t) => t.name)).toContain(
        "upscale_batch",
      );
      const file = await (
        await fetch(base + "/files", {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: Bun.file(join(import.meta.dir, "fixtures/gradient.png")),
        })
      ).json();
      const call = async (name: string, args: Record<string, unknown>) => {
        const response = await client.callTool({ name, arguments: args });
        if (response.isError) throw Error(JSON.stringify(response.content));
        return JSON.parse((response.content as { text: string }[])[0].text);
      };
      const explanation = await call("explain_upscale", {
        file_id: file.file_id,
        options: { scale: 8 },
      });
      expect(explanation.passes[0].ai.width).toBe(128);
      const job = await call("upscale", {
        file_id: file.file_id,
        options: { scale: 2 },
      });
      let result;
      for (let i = 0; i < 100; i++) {
        result = await call("get_job", { job_id: job.job_id });
        if (!["queued", "running"].includes(result.status)) break;
        await Bun.sleep(100);
      }
      expect(result.status).toBe("done");
      const timeLeft = Date.parse(result.expires_at) - Date.now();
      expect(timeLeft).toBeGreaterThan(290000);
      expect(timeLeft).toBeLessThanOrEqual(300000);
      const image = Buffer.from(
        await (await fetch(base + result.result)).arrayBuffer(),
      );
      expect(image.readUInt32BE(16)).toBe(64);
      expect(image.readUInt32BE(20)).toBe(48);
      expect((await fetch(base + result.comparison)).status).toBe(200);
      expect(
        (await fetch(base + "/jobs/" + job.job_id + "/original")).status,
      ).toBe(200);
      expect(
        (await fetch(base + "/jobs/" + job.job_id, { method: "DELETE" }))
          .status,
      ).toBe(204);
      expect((await fetch(base + result.result)).status).toBe(404);
      expect(
        (await fetch(base + "/files/" + file.file_id, { method: "DELETE" }))
          .status,
      ).toBe(204);
    } finally {
      await client.close();
      child.kill("SIGTERM");
      await child.exited;
    }
  },
  30000,
);
