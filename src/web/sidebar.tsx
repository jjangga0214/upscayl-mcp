import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { t } from "./language";

const narrow = window.matchMedia("(max-width: 699px)");

export function Sidebar({
  version,
  ready,
  children,
  navigation,
}: {
  version?: string;
  ready: boolean;
  children: ReactNode;
  navigation: ReactNode;
}) {
  const [compact, setCompact] = useState(narrow.matches);
  useEffect(() => {
    const resize = () => setCompact(narrow.matches);
    narrow.addEventListener("change", resize);
    return () => narrow.removeEventListener("change", resize);
  }, []);
  return (
    <aside className="sidebar" aria-label={t("Upscale settings")}>
      <div className="sidebar-rail">
        <img src="/studio/icon-512.png" width="36" height="36" alt="Upscayl" />
        <button
          className="rail-control"
          popoverTarget="settings-panel"
          aria-label={t("Open settings")}
        >
          <Icon name="settings" />
          {t("Settings")}
          {ready && <span className="ready-ripple" aria-hidden="true" />}
        </button>
      </div>
      <div
        id="settings-panel"
        className="sidebar-panel"
        popover={compact ? "auto" : undefined}
      >
        <div className="sidebar-heading">
          <div className="brand">
            <img width="48" height="48" src="/studio/icon-512.png" alt="" />
            <div>
              <h1>
                Upscayl <small>{version}</small>
              </h1>
              <p>AI Image Upscaler</p>
            </div>
          </div>
          {compact && (
            <button
              className="panel-close"
              popoverTarget="settings-panel"
              popoverTargetAction="hide"
              aria-label={t("Close settings")}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        {children}
        {navigation}
      </div>
    </aside>
  );
}
