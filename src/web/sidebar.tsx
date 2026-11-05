import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
  type PointerEvent,
} from "react";
import { Icon } from "./icons";
import { t } from "./language";

export function Brand({ version }: { version?: string }) {
  return (
    <div className="brand">
      <img width="48" height="48" src="/studio/icon-512.png" alt="" />
      <div>
        <h1>
          Upscayl <small>{version}</small>
        </h1>
        <p>AI Image Upscaler</p>
      </div>
    </div>
  );
}

export function Sidebar({
  version,
  compact,
  panelRef,
  children,
  navigation,
  sheetAction,
}: {
  version?: string;
  compact: boolean;
  panelRef: RefObject<HTMLDialogElement | null>;
  children: ReactNode;
  navigation: ReactNode;
  sheetAction?: ReactNode;
}) {
  const drag = useRef<{ id: number; startY: number } | null>(null);
  const backdropPress = useRef(false);
  useLayoutEffect(() => {
    const panel = panelRef.current!;
    // The form stays mounted so native inputs keep their values across layout changes.
    if (!compact) panel.open = true;
    return () => {
      for (const child of Array.from(
        panel.querySelectorAll("dialog[open]"),
      ).reverse()) {
        (child as HTMLDialogElement).close();
      }
      if (panel.open) panel.close();
      panel.style.removeProperty("--sheet-offset");
      drag.current = null;
    };
  }, [compact, panelRef]);

  function finishDrag(e: PointerEvent<HTMLElement>) {
    if (drag.current?.id !== e.pointerId) return;
    const distance = drag.current.startY - e.clientY;
    drag.current = null;
    const panel = panelRef.current!;
    panel.style.removeProperty("--sheet-offset");
    if (e.type === "pointerup" && distance >= 56) panel.close();
  }

  return (
    <dialog
      id="settings-panel"
      ref={panelRef}
      className="sidebar-panel"
      aria-label={t("Upscale settings")}
      role={compact ? undefined : "complementary"}
      onPointerDown={(e) => {
        backdropPress.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (compact && backdropPress.current && e.target === e.currentTarget)
          e.currentTarget.close();
      }}
    >
      {compact ? (
        <header className="sheet-heading">
          <h2>{t("Upscale settings")}</h2>
          <button
            type="button"
            className="panel-close"
            aria-label={t("Close settings")}
            onClick={() => panelRef.current?.close()}
          >
            <Icon name="close" />
          </button>
        </header>
      ) : (
        <Brand version={version} />
      )}
      <div className="settings-body">
        {children}
        {navigation}
      </div>
      {compact && sheetAction}
      {compact && (
        <div
          className="sheet-grip"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0) return;
            drag.current = { id: e.pointerId, startY: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current?.id === e.pointerId)
              panelRef.current?.style.setProperty(
                "--sheet-offset",
                Math.min(0, e.clientY - drag.current.startY) + "px",
              );
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
        />
      )}
    </dialog>
  );
}
