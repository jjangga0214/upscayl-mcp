const $ = (id) => document.getElementById(id);
const sample = {
  name: "rainier.jpg",
  width: 320,
  height: 216,
  url: "/studio/sample.jpg",
  demo: true,
  result: {
    url: "/studio/sample-4x.png",
    width: 1280,
    height: 864,
    name: "rainier_4x.png",
    label: "4× 확대",
  },
};
const modelNames = {
  "upscayl-standard-4x": [
    "Upscayl Standard",
    "사진과 일러스트에 두루 쓰는 기본 모델",
  ],
  "upscayl-lite-4x": ["Upscayl Lite", "빠른 처리에 적합한 경량 모델"],
  "high-fidelity-4x": ["High Fidelity", "자연스러운 질감과 세부 묘사"],
  "digital-art-4x": ["Digital Art", "일러스트와 디지털 아트용"],
  "remacri-4x": ["Remacri", "자연스러운 사진에 디테일 추가 · 비상업용 모델"],
  "ultrasharp-4x": ["UltraSharp", "사진의 선명도 강조 · 비상업용 모델"],
  "ultramix-balanced-4x": [
    "Ultramix Balanced",
    "선명도와 디테일의 균형 · 비상업용 모델",
  ],
};
let entries = [sample],
  current = 0,
  folder = false,
  scale = "4",
  format = "png",
  mode = "slider",
  connected = false;
let active = null,
  activeJob = null,
  changing = 0;
const selected = () => entries[current];
const dimensions = (w, h) => w + " × " + h;
const status = (message, error = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
};
const filename = (name, opt) =>
  name.replace(/\.[^.]+$/, "") +
  "_upscayl_" +
  (opt.width ? opt.width + "px" : opt.scale + "x") +
  (opt.double ? "_double" : "") +
  "_" +
  opt.model +
  "." +
  opt.format;
function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}
async function request(path, init) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw Error(detail.error || "서버 요청 실패 (" + response.status + ")");
  }
  return response;
}
function setChoice(attr, value) {
  for (const b of document.querySelectorAll("button[data-" + attr + "]")) {
    const on = b.dataset[attr] === value;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  }
}
function settings() {
  const opt = {
    model: $("model").value,
    format,
    scale:
      scale === "custom"
        ? $("sizekind").value === "scale"
          ? Number($("customsize").value)
          : 4
        : Number(scale),
    double: $("double").checked && !folder,
    compression: Number($("compression").value),
    tile: Number($("tile").value),
    tta: $("tta").checked,
  };
  if (scale === "custom" && $("sizekind").value === "width")
    opt.width = Number($("customsize").value);
  if ($("gpu").value.trim()) opt.gpu = $("gpu").value.trim();
  return opt;
}
function renderView() {
  const item = selected(),
    out = item.result;
  $("thumb").src = item.url;
  $("filename").textContent = item.name;
  $("filemeta").textContent =
    dimensions(item.width, item.height) + " px" + (item.demo ? " · 예제" : "");
  $("sourcebadge").textContent = item.demo
    ? "예제 이미지"
    : entries.length > 1
      ? current + 1 + " / " + entries.length
      : "선택한 이미지";
  $("previewname").textContent = item.name;
  $("frame").style.setProperty("--ratio", String(item.width / item.height));
  $("before").src = item.url;
  $("after").src = out?.url ?? item.url;
  $("frame").classList.toggle("solo", !out);
  $("frame").classList.toggle("lens", !!out && mode === "lens");
  $("rightlabel").textContent = out?.label || "결과";
  $("dims").textContent =
    dimensions(item.width, item.height) +
    (out ? " → " + dimensions(out.width, out.height) : "") +
    " px";
  $("save").disabled = !out;
  for (const [id, value] of [
    ["sliderMode", "slider"],
    ["lensMode", "lens"],
  ]) {
    $(id).classList.toggle("sel", mode === value);
    $(id).setAttribute("aria-pressed", String(mode === value));
    $(id).disabled = !out;
  }
  $("batchbar").hidden = entries.length < 2;
  $("item").value = String(current);
  $("saveall").disabled = !!active || !entries.some((e) => e.result);
  $("run").disabled = !connected || !!active;
  $("run").querySelector("span").textContent =
    entries.length > 1 ? entries.length + "장 확대" : "이미지 확대";
}
function freeEntry(item) {
  if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
  if (item.result?.url.startsWith("blob:"))
    URL.revokeObjectURL(item.result.url);
}
async function loadFiles(files, isFolder = false) {
  if (active) return;
  const seq = ++changing;
  const valid = [...files].filter(
    (f) =>
      /\.(png|jpg|jpeg|jfif|webp)$/i.test(f.name) &&
      (!isFolder ||
        !f.webkitRelativePath ||
        f.webkitRelativePath.split("/").length === 2),
  );
  if (!valid.length) {
    status("PNG, JPG 또는 WebP 이미지를 선택하세요.", true);
    return;
  }
  if (valid.some((f) => f.size > 32 * 1024 * 1024)) {
    status("한 파일에 최대 32 MiB까지 열 수 있습니다.", true);
    return;
  }
  const next = [];
  try {
    for (const file of valid) {
      const url = URL.createObjectURL(file);
      const entry = { file, url, name: file.name };
      next.push(entry);
      const img = new Image();
      img.src = url;
      await img.decode();
      entry.width = img.naturalWidth;
      entry.height = img.naturalHeight;
    }
    if (seq !== changing || active) {
      next.forEach(freeEntry);
      return;
    }
    entries.forEach(freeEntry);
    entries = next;
    current = 0;
    folder = isFolder || entries.length > 1;
    $("item").replaceChildren(
      ...entries.map((e, i) => option(String(i), e.name)),
    );
    $("double").disabled = folder;
    if (folder) $("double").checked = false;
    $("canvas").classList.remove("zoom");
    $("actual").setAttribute("aria-pressed", "false");
    renderView();
    status(
      folder
        ? entries.length + "개 이미지를 열었습니다."
        : "설정을 선택하고 이미지 확대를 누르세요.",
    );
  } catch (err) {
    next.forEach(freeEntry);
    status("이미지를 읽지 못했습니다. " + err.message, true);
  }
}
function progress(message, percent) {
  status(message);
  const bar = $("progress");
  bar.hidden = false;
  if (Number.isFinite(percent)) bar.value = percent;
  else bar.removeAttribute("value");
}
async function run(event) {
  event.preventDefault();
  if (active || !connected) return;
  const opt = settings();
  if (opt.tile !== 0 && opt.tile < 32) {
    $("settings").querySelector("details").open = true;
    $("tile").focus();
    status("타일 크기는 자동(0) 또는 32 이상으로 설정하세요.", true);
    return;
  }
  ++changing;
  const controller = new AbortController();
  active = controller;
  const signal = controller.signal;
  $("settings").disabled = true;
  $("run").hidden = true;
  $("stop").hidden = false;
  $("item").disabled = true;
  $("progress").max = 100;
  try {
    for (const [i, entry] of entries.entries()) {
      current = i;
      renderView();
      const lead =
        entries.length > 1 ? i + 1 + "/" + entries.length + " · " : "";
      progress(lead + "이미지 전송 중…");
      const blob =
        entry.file || (await (await request(entry.url, { signal })).blob());
      const upload = await (
        await request("/files", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
          signal,
        })
      ).json();
      const payload = { file_id: upload.file_id, options: opt };
      const init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      };
      const plan = await (await request("/explain", init)).json();
      let job = await (await request("/jobs", init)).json();
      activeJob = job.job_id;
      while (job.status === "queued" || job.status === "running") {
        signal.throwIfAborted();
        const match = /pass (\d+)\/(\d+) ([\d.]+)%/.exec(job.progress);
        const fraction = match
          ? (Number(match[1]) - 1 + Number(match[3]) / 100) / Number(match[2])
          : undefined;
        progress(
          lead +
            (job.status === "queued" ? "GPU 대기 중…" : "확대 중…") +
            (fraction === undefined
              ? ""
              : " " + Math.round(fraction * 100) + "%"),
          fraction === undefined
            ? undefined
            : (100 * (i + fraction)) / entries.length,
        );
        await new Promise((r) => setTimeout(r, 350));
        job = await (await request("/jobs/" + activeJob, { signal })).json();
      }
      if (job.status !== "done")
        throw Error(job.error || "작업이 중단되었습니다.");
      progress(lead + "결과를 이 기기로 가져오는 중…");
      const result = await (await request(job.result, { signal })).blob();
      signal.throwIfAborted();
      const url = URL.createObjectURL(result);
      if (entry.result?.url.startsWith("blob:"))
        URL.revokeObjectURL(entry.result.url);
      entry.result = {
        url,
        blob: result,
        width: plan.output.width,
        height: plan.output.height,
        name: filename(entry.name, opt),
        label: opt.width
          ? opt.width + " px"
          : (opt.double ? opt.scale ** 2 : opt.scale) + "× 확대",
      };
      activeJob = null;
      renderView();
    }
    status("확대 완료. 이 탭에서 비교하거나 결과를 저장하세요.");
  } catch (err) {
    status(
      signal.aborted ? "작업을 취소했습니다." : "확대 실패 · " + err.message,
      !signal.aborted,
    );
  } finally {
    if (activeJob)
      void fetch("/jobs/" + activeJob + "/cancel", {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    activeJob = null;
    active = null;
    $("settings").disabled = false;
    $("run").hidden = false;
    $("stop").hidden = true;
    $("item").disabled = false;
    $("progress").hidden = true;
    renderView();
  }
}
function save(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}
$("save").onclick = () => {
  const r = selected().result;
  if (r) save(r.url, r.name);
};
$("saveall").onclick = async () => {
  $("saveall").disabled = true;
  try {
    const { zipSync } = await import("/studio/zip.js");
    const files = Object.create(null);
    for (const e of entries.filter((e) => e.result)) {
      const r = e.result;
      let name = r.name.replaceAll("/", "_").replaceAll("\\", "_");
      while (Object.hasOwn(files, name)) name = "_" + name;
      files[name] = new Uint8Array(await r.blob.arrayBuffer());
    }
    const url = URL.createObjectURL(
      new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
    );
    save(url, "upscayl-results.zip");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    status("ZIP 저장 실패 · " + err.message, true);
  } finally {
    renderView();
  }
};
$("select").onclick = () => $("files").click();
$("folders").onclick = () => $("directory").click();
for (const id of ["files", "directory"])
  $(id).onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length) void loadFiles(files, id === "directory");
  };
for (const event of ["dragover", "drop"])
  window.addEventListener(event, (e) => {
    e.preventDefault();
  });
$("workarea").ondragover = (e) => {
  e.preventDefault();
  if (!active) $("canvas").classList.add("dragging");
};
$("workarea").ondragleave = (e) => {
  if (!$("workarea").contains(e.relatedTarget))
    $("canvas").classList.remove("dragging");
};
$("workarea").ondrop = (e) => {
  e.preventDefault();
  $("canvas").classList.remove("dragging");
  if (!active) void loadFiles(e.dataTransfer.files);
};
$("item").onchange = (e) => {
  current = Number(e.target.value);
  renderView();
};
document.querySelectorAll("[data-scale]").forEach(
  (b) =>
    (b.onclick = () => {
      scale = b.dataset.scale;
      setChoice("scale", scale);
      $("custom").hidden = scale !== "custom";
      $("customsize").disabled = scale !== "custom";
    }),
);
$("sizekind").onchange = () => {
  const width = $("sizekind").value === "width";
  $("number-label").textContent = width ? "가로 (px)" : "배율";
  $("customsize").max = width ? 65535 : 16;
  $("customsize").value = width ? selected().width * 2 : 3;
};
document.querySelectorAll("[data-format]").forEach(
  (b) =>
    (b.onclick = () => {
      format = b.dataset.format;
      setChoice("format", format);
    }),
);
$("model").onchange = () => {
  $("modelhint").textContent =
    modelNames[$("model").value]?.[1] || "서버에 설치된 사용자 모델";
};
for (const [id, value] of [
  ["sliderMode", "slider"],
  ["lensMode", "lens"],
])
  $(id).onclick = () => {
    mode = value;
    renderView();
  };
$("wipe").oninput = (e) =>
  $("frame").style.setProperty("--split", e.target.value + "%");
$("frame").onpointermove = (e) => {
  if (mode !== "lens") return;
  const r = $("frame").getBoundingClientRect();
  $("frame").style.setProperty(
    "--x",
    ((e.clientX - r.left) / r.width) * 100 + "%",
  );
  $("frame").style.setProperty(
    "--y",
    ((e.clientY - r.top) / r.height) * 100 + "%",
  );
};
$("actual").onclick = () => {
  $("actual").setAttribute(
    "aria-pressed",
    String($("canvas").classList.toggle("zoom")),
  );
};
$("form").onsubmit = run;
$("stop").onclick = () => active?.abort();
window.addEventListener("pagehide", () => {
  if (activeJob) navigator.sendBeacon("/jobs/" + activeJob + "/cancel");
});
$("customsize").disabled = true;
renderView();
try {
  const models = await (await request("/models")).json();
  $("model").replaceChildren(
    ...models.map((m) => option(m.id, modelNames[m.id]?.[0] || m.id)),
  );
  if (models.some((m) => m.id === "upscayl-standard-4x"))
    $("model").value = "upscayl-standard-4x";
  $("model").onchange();
  if (!models.length) throw Error("사용할 수 있는 모델이 없습니다.");
  connected = true;
  $("connection").classList.add("online");
  $("connection").lastChild.textContent = "서버 연결됨";
  renderView();
} catch (err) {
  $("connection").lastChild.textContent = "연결 확인 필요";
  status(err.message, true);
}
