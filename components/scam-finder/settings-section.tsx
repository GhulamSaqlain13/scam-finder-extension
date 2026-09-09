import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="fsd-section" aria-label={title}><div className="fsd-card"><div className="fsd-card__head"><h2 className="fsd-h2">{title}</h2></div>{children}</div></section>;
}
