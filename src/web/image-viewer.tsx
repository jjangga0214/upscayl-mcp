import { useState, type ReactNode } from "react";
import { t } from "./language";
import type { Entry } from "./files";
import { useImageGestures, type CompareMode } from "./use-image-gestures";

export function ImageViewer({
  entry,
  fullscreen = false,
  action,
}: {
  entry: Entry;
  fullscreen?: boolean;
  action?: ReactNode;
}) {
  const out = entry.result;
  const [mode, setMode] = useState<CompareMode>(
    fullscreen ? "result" : "slider",
  );
  const showing = out ? mode : "result";
  const viewer = useImageGestures(
    entry.width,
    entry.height,
    (out || entry).width,
    showing,
  );
  const picture = {
    width: viewer.pictureWidth,
    height: viewer.pictureHeight,
    left: (viewer.frameWidth - viewer.pictureWidth) / 2 + viewer.view.x,
    top: (viewer.frameHeight - viewer.pictureHeight) / 2 + viewer.view.y,
  };
  const lensPosition = {
    left: viewer.lens.x * 100 + "%",
    top: viewer.lens.y * 100 + "%",
  };
  return (
    <div className="image-viewer">
      <div className="toolbar" role="group" aria-label={t("Preview")}>
        <div className="preview-controls">
          {out && (
            <>
              {fullscreen && (
                <button
                  aria-pressed={mode === "result"}
                  onClick={() => setMode("result")}
                >
                  {t("Result")}
                </button>
              )}
              <button
                aria-pressed={mode === "slider"}
                onClick={() => setMode("slider")}
              >
                {t("Slider")}
              </button>
              <button
                aria-pressed={mode === "lens"}
                onClick={() => setMode("lens")}
              >
                {t("Lens")}
              </button>
            </>
          )}
          <button
            onClick={viewer.toggleSize}
            aria-label={
              viewer.atFit ? t("View at actual size") : t("Fit to screen")
            }
          >
            {viewer.atFit ? "1:1" : t("Fit")}
          </button>
          {action}
        </div>
      </div>
      <div className="canvas" ref={viewer.canvas}>
        <div
          className="frame"
          ref={viewer.frame}
          tabIndex={viewer.canPan ? 0 : undefined}
          data-mode={showing}
          data-pan={viewer.canPan}
          style={{ width: viewer.frameWidth, height: viewer.frameHeight }}
          {...viewer.handlers}
        >
          <img
            src={showing === "result" && out ? out.url : entry.url}
            alt={
              showing === "result" && out
                ? t("Upscaled image")
                : t("Original image")
            }
            style={picture}
            draggable={false}
          />
          {out && showing !== "result" && (
            <>
              <div
                className="comparison-layer"
                style={{
                  clipPath:
                    showing === "slider"
                      ? `inset(0 0 0 ${viewer.split}%)`
                      : `circle(68px at ${lensPosition.left} ${lensPosition.top})`,
                }}
              >
                <img
                  className="overlay"
                  src={out.url}
                  alt={t("Upscaled image")}
                  style={picture}
                  draggable={false}
                />
              </div>
              {showing === "slider" ? (
                <>
                  <span className="image-label">{t("Original")}</span>
                  <span className="image-label after">{t("Result")}</span>
                  <div
                    className="handle"
                    style={{ left: viewer.split + "%" }}
                    aria-hidden="true"
                  >
                    <span>‹ ›</span>
                  </div>
                  <input
                    aria-label={t("Before/after split position")}
                    className="wipe"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(viewer.split)}
                    onChange={(e) => viewer.setSplit(+e.target.value)}
                  />
                </>
              ) : (
                <div className="lens-ring" style={lensPosition} />
              )}
            </>
          )}
        </div>
      </div>
      {!fullscreen && out && (
        <p className="gesture-tip">
          {showing === "slider"
            ? t("Pinch to zoom · Drag the divider to compare")
            : t("Pinch to zoom · Drag the lens to compare")}
        </p>
      )}
    </div>
  );
}
