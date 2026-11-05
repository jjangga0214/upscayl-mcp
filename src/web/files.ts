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
        "서버 요청 실패 (" + res.status + ")",
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
  if (!supported.length) throw Error("PNG, JPG 또는 WebP 이미지를 선택하세요.");
  if (supported.some((f) => f.size > 32 * 1024 * 1024))
    throw Error("이미지 한 장의 최대 크기는 32 MiB입니다.");
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
export async function processImage(
  entry: Entry,
  options: Options,
  signal: AbortSignal,
  onJob: (id: string) => void,
  progress: (text: string) => void,
) {
  const { file_id } = await request<{ file_id: string }>("/files", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: entry.file,
    signal,
  });
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
  let job = await request<Job>("/jobs", init);
  onJob(job.job_id);
  while (job.status === "queued" || job.status === "running") {
    const pass = /pass (\d+)\/(\d+) ([\d.]+)%/.exec(job.progress);
    progress(
      job.status === "queued"
        ? "GPU 대기 중…"
        : "업스케일 중…" +
            (pass
              ? " " +
                Math.round(
                  (100 * (Number(pass[1]) - 1 + Number(pass[3]) / 100)) /
                    Number(pass[2]),
                ) +
                "%"
              : ""),
    );
    await new Promise((resolve) => setTimeout(resolve, 320));
    job = await request<Job>("/jobs/" + job.job_id, { signal });
  }
  if (job.status !== "done") throw Error(job.error || "작업이 중단되었습니다.");
  progress("결과를 가져오는 중…");
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
