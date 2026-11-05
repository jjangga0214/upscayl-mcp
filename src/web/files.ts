import { t } from "./language";
import { zipSync } from "fflate";
import type { Options } from "../engine";

export type Picture = {
  url: string;
  name: string;
  width: number;
  height: number;
};
export type Entry = Picture & { file: File; result?: Picture & { blob: Blob } };
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await response(path, init)).json();
}
async function response(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok)
    throw Error(
      (await res.json().catch(() => ({}))).error ??
        t("Server request failed") + " (" + res.status + ")",
    );
  return res;
}
export function release(entry: Entry) {
  URL.revokeObjectURL(entry.url);
  if (entry.result) URL.revokeObjectURL(entry.result.url);
}
export async function readFiles(files: File[], folder: boolean) {
  const supported = files.filter(
    (f) =>
      /\.(png|jpe?g|jfif|webp)$/i.test(f.name) &&
      (!folder ||
        !f.webkitRelativePath ||
        f.webkitRelativePath.split("/").length === 2),
  );
  if (!supported.length) throw Error(t("Choose a PNG, JPG or WebP image."));
  if (supported.some((f) => f.size > 32 * 1024 * 1024))
    throw Error(t("The maximum file size is 32 MiB per image."));
  const entries: Entry[] = [];
  try {
    for (const file of supported) {
      const url = URL.createObjectURL(file);
      const entry = { file, name: file.name, url, width: 0, height: 0 };
      entries.push(entry);
      const img = new Image();
      img.src = url;
      await img.decode();
      entry.width = img.naturalWidth;
      entry.height = img.naturalHeight;
    }
    return entries;
  } catch (e) {
    entries.forEach(release);
    throw e;
  }
}
type Job = {
  job_id: string;
  status: string;
  progress: string;
  result: string;
  error?: string;
};
export type ProcessingStep =
  | { stage: "upload" | "prepare" | "queued" | "receive" | "cancel" }
  | {
      stage: "process";
      pass?: { index: number; total: number; percent?: number };
    };

function jobStep(job: Job): ProcessingStep {
  if (job.status === "queued") return { stage: "queued" };
  const match = /^pass (\d+)\/(\d+)(?: (\d+(?:\.\d+)?)%)?$/.exec(job.progress);
  if (!match) return { stage: "process" };
  return {
    stage: "process",
    pass: {
      index: Number(match[1]),
      total: Number(match[2]),
      percent:
        match[3] === undefined
          ? undefined
          : Math.min(100, Math.round(Number(match[3]))),
    },
  };
}
export async function processImage(
  entry: Entry,
  options: Options,
  signal: AbortSignal,
  onJob: (id: string) => void,
  progress: (step: ProcessingStep) => void,
) {
  const { file_id } = await request<{ file_id: string }>("/files", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: entry.file,
    signal,
  });
  progress({ stage: "prepare" });
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, options }),
    signal,
  };
  const plan = await request<{ output: { width: number; height: number } }>(
    "/explain",
    init,
  );
  signal.throwIfAborted();
  // Once submitted, collect the job ID even if the user cancels during the response.
  let job = await request<Job>("/jobs", {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  onJob(job.job_id);
  signal.throwIfAborted();
  while (job.status === "queued" || job.status === "running") {
    progress(jobStep(job));
    await new Promise((resolve) => setTimeout(resolve, 320));
    job = await request<Job>("/jobs/" + job.job_id, { signal });
  }
  if (job.status !== "done")
    throw Error(job.error || t("The job was interrupted."));
  progress({ stage: "receive" });
  const blob = await (await response(job.result, { signal })).blob();
  signal.throwIfAborted();
  const suffix =
    (options.width ? options.width + "px" : options.scale + "x") +
    (options.double ? "_double" : "");
  return {
    ...plan.output,
    name:
      entry.name.replace(/\.[^.]+$/, "") +
      "_upscayl_" +
      suffix +
      "_" +
      options.model +
      "." +
      options.format,
    url: URL.createObjectURL(blob),
    blob,
  };
}
export function save(picture: { url: string; name: string }) {
  const a = document.createElement("a");
  a.href = picture.url;
  a.download = picture.name;
  document.body.append(a);
  a.click();
  a.remove();
}
export async function saveZip(entries: Entry[]) {
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const { result } of entries) {
    if (!result) continue;
    let name = result.name.replace(/[/\\]/g, "_");
    while (Object.hasOwn(files, name)) name = "_" + name;
    files[name] = new Uint8Array(await result.blob.arrayBuffer());
  }
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
      type: "application/zip",
    }),
  );
  save({ url, name: "upscayl-results.zip" });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
