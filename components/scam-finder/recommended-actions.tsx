import type { ReactNode } from "react";
import type { RiskLevel } from "./risk-badge";

export function RecommendedActions({ risk, actions, notice, children }: {
  risk: RiskLevel; actions: readonly string[]; notice?: string; children?: ReactNode;
}) {
  return (
    <section className="fsd-card" data-risk={risk}>
      <div className="fsd-card__head"><h2 className="fsd-h2">What to do</h2></div>
      <div className="fsd-card__body fsd-stack">
        <ul className="fsd-actions">
          {actions.map((action) => <li key={action}>{action}</li>)}
        </ul>
        {notice && (
          <div className="fsd-notice">
            <svg className="fsd-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>{notice}</span>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
