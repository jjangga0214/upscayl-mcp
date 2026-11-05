import { mkdir, mkdtemp, readdir, rm, rename } from "node:fs/promises";
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

export const CACHE_MS = 5 * 60_000;
export const maxUpload = 32 * 1024 * 1024;
type Upload = {
  path: string;
  size: Awaited<ReturnType<typeof inspect>>;
  bytes: number;
  touched: number;
};
type Job = {
  id: string;
  fileId: string;
  options: Options;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: string;
  reservedBytes: number;
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
  private wake?: ReturnType<typeof setTimeout>;
  nextExpiry = Infinity;
  constructor(
    readonly root: string,
    readonly backend: Engine,
    readonly ttl = CACHE_MS,
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
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ESRCH") continue;
      }
      const path = join(parent, entry.name);
      await rm(path, { recursive: true, force: true });
    }
    return new Jobs(
      await mkdtemp(join(parent, "run-" + process.pid + "-")),
      backend,
    );
  }
  async receive(req: Request) {
    if (!req.body) throw Error("Missing upload body.");
    const held = [...this.uploads.values()].reduce(
      (bytes, file) => bytes + file.bytes,
      0,
    );
    if (
      this.receiving >= 2 ||
      this.uploads.size + this.receiving >= 512 ||
      held + (this.receiving + 1) * maxUpload > 1024 ** 3
    )
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
      await rename(tmp, path);
      this.uploads.set(id, {
        path,
        size,
        bytes: body.byteLength,
        touched: Date.now(),
      });
      this.scheduleExpiry();
      return { file_id: id, ...size };
    } finally {
      this.receiving--;
      await rm(tmp, { force: true });
    }
  }
  explain(id: string, opt: Options) {
    const file = this.uploads.get(id);
    if (
      !file ||
      (file.touched + this.ttl <= Date.now() && !this.pinnedFiles().has(id))
    )
      throw Error("Unknown or expired file_id.");
    return plan(file.size, opt, selectModel(this.backend, opt));
  }
  submit(ids: string[], opt: Options) {
    if (ids.length > 1 && opt.double)
      throw Error("Use single-image mode for Double Upscayl.");
    const existing = [...this.jobs.values()];
    if (
      existing.filter((j) => !this.finished(j)).length + ids.length > 32 ||
      existing.length + ids.length > 512
    )
      throw Error("Job capacity reached; download and release completed jobs.");
    const reservations = ids.map((id) => {
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
      return 1024 ** 2 + result.output.width * result.output.height * 5;
    });
    const reserved = existing.reduce((n, j) => n + j.reservedBytes, 0);
    if (reservations.reduce((n, v) => n + v, reserved) > 4 * 1024 ** 3)
      throw Error(
        "Result cache is full. Wait for its five-minute expiry or release completed jobs.",
      );
    const accepted = ids.map((fileId, index) => {
      const id = crypto.randomUUID();
      const job: Job = {
        id,
        fileId,
        reservedBytes: reservations[index],
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
    this.scheduleExpiry();
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
      expires_at: this.finished(job)
        ? new Date(job.updated + this.ttl).toISOString()
        : undefined,
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
      this.finish(job);
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
    this.scheduleExpiry();
  }
  private finished(job: Job) {
    return (
      job.id !== this.activeId &&
      job.status !== "running" &&
      job.status !== "queued"
    );
  }
  private finish(job: Job) {
    job.updated = Date.now();
    if (job.status === "done")
      job.reservedBytes = Bun.file(this.resultPath(job)).size;
    else if (this.finished(job)) job.reservedBytes = 0;
    const upload = this.uploads.get(job.fileId);
    if (upload) upload.touched = job.updated;
    this.scheduleExpiry();
  }
  private pinnedFiles() {
    return new Set(
      [...this.jobs.values()]
        .filter((job) => !this.finished(job))
        .map((job) => job.fileId),
    );
  }
  private scheduleExpiry(retryDelay = 0) {
    clearTimeout(this.wake);
    const pinned = this.pinnedFiles();
    const deadlines = [
      ...[...this.jobs.values()]
        .filter((job) => this.finished(job))
        .map((job) => job.updated + this.ttl),
      ...[...this.uploads.entries()]
        .filter(([id]) => !pinned.has(id))
        .map(([, file]) => file.touched + this.ttl),
    ];
    this.nextExpiry = Math.min(...deadlines);
    if (Number.isFinite(this.nextExpiry))
      this.wake = setTimeout(
        () => {
          void this.expire().catch((err) =>
            console.error("Cache cleanup:", err),
          );
        },
        Math.max(retryDelay, this.nextExpiry - Date.now(), 1),
      ).unref();
  }
  async expire() {
    const now = Date.now(),
      pinned = this.pinnedFiles();
    const pending: Promise<void>[] = [];
    for (const [id, job] of this.jobs)
      if (this.finished(job) && job.updated + this.ttl <= now) {
        pending.push(
          rm(this.resultPath(job), { force: true }).then(() => {
            this.jobs.delete(id);
          }),
        );
      }
    for (const [id, file] of this.uploads)
      if (!pinned.has(id) && file.touched + this.ttl <= now) {
        pending.push(
          rm(file.path, { force: true }).then(() => {
            this.uploads.delete(id);
          }),
        );
      }
    try {
      await Promise.all(pending);
    } finally {
      this.scheduleExpiry(100);
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
          this.activeId = undefined;
          this.finish(job);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
