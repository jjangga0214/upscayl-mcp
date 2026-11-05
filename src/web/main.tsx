import { t } from "./language";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { Brand, Sidebar } from "./sidebar";
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
const compactLayout = window.matchMedia(
  "(max-width: 699px), (pointer: coarse) and (max-height: 500px) and (max-width: 1000px)",
);
type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
};
function App() {
  const [compact, setCompact] = useState(compactLayout.matches);
  const panel = useRef<HTMLDialogElement>(null);
  function openSettings() {
    if (compact && panel.current && !panel.current.open)
      panel.current.showModal();
  }
  useEffect(() => {
    const resize = () => {
      setCompact(compactLayout.matches);
    };
    compactLayout.addEventListener("change", resize);
    return () => compactLayout.removeEventListener("change", resize);
  }, []);
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
        notify(
          t("Could not open the image.") + " " + (e as Error).message,
          true,
        );
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
    if (panel.current?.matches(":modal")) panel.current.close();
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
  const runLabel =
    runState.kind === "done"
      ? t("Upscale again")
      : items.length > 1
        ? t("Upscale {count} images", { count: items.length })
        : t("Upscale");
  const runActions = (
    <RunActions
      state={runState}
      runLabel={runLabel}
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
  );
  const fileButtons = (
    <div className="file-buttons flex flex-wrap items-center justify-center gap-2">
      <Button
        id="select"
        variant={selected ? "secondary" : "primary"}
        isDisabled={busy}
        onPress={() => picker.current?.click()}
      >
        <Icon name="photo" />
        {selected ? t("Change image") : t("Select image")}
      </Button>
      <Button
        variant="secondary"
        isDisabled={busy}
        onPress={() => directory.current?.click()}
      >
        <Icon name="folder" />
        {t("Open folder")}
      </Button>
    </div>
  );
  return (
    <div
      className="workspace"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <Sidebar
        version={root.dataset.desktopVersion}
        compact={compact}
        panelRef={panel}
        sheetAction={
          selected &&
          !busy && (
            <div className="sheet-action">
              <Button
                variant="primary"
                type="submit"
                form="upscale-settings"
                fullWidth
                isDisabled={!connected}
              >
                <Icon name="expand" />
                {runLabel}
              </Button>
            </div>
          )
        }
        navigation={
          <nav className="sidebar-nav">
            <span className={"connection " + (connected ? "online" : "")}>
              <i />
              {connected === null
                ? t("Connecting")
                : connected
                  ? t("Connected")
                  : t("Offline")}
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
                {t("Install app")}
              </button>
            )}
            <a href="/setup">
              {t("Setup")}
              <Icon name="arrow" />
            </a>
          </nav>
        }
      >
        <Settings
          models={models}
          count={items.length}
          batch={folder || items.length > 1}
          busy={busy}
          online={!!connected}
          run={run}
          reveal={openSettings}
        >
          {!compact && runActions}
        </Settings>
      </Sidebar>
      <main
        className={"workarea" + (drag ? " dragging" : "")}
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
        <div className="canvas-scroll">
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
            <div className="dropzone">
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
                <h2>{drag ? t("Drop to open") : t("Drop images here")}</h2>
                <p>
                  PNG, JPG, WebP <span>·</span> {t("Up to 32 MiB per file")}
                </p>
                {fileButtons}
              </div>
            </div>
          ) : (
            <div className="loaded">
              <Preview
                key={selected.url}
                entry={selected}
                busy={busy}
                showSave={runState.kind !== "done" || items.length > 1}
              />
              <div className="file-row">
                {fileButtons}
                <Button variant="ghost" isDisabled={busy} onPress={clear}>
                  {t("Clear")}
                </Button>
              </div>
              {items.length > 1 && (
                <div className="batch">
                  <label>
                    {t("Files")}
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
                      {t("Save ZIP")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {connected === false && (
            <div className="notice">
              {t("Unable to reach the host. Check your network connection.")}{" "}
              <button onClick={() => retry.current()}>{t("Reconnect")}</button>
            </div>
          )}
          <div role="status" className={"status " + (error ? "error" : "")}>
            {message}
          </div>
        </div>
        {compact && (
          <footer className="mobile-actions">
            {!selected && <Brand version={root.dataset.desktopVersion} />}
            <button
              className="dock-settings"
              type="button"
              aria-haspopup="dialog"
              aria-controls="settings-panel"
              aria-label={t("Open settings")}
              onClick={openSettings}
            >
              <Icon name="settings" />
              {t("Settings")}
            </button>
            {selected && runActions}
          </footer>
        )}
      </main>
    </div>
  );
}
createRoot(root).render(<App />);
if (window.isSecureContext && "serviceWorker" in navigator)
  void navigator.serviceWorker.register("/sw.js").catch(console.warn);
