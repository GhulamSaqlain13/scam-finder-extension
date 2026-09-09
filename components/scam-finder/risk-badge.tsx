import type { ReactNode } from "react";

export type RiskLevel = "low" | "suspicious" | "high" | "critical";

export function RiskBadge({ risk, children }: { risk: RiskLevel; children: ReactNode }) {
  return <span className="fsd-badge" data-risk={risk}>{children}</span>;
}

