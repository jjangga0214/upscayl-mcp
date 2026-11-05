import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_MS, Jobs } from "../src/jobs";
import { engine, optionsSchema } from "../src/engine";

const source = join(import.meta.dir, "fixtures/gradient.png");
const upload = (jobs: Jobs) =>
  jobs.receive(
    new Request("http://localhost/files", {
      method: "POST",
      body: Bun.file(source),
    }),
  );
const sleepUntil = (deadline: number) =>
  Bun.sleep(Math.max(0, deadline - Date.now()));
test("unsubmitted uploads are physically removed by a scheduled timer", async () => {
  expect(CACHE_MS).toBe(300000);
  const root = await mkdtemp(join(tmpdir(), "upscayl-cache-test-"));
  try {
    const jobs = new Jobs(root, { bin: "", models: new Map() }, 100);
    await upload(jobs);
    expect(await readdir(root)).toHaveLength(1);
    await Bun.sleep(250);
    expect(await readdir(root)).toEqual([]);
    expect(jobs.uploads.size).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
let ready = false;
try {
  ready = engine().models.has("upscayl-standard-4x");
} catch {}
test.skipIf(!ready)(
  "queued work pins its source; independent terminal deadlines survive reads",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "upscayl-cache-test-"));
    try {
      const jobs = new Jobs(root, engine(), 300);
      const file = await upload(jobs);
      const opt = optionsSchema.parse({ scale: 2 });
      const [first, second] = jobs.submit([file.file_id, file.file_id], opt);
      let last = jobs.view(second.job_id);
      while (last.status === "running" || last.status === "queued") {
        await Bun.sleep(20);
        last = jobs.view(second.job_id);
      }
      expect(last.status).toBe("done");
      const deadline = Date.parse(last.expires_at!);
      await sleepUntil(deadline - 100);
      expect(jobs.view(second.job_id).expires_at).toBe(last.expires_at);
      expect(jobs.explain(file.file_id, opt).output.width).toBe(64);
      await sleepUntil(deadline + 80);
      expect(await readdir(root)).toEqual([]);
      expect(() => jobs.view(first.job_id)).toThrow();
      expect(() => jobs.view(second.job_id)).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  10000,
);
test.skipIf(!ready)(
  "failed and cancelled batch items release originals without a client DELETE",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "upscayl-cache-test-"));
    try {
      const jobs = new Jobs(root, { ...engine(), bin: "/usr/bin/false" }, 150);
      const file = await upload(jobs);
      const [failure, cancel] = jobs.submit(
        [file.file_id, file.file_id],
        optionsSchema.parse({}),
      );
      expect(jobs.cancel(cancel.job_id).status).toBe("cancelled");
      while (jobs.view(failure.job_id).status === "running")
        await Bun.sleep(10);
      expect(jobs.view(failure.job_id).status).toBe("failed");
      await Bun.sleep(300);
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
