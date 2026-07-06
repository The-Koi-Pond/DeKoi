import type { ReactNode } from "react";
import { CARE_TABS } from "./care-tabs";

interface CareDrawerShellProps {
  activeTab: number;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  onTabChange: (tab: number) => void;
}

export function CareDrawerShell({
  activeTab,
  children,
  open,
  onClose,
  onTabChange,
}: CareDrawerShellProps) {
  return (
    <aside
      className={`care${open ? " open" : ""}`}
      aria-label="Settings"
      aria-hidden={open ? undefined : true}
    >
      <div className="care-head">
        <div className="top">
          <h2>Settings</h2>
          <div
            className="x"
            role="button"
            tabIndex={0}
            aria-label="Close Settings"
            onClick={onClose}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClose();
              }
            }}
          >
            ✕
          </div>
        </div>
      </div>

      <div className="care-tabs">
        {CARE_TABS.map((tab, index) => (
          <div
            key={tab.label}
            className={`ctab${activeTab === index ? " on" : ""}`}
            role="tab"
            tabIndex={0}
            aria-selected={activeTab === index}
            onClick={() => onTabChange(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTabChange(index);
              }
            }}
          >
            {tab.label} <small>{tab.hint}</small>
          </div>
        ))}
      </div>

      <div className="care-body">{children}</div>
    </aside>
  );
}
