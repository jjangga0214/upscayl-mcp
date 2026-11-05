import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { Settings } from "./settings";
import { RunActions, type RunState } from "./run-actions";
import { Preview } from "./preview";
import type { Model } from "./models";
import type { Options } from "../engine";
import {
  processImage,
  readFiles,
  release,
  request,
  save,
  saveZip,
  type Entry,
} from "./files";

const root = document.getElementById("root")!;
type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
};
function App() {
  const [models, setModels] = useState<Model[]>([]),
    [connected, setConnected] = useState<boolean | null>(null);
  const [items, setItems] = useState<Entry[]>([]),
    [current, setCurrent] = useState(0),
    [folder, setFolder] = useState(false);
  const [runState, setRunState] = useState<RunState>({ kind: "ready" });
  const busy = runState.kind === "running";
  const [drag, setDrag] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [install, setInstall] = useState<Prompt>();
  const picker = useRef<HTMLInputElement>(null),
    directory = useRef<HTMLInputElement>(null),
    ticket = useRef(0),
    active = useRef<AbortController | null>(null),
    job = useRef("");
  const retry = useRef<() => void>(() => {});
  const selected = items[current];
  function notify(text: string, failed = false) {
    setMessage(text);
    setError(failed);
  }
  useEffect(() => {
    let alive = true,
      seq = 0;
    const check = async () => {
      const n = ++seq;
      try {
        const data = await request<Model[]>("/models", {
          signal: AbortSignal.timeout(5000),
        });
        if (alive && seq === n) {
          setModels(data);
          setConnected(data.length > 0);
        }
      } catch {
        if (alive && seq === n) setConnected(false);
      }
    };
    const offline = () => {
      ++seq;
      setConnected(false);
    };
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as Prompt);
    };
    const installed = () => setInstall(undefined);
    const leave = () => {
      if (job.current) navigator.sendBeacon("/jobs/" + job.current + "/cancel");
    };
    retry.current = check;
    void check();
    window.addEventListener("online", check);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", check);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      window.removeEventListener("online", check);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", check);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  async function load(files: File[], isFolder = false) {
    if (active.current || !files.length) return;
    const seq = ++ticket.current;
    try {
      const next = await readFiles(files, isFolder);
      if (seq !== ticket.current || active.current) {
        next.forEach(release);
        return;
      }
      items.forEach(release);
      setCurrent(0);
      setFolder(isFolder);
      setItems(next);
      setRunState({ kind: "ready" });
      notify("");
    } catch (e) {
      if (seq === ticket.current)
        notify("이미지를 열 수 없습니다. " + (e as Error).message, true);
    }
  }
  function clear() {
    ++ticket.current;
    items.forEach(release);
    setCurrent(0);
    setFolder(false);
    setItems([]);
    setRunState({ kind: "ready" });
    notify("");
  }
  async function run(options: Options) {
    if (active.current || !items.length || !connected) return;
    ++ticket.current;
    const controller = new AbortController();
    active.current = controller;
    const started = performance.now();
    notify("");
    const next = items.slice();
    try {
      for (const [index, entry] of next.entries()) {
        setCurrent(index);
        setRunState({ kind: "running", started, step: { stage: "upload" } });
        const result = await processImage(
          entry,
          options,
          controller.signal,
          (id) => {
            job.current = id;
          },
          (step) => {
            if (!controller.signal.aborted)
              setRunState({ kind: "running", started, step });
          },
        );
        if (entry.result) URL.revokeObjectURL(entry.result.url);
        next[index] = { ...entry, result };
        setItems(next.slice());
        job.current = "";
      }
      setRunState({ kind: "done" });
    } catch (e) {
      setRunState(
        controller.signal.aborted
          ? { kind: "cancelled" }
          : { kind: "failed", reason: (e as Error).message },
      );
    } finally {
      if (job.current)
        void fetch("/jobs/" + job.current + "/cancel", {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      active.current = null;
      job.current = "";
    }
  }
  const fileButtons = (
    <div className="file-buttons flex flex-wrap items-center justify-center gap-2">
      <Button
        id="select"
        variant={selected ? "secondary" : "primary"}
        isDisabled={busy}
        onPress={() => picker.current?.click()}
      >
        <Icon name="photo" />
        {selected ? "이미지 변경" : "이미지 선택"}
      </Button>
      <Button
        variant="secondary"
        isDisabled={busy}
        onPress={() => directory.current?.click()}
      >
        <Icon name="folder" />
        폴더 열기
      </Button>
    </div>
  );
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <header className="topbar">
        <div className="brand">
          <img width="56" height="56" src="/studio/icon-512.png" alt="" />
          <div>
            <h1>
              Upscayl <small>{root.dataset.desktopVersion}</small>
            </h1>
            <p>AI Image Upscaler</p>
          </div>
        </div>
        <nav>
          <span className={"connection " + (connected ? "online" : "")}>
            <i />
            {connected === null
              ? "연결 중"
              : connected
                ? "서버 연결됨"
                : "오프라인"}
          </span>
          {install && (
            <button
              className="install"
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(undefined);
              }}
            >
              앱 설치
            </button>
          )}
          <a href="/setup">
            연결 및 설치
            <Icon name="arrow" />
          </a>
        </nav>
      </header>
      <main className="workspace grid grid-cols-1 md:grid-cols-[minmax(235px,290px)_minmax(0,1fr)]">
        <div
          className="workarea md:col-start-2 md:row-start-1"
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy && e.dataTransfer.types.includes("Files")) setDrag(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void load(Array.from(e.dataTransfer.files));
          }}
        >
          <input
            ref={picker}
            id="files"
            type="file"
            accept=".png,.jpg,.jpeg,.jfif,.webp"
            multiple
            hidden
            onChange={(e) => {
              void load(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <input
            ref={directory}
            id="directory"
            type="file"
            {...{ webkitdirectory: "" }}
            multiple
            hidden
            onChange={(e) => {
              void load(Array.from(e.target.files || []), true);
              e.target.value = "";
            }}
          />
          {!selected ? (
            <div className={"dropzone " + (drag ? "dragging" : "")}>
              <div className="drop-content">
                <svg
                  className="drop-graphic"
                  viewBox="0 0 76 76"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="7"
                    y="17"
                    width="48"
                    height="39"
                    rx="7"
                    transform="rotate(-12 7 17)"
                    fill="#263a54"
                    stroke="#567391"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="18"
                    y="23"
                    width="47"
                    height="37"
                    rx="6"
                    fill="#1e3049"
                    stroke="#92b5df"
                    strokeWidth="1.7"
                  />
                  <circle cx="31" cy="34" r="4" fill="#88add8" />
                  <path
                    d="m20 54 12-12 8 7 9-11 13 15"
                    stroke="#89acd4"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="61"
                    cy="57"
                    r="12"
                    fill="#9fc9ff"
                    stroke="#1a293c"
                    strokeWidth="3"
                  />
                  <path
                    d="M61 62V52m-4 4 4-4 4 4"
                    stroke="#203654"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h2>{drag ? "놓아서 열기" : "이미지를 여기에 놓으세요"}</h2>
                <p>
                  PNG, JPG, WebP <span>·</span> 파일당 최대 32 MiB
                </p>
                {fileButtons}
              </div>
            </div>
          ) : (
            <div className={"loaded " + (drag ? "dragging" : "")}>
              <Preview
                key={selected.url}
                entry={selected}
                showSave={runState.kind !== "done" || items.length > 1}
              />
              <div className="file-row">
                {fileButtons}
                <Button variant="ghost" isDisabled={busy} onPress={clear}>
                  비우기
                </Button>
              </div>
              {items.length > 1 && (
                <div className="batch">
                  <label>
                    파일 목록
                    <select
                      value={current}
                      disabled={busy}
                      onChange={(e) => setCurrent(+e.target.value)}
                    >
                      {items.map((f, i) => (
                        <option key={f.url} value={i}>
                          {i + 1}. {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {runState.kind !== "done" && (
                    <Button
                      variant="secondary"
                      isDisabled={busy || !items.some((e) => e.result)}
                      onPress={() => {
                        void saveZip(items).catch((e) =>
                          notify(String(e), true),
                        );
                      }}
                    >
                      ZIP 저장
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {connected === false && (
            <div className="notice">
              호스트에 연결할 수 없습니다. 같은 네트워크에서{" "}
              <button onClick={() => retry.current()}>다시 연결</button>하세요.
            </div>
          )}
          <div role="status" className={"status " + (error ? "error" : "")}>
            {message}
          </div>
        </div>
        <aside
          aria-label="업스케일 설정"
          className="sidebar md:col-start-1 md:row-start-1"
        >
          <Settings
            models={models}
            count={items.length}
            batch={folder || items.length > 1}
            busy={busy}
            online={!!connected}
            run={run}
          >
            <RunActions
              state={runState}
              inputKey={items[0]?.url}
              name={selected?.name}
              count={items.length}
              current={current}
              online={!!connected}
              cancel={() => {
                active.current?.abort();
                setRunState((previous) =>
                  previous.kind === "running"
                    ? { ...previous, step: { stage: "cancel" } }
                    : previous,
                );
              }}
              download={() => {
                if (items.length > 1)
                  void saveZip(items).catch((e) => notify(String(e), true));
                else if (selected?.result) save(selected.result);
              }}
            />
          </Settings>
        </aside>
      </main>
    </div>
  );
}
createRoot(root).render(<App />);
if (window.isSecureContext && "serviceWorker" in navigator)
  void navigator.serviceWorker.register("/sw.js").catch(console.warn);
