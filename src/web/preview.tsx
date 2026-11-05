import { t } from "./language";
import { useState, useRef, useEffect } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { save, type Entry } from "./files";
function FullscreenResult({ src, name }: { src: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const nativeRequested = useRef(false);
  useEffect(() => {
    const sync = () => {
      if (
        nativeRequested.current &&
        document.fullscreenElement !== view.current
      ) {
        nativeRequested.current = false;
        dialog.current?.close();
      }
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  function open() {
    dialog.current?.showModal();
    // The modal also fills the viewport on browsers without element fullscreen.
    if (
      view.current &&
      document.fullscreenEnabled &&
      !document.fullscreenElement
    ) {
      nativeRequested.current = true;
      void view.current.requestFullscreen().catch(() => {
        nativeRequested.current = false;
      });
    }
  }
  return (
    <>
      <button
        className="fullscreen-trigger"
        type="button"
        title={t("View result fullscreen")}
        aria-label={t("View result fullscreen")}
        onClick={open}
      >
        <Icon name="fullscreen" />
      </button>
      <dialog
        className="result-dialog"
        ref={dialog}
        aria-label={t("Upscaled image")}
        onClose={() => {
          if (dialog.current?.open) return;
          nativeRequested.current = false;
          if (document.fullscreenElement === view.current && view.current)
            void document.exitFullscreen().catch(() => {});
        }}
      >
        <div className="fullscreen-result" ref={view}>
          <img src={src} alt={name} loading="lazy" />
          <button
            type="button"
            className="exit-fullscreen"
            aria-label={t("Exit fullscreen")}
            title={t("Exit fullscreen")}
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
      </dialog>
    </>
  );
}
export function Preview({
  entry,
  showSave,
  busy,
}: {
  entry: Entry;
  showSave: boolean;
  busy: boolean;
}) {
  const [lens, setLens] = useState(false),
    [actual, setActual] = useState(false),
    [split, setSplit] = useState(50);
  const out = entry.result;
  return (
    <div className="preview">
      <div className="toolbar" role="group" aria-label={t("Preview")}>
        <div className="preview-controls">
          {out && (
            <>
              <button aria-pressed={!lens} onClick={() => setLens(false)}>
                {t("Slider")}
              </button>
              <button aria-pressed={lens} onClick={() => setLens(true)}>
                {t("Lens")}
              </button>
            </>
          )}
          <button
            onClick={() => setActual(!actual)}
            aria-pressed={actual}
            aria-label={t("View at actual size")}
          >
            1:1
          </button>
          {out && !busy && <FullscreenResult src={out.url} name={entry.name} />}
        </div>
      </div>
      <div className={"canvas " + (actual ? "actual" : "")}>
        <div
          className="frame"
          style={{
            aspectRatio: entry.width + "/" + entry.height,
            width: actual
              ? (out || entry).width
              : "min(100cqw, calc(100cqh * " +
                entry.width / entry.height +
                "))",
          }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--lens-x",
              e.clientX - r.left + "px",
            );
            e.currentTarget.style.setProperty(
              "--lens-y",
              e.clientY - r.top + "px",
            );
          }}
        >
          <img src={entry.url} alt={t("Original image")} draggable={false} />
          {out && (
            <>
              <img
                className="overlay"
                src={out.url}
                alt={t("Upscaled image")}
                draggable={false}
                style={{
                  clipPath: lens
                    ? "circle(68px at var(--lens-x, 50%) var(--lens-y, 50%))"
                    : "inset(0 0 0 " + split + "%)",
                }}
              />
              <span className="image-label">{t("Original")}</span>
              <span className="image-label after">{t("Result")}</span>
              {!lens && (
                <>
                  <div className="handle" style={{ left: split + "%" }}>
                    <span>‹ ›</span>
                  </div>
                  <input
                    aria-label={t("Before/after split position")}
                    className="wipe"
                    type="range"
                    min="0"
                    max="100"
                    value={split}
                    onChange={(e) => setSplit(+e.target.value)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="caption">
        <div className="min-w-0">
          <strong>{entry.name}</strong>
          <small>
            {entry.width} × {entry.height}
            {out && (
              <>
                {" "}
                → {out.width} × {out.height}
              </>
            )}{" "}
            px
          </small>
        </div>
        {out && showSave && (
          <Button variant="secondary" onPress={() => save(out)}>
            <Icon name="download" />
            {t("Save result")}
          </Button>
        )}
      </div>
    </div>
  );
}
