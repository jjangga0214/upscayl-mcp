import type { ReactNode } from "react";
import { Icon } from "./icons";
import { t } from "./language";

export function Sidebar({
  version,
  compact,
  onPanelToggle,
  children,
  navigation,
}: {
  version?: string;
  compact: boolean;
  onPanelToggle: (open: boolean) => void;
  children: ReactNode;
  navigation: ReactNode;
}) {
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
        </button>
      </div>
      <div
        id="settings-panel"
        className="sidebar-panel"
        popover={compact ? "auto" : undefined}
        onToggle={(e) => {
          if (e.target === e.currentTarget)
            onPanelToggle(e.currentTarget.matches(":popover-open"));
        }}
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
