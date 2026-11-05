import { t } from "./language";
import { useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { save, type Entry } from "./files";
export function Preview({
  entry,
  showSave,
}: {
  entry: Entry;
  showSave: boolean;
}) {
  const [lens, setLens] = useState(false),
    [actual, setActual] = useState(false),
    [split, setSplit] = useState(50);
  const out = entry.result;
  return (
    <div className="preview">
      <div className="toolbar">
        <strong>{t("Preview")}</strong>
        <div className="flex flex-wrap gap-1">
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
        </div>
      </div>
      <div className={"canvas " + (actual ? "actual" : "")}>
        <div
          className="frame"
          style={{
            aspectRatio: entry.width + "/" + entry.height,
            width: actual
              ? (out || entry).width
              : "min(100%, calc(var(--frame-h) * " +
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
