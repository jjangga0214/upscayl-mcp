import { t } from "./language";
import { useState, useRef, useEffect } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { save, type Entry } from "./files";
import { ImageViewer } from "./image-viewer";

function FullscreenResult({ entry }: { entry: Entry }) {
  const [openViewer, setOpenViewer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const nativeRequested = useRef(false);
  function close() {
    setOpenViewer(false);
    dialog.current?.close();
  }
  useEffect(() => {
    const sync = () => {
      if (
        nativeRequested.current &&
        document.fullscreenElement !== view.current
      ) {
        nativeRequested.current = false;
        close();
      }
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  function open() {
    setOpenViewer(true);
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
        onCancel={() => setOpenViewer(false)}
        onClose={() => {
          if (dialog.current?.open) return;
          setOpenViewer(false);
          nativeRequested.current = false;
          if (document.fullscreenElement === view.current && view.current)
            void document.exitFullscreen().catch(() => {});
        }}
      >
        <div className="fullscreen-result" ref={view}>
          {openViewer && <ImageViewer entry={entry} fullscreen />}
          <button
            type="button"
            className="exit-fullscreen"
            aria-label={t("Exit fullscreen")}
            title={t("Exit fullscreen")}
            onClick={close}
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
  const out = entry.result;
  return (
    <div className="preview">
      <ImageViewer
        key={out?.url || entry.url}
        entry={entry}
        action={out && !busy && <FullscreenResult entry={entry} />}
      />
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
