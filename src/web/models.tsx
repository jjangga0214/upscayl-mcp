import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import { describeModel } from "../catalog";
export type Model = { id: string; nativeScale: number; preview?: boolean };

function Pair({ model, large = false }: { model: Model; large?: boolean }) {
  return (
    <div className={"pair " + (large ? "large" : "")}>
      {["before", "after"].map((side, i) => (
        <div key={side}>
          <img
            loading="lazy"
            src={"/studio/models/" + model.id + "/" + side + ".webp"}
            alt={describeModel(model.id).name + (i ? " 처리 후" : " 처리 전")}
          />
          <span>{i ? "처리 후" : "처리 전"}</span>
        </div>
      ))}
    </div>
  );
}
export function ModelPicker({
  models,
  value,
  change,
  disabled,
}: {
  models: Model[];
  value: string;
  change: (id: string) => void;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    zoom = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [large, setLarge] = useState<Model>();
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (large) zoom.current?.showModal();
  }, [large]);
  return (
    <section>
      <h2>AI 모델</h2>
      <Button
        id="model"
        variant="secondary"
        className="model-trigger"
        isDisabled={disabled || !models.length}
        onPress={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span>{describeModel(value).name}</span>
        <Icon name="chevron" />
      </Button>
      <p className="hint">{describeModel(value).description}</p>
      {open && (
        <dialog
          className="model-dialog"
          ref={dialog}
          aria-labelledby="model-title"
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current.close();
          }}
        >
          <div className="dialog-body">
            <header>
              <h2 id="model-title">AI 모델 선택</h2>
              <Button
                isIconOnly
                variant="ghost"
                aria-label="모델 선택 닫기"
                onPress={() => dialog.current?.close()}
              >
                <Icon name="close" />
              </Button>
            </header>
            <div className="model-list">
              {models.map((m) => {
                const info = describeModel(m.id);
                return (
                  <article
                    className={"model-card " + (m.id === value ? "chosen" : "")}
                    key={m.id}
                  >
                    <button
                      type="button"
                      className="model-choice"
                      aria-pressed={m.id === value}
                      onClick={() => {
                        change(m.id);
                        dialog.current?.close();
                      }}
                    >
                      <strong>{info.name}</strong>
                      <p>{info.description}</p>
                      {m.preview && <Pair model={m} />}
                    </button>
                    {m.preview && (
                      <Button
                        variant="primary"
                        isIconOnly
                        className="zoom-model"
                        aria-label={info.name + " 비교 사진 크게 보기"}
                        onPress={() => setLarge(m)}
                      >
                        <Icon name="expand" />
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </dialog>
      )}
      {large && (
        <dialog
          className="zoom-dialog"
          ref={zoom}
          onClose={() => setLarge(undefined)}
          aria-label={describeModel(large.id).name + " 비교 사진"}
        >
          <header>
            <h2>{describeModel(large.id).name}</h2>
            <Button
              isIconOnly
              variant="secondary"
              aria-label="큰 사진 닫기"
              onPress={() => zoom.current?.close()}
            >
              <Icon name="close" />
            </Button>
          </header>
          <Pair model={large} large />
        </dialog>
      )}
    </section>
  );
}
