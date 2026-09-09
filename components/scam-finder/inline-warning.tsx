"use client";

import { useId, useState } from "react";
import { Feedback, type FeedbackValue } from "./feedback";
import type { RiskLevel } from "./risk-badge";
import type { RiskSignal } from "./signal-list";

export type InlineWarningProps = {
  scanId: string;
  risk: RiskLevel;
  score: number;
  summary: string;
  signals?: readonly RiskSignal[];
  actions?: readonly string[];
  onDismiss?: () => void;
  onFeedbackChange?: (feedback: FeedbackValue | null) => void;
};

const labels: Record<RiskLevel, string> = {
  critical: "Very high risk", high: "High risk", suspicious: "Suspicious", low: "Low risk",
};

function WarningContent({ scanId, risk, score, summary, signals = [], actions = [], onDismiss, onFeedbackChange }: InlineWarningProps) {
  const detailId = useId();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasDetails = signals.length > 0 || actions.length > 0;
  if (dismissed) return null;

  return (
    <div className="fsd-warning" data-risk={risk} role="region" aria-label={`${labels[risk]} message result`}>
      <div className="fsd-warning__bar" style={{ flexWrap: "wrap" }}>
        <svg className="fsd-icon fsd-warning__shield" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.7 7.5 10 4.4-1.3 7.5-5.4 7.5-10v-6L12 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d={risk === "low" ? "M8.8 12.2l2.2 2.2 4.2-4.4" : "M12 8.5v4M12 15.5h.01"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="fsd-warning__title">{labels[risk]}</span>
        <span className="fsd-warning__score">{score}/100</span>
        <span className="fsd-warning__spacer" />
        {hasDetails && <button className="fsd-btn fsd-btn--risk fsd-btn--sm" type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded((value) => !value)}>Why</button>}
        <button className="fsd-btn fsd-btn--ghost fsd-btn--sm" type="button" aria-label="Dismiss warning" onClick={() => { setDismissed(true); onDismiss?.(); }}>Hide</button>
      </div>
      <p className="fsd-warning__summary">{summary}</p>
      {hasDetails && <div className="fsd-warning__detail" id={detailId} hidden={!expanded}>
        {signals.length > 0 && <ul className="fsd-signals">
          {signals.map((signal) => <li className="fsd-signal" data-severity={signal.severity} key={signal.id}><div>
            <div className="fsd-signal__title">{signal.title}</div>
            <div className="fsd-signal__text">{signal.explanation}</div>
          </div></li>)}
        </ul>}
        {actions.length > 0 && <ul className="fsd-actions">{actions.map((action) => <li key={action}>{action}</li>)}</ul>}
        <Feedback embedded scanId={scanId} onFeedbackChange={onFeedbackChange} />
      </div>}
    </div>
  );
}

export function InlineWarning(props: InlineWarningProps) {
  return <WarningContent key={props.scanId} {...props} />;
}
