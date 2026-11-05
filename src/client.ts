import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { inspect, plan, publishFile, type Options } from "./engine";

export function endpoint(value: string) {
  const url = new URL(value.includes("://") ? value : "http://" + value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("Provide the server HTTP(S) origin.");
  return url.origin;
}
async function checked(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok)
    throw Error("Server " + r.status + ": " + (await r.text()).slice(0, 1600));
  return r;
}
export async function remoteModels(base: string) {
  return (await checked(base + "/models")).json();
}
export async function remoteFile(
  base: string,
  input: string,
  dest: string,
  opt: Options,
  explain: boolean,
  overwrite: boolean,
  signal: AbortSignal,
  onProgress?: (s: string) => void,
) {
  if (
    !explain &&
    extname(dest).toLowerCase().replace(".jpeg", ".jpg") !== "." + opt.format
  )
    throw Error("Output extension must match format.");
  if (!explain && existsSync(dest)) {
    if ((await realpath(input)) === (await realpath(dest)))
      throw Error("Choose a different output from the original.");
    if (!overwrite) {
      const models = (await remoteModels(base)) as {
        id: string;
        nativeScale: number;
      }[];
      const model = models.find((m) => m.id === opt.model);
      if (!model) throw Error("Unknown model on remote host: " + opt.model);
      const expected = plan(await inspect(input), opt, {
        ...model,
        folder: "",
      }).output;
      const existing = await inspect(dest);
      if (
        existing.width !== expected.width ||
        existing.height !== expected.height ||
        existing.type !== opt.format
      )
        throw Error(
          "Existing result differs in size or format. Use --overwrite or choose another output.",
        );
      return { path: resolve(dest), reused: true, ...existing };
    }
  }
  const upload = await (
    await checked(base + "/files", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: Bun.file(input),
      signal,
    })
  ).json();
  let jobUrl: string | undefined;
  try {
    const request = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: upload.file_id, options: opt }),
      signal,
    };
    const plan = await (await checked(base + "/explain", request)).json();
    if (explain) return plan;
    let job = await (await checked(base + "/jobs", request)).json();
    jobUrl = base + "/jobs/" + job.job_id;
    while (job.status === "queued" || job.status === "running") {
      signal.throwIfAborted();
      onProgress?.(job.progress || job.status);
      await Bun.sleep(600);
      job = await (await checked(jobUrl, { signal })).json();
    }
    if (job.status !== "done") throw Error(job.error || job.status);
    await mkdir(dirname(dest), { recursive: true });
    const tmp = await mkdtemp(join(dirname(dest), ".upscayl-"));
    try {
      const staged = join(tmp, basename(dest));
      await Bun.write(staged, await checked(jobUrl + "/result", { signal }));
      const size = await inspect(staged);
      if (
        size.width !== plan.output.width ||
        size.height !== plan.output.height ||
        size.type !== opt.format
      )
        throw Error(
          "Downloaded result does not match the requested dimensions or format.",
        );
      await publishFile(staged, dest, overwrite);
      return { path: resolve(dest), reused: false, ...size };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  } finally {
    // A local cancellation also releases the remote GPU.
    if (jobUrl && signal.aborted) {
      await fetch(jobUrl + "/cancel", {
        method: "POST",
        signal: AbortSignal.timeout(1500),
      }).catch(() => {});
    }
  }
}
