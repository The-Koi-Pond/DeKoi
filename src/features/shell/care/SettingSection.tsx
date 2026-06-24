import type { ReactNode } from "react";

/**
 * Groups related fields with a header and optional description.
 * Purely presentational — gives tabs visual structure.
 */
interface SettingSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingSection({
  title,
  description,
  children,
}: SettingSectionProps) {
  return (
    <section className="setting-section" aria-labelledby={title}>
      <div className="setting-section-head">
        <h3 id={title}>{title}</h3>
        {description && <span>{description}</span>}
      </div>
      <div className="setting-section-body">{children}</div>
    </section>
  );
}
