import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  inspect,
  plan,
  selectModel,
  upscale,
  type Engine,
  type Options,
} from "./engine";

const hour = 3600_000;
export const maxUpload = 32 * 1024 * 1024;
type Upload = {
  path: string;
  size: Awaited<ReturnType<typeof inspect>>;
  touched: number;
};
type Job = {
  id: string;
  fileId: string;
  options: Options;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: string;
  updated: number;
  error?: string;
  controller: AbortController;
};

export class Jobs {
  readonly uploads = new Map<string, Upload>();
  readonly jobs = new Map<string, Job>();
  private busy = false;
  private receiving = 0;
  private activeId?: string;
  constructor(
    readonly root: string,
    readonly backend: Engine,
  ) {}
  static async create(backend: Engine) {
    const parent = join(
      tmpdir(),
      "upscayl-mcp-" + (process.getuid?.() ?? "user"),
    );
    await mkdir(parent, { recursive: true, mode: 0o700 });
    // Only stale private run directories from earlier processes.
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      const match = /^run-(\d+)-[a-zA-Z0-9]+$/.exec(entry.name);
      if (!entry.isDirectory() || !match) continue;
      try {
        process.kill(Number(match[1]), 0);
        continue;
      } catch {
        /* previous process exited */
      }
      const path = join(parent, entry.name);
      if (Date.now() - (await stat(path)).mtimeMs > 24 * hour)
        await rm(path, { recursive: true, force: true });
    }
    return new Jobs(
      await mkdtemp(join(parent, "run-" + process.pid + "-")),
      backend,
    );
  }
  async receive(req: Request) {
    if (!req.body) throw Error("Missing upload body.");
    if (this.receiving >= 2 || this.uploads.size + this.receiving >= 40)
      throw Error("Upload capacity reached.");
    if (Number(req.headers.get("content-length")) > maxUpload)
      throw Error("Upload exceeds 32 MiB.");
    this.receiving++;
    const id = crypto.randomUUID();
    const tmp = join(this.root, id + ".upload");
    try {
      const body = await req.arrayBuffer(); // Bun.serve enforces maxRequestBodySize for streamed bodies as well.
      if (!body.byteLength || body.byteLength > maxUpload)
        throw Error("Expected an image of up to 32 MiB.");
      await Bun.write(tmp, body);
      const size = await inspect(tmp);
      const path = join(this.root, id + "." + size.type);
      await Bun.write(path, Bun.file(tmp));
      this.uploads.set(id, { path, size, touched: Date.now() });
      return { file_id: id, ...size };
    } finally {
      this.receiving--;
      await rm(tmp, { force: true });
    }
  }
  explain(id: string, opt: Options) {
    const file = this.uploads.get(id);
    if (!file) throw Error("Unknown or expired file_id.");
    return plan(file.size, opt, selectModel(this.backend, opt));
  }
  submit(ids: string[], opt: Options) {
    if (ids.length > 1 && opt.double)
      throw Error("Use single-image mode for Double Upscayl.");
    if (this.jobs.size + ids.length > 32)
      throw Error("Job capacity reached; download and release completed jobs.");
    for (const id of ids) {
      const result = this.explain(id, opt);
      for (const pass of result.passes) {
        for (const size of [pass.ai, pass.input, pass.output]) {
          if (
            size.width * size.height > 96_000_000 ||
            Math.max(size.width, size.height) > 32768
          )
            throw Error(
              "This job exceeds the LAN limit of 96 MP or 32768 pixels per side, including intermediate images.",
            );
        }
      }
    }
    const accepted = ids.map((fileId) => {
      const id = crypto.randomUUID();
      const job: Job = {
        id,
        fileId,
        options: opt,
        status: "queued",
        progress: "",
        updated: Date.now(),
        controller: new AbortController(),
      };
      this.uploads.get(fileId)!.touched = Date.now();
      this.jobs.set(id, job);
      return this.view(id);
    });
    void this.drain();
    return accepted;
  }
  resultPath(job: Job) {
    return join(this.root, job.id + "-result." + job.options.format);
  }
  view(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw Error("Unknown or expired job_id.");
    return {
      job_id: id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      comparison:
        job.status === "done" ? "/jobs/" + id + "/compare" : undefined,
      result: job.status === "done" ? "/jobs/" + id + "/result" : undefined,
    };
  }
  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw Error("Unknown job_id.");
    if (job.status === "queued" || job.status === "running") {
      job.controller.abort();
      job.status = "cancelled";
      job.updated = Date.now();
    }
    return this.view(id);
  }
  async release(id: string) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (
      job.status === "queued" ||
      job.status === "running" ||
      this.activeId === id
    )
      throw Error("Wait for the job to finish stopping.");
    await rm(this.resultPath(job), { force: true });
    this.jobs.delete(id);
  }
  async expire() {
    for (const [id, j] of this.jobs) {
      if (
        Date.now() - j.updated > hour &&
        !["queued", "running"].includes(j.status)
      )
        await this.release(id);
    }
    const inUse = new Set([...this.jobs.values()].map((j) => j.fileId));
    for (const [id, file] of this.uploads) {
      if (Date.now() - file.touched > hour && !inUse.has(id)) {
        this.uploads.delete(id);
        await rm(file.path, { force: true });
      }
    }
  }
  private async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const job of this.jobs.values()) {
        if (job.status !== "queued") continue;
        job.status = "running";
        this.activeId = job.id;
        const timer = setTimeout(
          () => job.controller.abort(Error("Exceeded 30 minutes.")),
          30 * 60_000,
        );
        try {
          await upscale(
            this.backend,
            this.uploads.get(job.fileId)!.path,
            this.resultPath(job),
            job.options,
            false,
            job.controller.signal,
            (p) => {
              job.progress = p;
            },
          );
          job.controller.signal.throwIfAborted();
          job.status = "done";
        } catch (err) {
          job.status = job.controller.signal.aborted ? "cancelled" : "failed";
          job.error = (
            err instanceof Error ? err.message : String(err)
          ).replaceAll(this.root, "<job>");
        } finally {
          clearTimeout(timer);
          job.updated = Date.now();
          this.activeId = undefined;
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
