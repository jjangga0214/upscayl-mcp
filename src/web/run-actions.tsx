import { useEffect, useState } from "react";
import { Button } from "@heroui/react/button";
import { Icon } from "./icons";
import type { ProcessingStep } from "./files";

export type RunState =
  | { kind: "ready" | "done" | "cancelled" }
  | { kind: "failed"; reason: string }
  | { kind: "running"; step: ProcessingStep; started: number };

const stages = {
  upload: "이미지 전송 중",
  prepare: "작업 준비 중",
  queued: "GPU 대기 중",
  process: "업스케일 중",
  receive: "결과 받는 중",
  cancel: "취소 중",
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
      경과 {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
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
    pass && pass.total > 1 ? pass.index + "/" + pass.total + "차 처리" : "";
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
              aria-label="작업 취소"
            >
              취소
            </Button>
          </div>
          <div className="run-file" title={name}>
            {batch && (
              <b>
                {current + 1}/{count}장
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
              <strong>업스케일 완료</strong>
              {batch && (
                <span>
                  {count}/{count}장
                </span>
              )}
            </div>
          )}
          {state.kind === "cancelled" && (
            <div className="run-note">작업을 취소했습니다.</div>
          )}
          {state.kind === "failed" && (
            <div className="run-note error">업스케일 실패 · {state.reason}</div>
          )}
          <div className={state.kind === "done" ? "result-actions" : ""}>
            {state.kind === "done" && (
              <Button type="button" onPress={download}>
                <Icon name="download" />
                {batch ? "ZIP 저장" : "결과 저장"}
              </Button>
            )}
            <div className="run-trigger">
              <Button
                id="run"
                variant={state.kind === "done" ? "secondary" : "primary"}
                type="submit"
                fullWidth
                isDisabled={!count || !online}
              >
                {state.kind === "done" ? (
                  "다시 업스케일"
                ) : (
                  <>
                    <Icon name="expand" />
                    {batch ? count + "장 업스케일" : "업스케일"}
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
          <p>서버의 작업 파일은 완료 5분 후 삭제됩니다.</p>
        </>
      )}
      <span className="sr-only" role="status" aria-atomic="true">
        {processing
          ? [
              batch ? current + 1 + "/" + count + "장" : "",
              name,
              phase,
              passLabel,
            ]
              .filter(Boolean)
              .join(", ")
          : state.kind === "done"
            ? "업스케일 완료. 결과를 저장할 수 있습니다."
            : state.kind === "failed"
              ? "업스케일 실패. " + state.reason
              : state.kind === "cancelled"
                ? "작업을 취소했습니다."
                : ""}
      </span>
    </div>
  );
}
