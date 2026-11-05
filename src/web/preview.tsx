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
        <strong>미리보기</strong>
        <div className="flex flex-wrap gap-1">
          {out && (
            <>
              <button aria-pressed={!lens} onClick={() => setLens(false)}>
                슬라이더
              </button>
              <button aria-pressed={lens} onClick={() => setLens(true)}>
                렌즈
              </button>
            </>
          )}
          <button
            onClick={() => setActual(!actual)}
            aria-pressed={actual}
            aria-label="실제 픽셀 크기로 보기"
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
          <img src={entry.url} alt="원본 이미지" draggable={false} />
          {out && (
            <>
              <img
                className="overlay"
                src={out.url}
                alt="업스케일 결과"
                draggable={false}
                style={{
                  clipPath: lens
                    ? "circle(68px at var(--lens-x, 50%) var(--lens-y, 50%))"
                    : "inset(0 0 0 " + split + "%)",
                }}
              />
              <span className="image-label">원본</span>
              <span className="image-label after">결과</span>
              {!lens && (
                <>
                  <div className="handle" style={{ left: split + "%" }}>
                    <span>‹ ›</span>
                  </div>
                  <input
                    aria-label="원본과 결과 비교 위치"
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
            결과 저장
          </Button>
        )}
      </div>
    </div>
  );
}
