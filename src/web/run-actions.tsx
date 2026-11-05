import { t } from "./language";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import type { ProcessingStep } from "./files";

export type RunState =
  | { kind: "ready" | "done" | "cancelled" }
  | { kind: "failed"; reason: string }
  | { kind: "running"; step: ProcessingStep; started: number };

const stages = {
  upload: t("Sending image"),
  prepare: t("Preparing job"),
  queued: t("Waiting for GPU"),
  process: t("Upscaling"),
  receive: t("Receiving result"),
  cancel: t("Cancelling"),
};

function Elapsed({ since }: { since: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () =>
      setSeconds(Math.floor((performance.now() - since) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  return (
    <span>
      {t("Elapsed")} {Math.floor(seconds / 60)}:
      {String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

type Props = {
  state: RunState;
  inputKey?: string;
  name?: string;
  current: number;
  count: number;
  online: boolean;
  cancel: () => void;
  download: () => void;
};
export function RunActions({
  state,
  inputKey,
  name,
  current,
  count,
  online,
  cancel,
  download,
}: Props) {
  const ready = state.kind === "ready" && !!count && online;
  const processing = state.kind === "running" ? state : undefined;
  const step = processing?.step;
  const pass = step?.stage === "process" ? step.pass : undefined;
  const percent = pass?.percent;
  const batch = count > 1;
  const phase = step ? stages[step.stage] : "";
  const passLabel =
    pass && pass.total > 1
      ? t("Pass {index} of {total}", { index: pass.index, total: pass.total })
      : "";
  return (
    <div className={"run-area" + (count ? " has-input" : "")}>
      {processing && step ? (
        <div className="run-progress">
          <div className="run-head">
            <strong>{phase}</strong>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              isDisabled={step.stage === "cancel"}
              onPress={cancel}
              aria-label={t("Cancel job")}
            >
              {t("Cancel")}
            </Button>
          </div>
          <div className="run-file" title={name}>
            {batch && (
              <b>
                {t("{current} of {total} images", {
                  current: current + 1,
                  total: count,
                })}
              </b>
            )}
            <span>{name}</span>
          </div>
          <div
            className="run-track"
            role="progressbar"
            aria-label={phase}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            {percent === undefined ? (
              <i className="waiting" />
            ) : (
              <i style={{ width: percent + "%" }} />
            )}
          </div>
          <div className="run-meta">
            <Elapsed since={processing.started} />
            <span>
              {passLabel}
              {passLabel && " · "}
              {percent !== undefined && percent + "%"}
            </span>
          </div>
        </div>
      ) : (
        <>
          {state.kind === "done" && (
            <div className="run-note success">
              <Icon name="check" />
              <strong>{t("Upscale complete")}</strong>
              {batch && (
                <span>
                  {t("{current} of {total} images", {
                    current: count,
                    total: count,
                  })}
                </span>
              )}
            </div>
          )}
          {state.kind === "cancelled" && (
            <div className="run-note">{t("Job cancelled.")}</div>
          )}
          {state.kind === "failed" && (
            <div className="run-note error">
              {t("Upscale failed")} · {state.reason}
            </div>
          )}
          <div className={state.kind === "done" ? "result-actions" : ""}>
            {state.kind === "done" && (
              <Button type="button" onPress={download}>
                <Icon name="download" />
                {batch ? t("Save ZIP") : t("Save result")}
              </Button>
            )}
            <div className="run-trigger">
              <Button
                id="run"
                variant={state.kind === "done" ? "secondary" : "primary"}
                type="submit"
                form="upscale-settings"
                fullWidth
                isDisabled={!count || !online}
              >
                {state.kind === "done" ? (
                  t("Upscale again")
                ) : (
                  <>
                    <Icon name="expand" />
                    {batch
                      ? t("Upscale {count} images", { count })
                      : t("Upscale")}
                  </>
                )}
              </Button>
              {ready && (
                <span
                  className="ready-ripple"
                  key={inputKey}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
          <p>{t("Server files expire five minutes after completion.")}</p>
        </>
      )}
      <span className="sr-only" role="status" aria-atomic="true">
        {processing
          ? [
              batch
                ? t("{current} of {total} images", {
                    current: current + 1,
                    total: count,
                  })
                : "",
              name,
              phase,
              passLabel,
            ]
              .filter(Boolean)
              .join(", ")
          : state.kind === "done"
            ? t("Upscale complete. Your result is ready to save.")
            : state.kind === "failed"
              ? t("Upscale failed") + ". " + state.reason
              : state.kind === "cancelled"
                ? t("Job cancelled.")
                : ""}
      </span>
    </div>
  );
}
