"use client";

import type { ReactNode } from "react";

function EmptyState({ title, description, icon, children }: {
  title: string; description: string; icon: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="fsd-card" aria-label={title}>
      <div className="fsd-empty">
        <svg className="fsd-icon fsd-empty__icon" style={{ width: 28, height: 28 }} viewBox="0 0 24 24" fill="none" aria-hidden="true">{icon}</svg>
        <h2 className="fsd-empty__title" style={{ margin: 0 }}>{title}</h2>
        <p className="fsd-p fsd-small">{description}</p>
        {children}
      </div>
    </section>
  );
}

export function NotOnFiverrState() {
  return <EmptyState title="Open a Fiverr conversation"
    description="Scanning starts once you open an inbox chat on fiverr.com."
    icon={<><rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" /></>} />;
}

export function NoScansState({ onAnalyze }: { onAnalyze?: () => void }) {
  return (
    <EmptyState title="No scans yet" description="Run a check on the messages in this conversation."
      icon={<><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>}>
      <button className="fsd-btn fsd-btn--primary" type="button" style={{ marginTop: 8 }} disabled={!onAnalyze} onClick={onAnalyze}>Analyze conversation</button>
    </EmptyState>
  );
}

export function LoadingState({ messageCount = 4 }: { messageCount?: number }) {
  return (
    <section className="fsd-card" aria-label="Scan loading">
      <div className="fsd-card__body fsd-stack">
        <div className="fsd-row" role="status">
          <span className="fsd-spinner" aria-hidden="true" />
          <span className="fsd-small fsd-muted">Checking {messageCount} {messageCount === 1 ? "message" : "messages"}</span>
        </div>
        <div className="fsd-skeleton" style={{ height: 40, width: "55%" }} aria-hidden="true" />
        <div className="fsd-skeleton" style={{ height: 10 }} aria-hidden="true" />
        <div className="fsd-skeleton" style={{ height: 10, width: "80%" }} aria-hidden="true" />
      </div>
    </section>
  );
}

export function ScanErrorState({ description = "The server did not respond.", onUseOffline, onRetry }: {
  description?: string; onUseOffline?: () => void; onRetry?: () => void;
}) {
  return (
    <section className="fsd-card" aria-label="Scan error">
      <div className="fsd-card__body fsd-stack">
        <div role="alert" className="fsd-stack">
          <h2 className="fsd-empty__title" style={{ margin: 0 }}>The scan could not finish</h2>
          <p className="fsd-p fsd-small">{description}</p>
        </div>
        <div className="fsd-btn-row">
          <button className="fsd-btn" type="button" disabled={!onUseOffline} onClick={onUseOffline}>Use offline result</button>
          <button className="fsd-btn fsd-btn--primary" type="button" disabled={!onRetry} onClick={onRetry}>Try again</button>
        </div>
      </div>
    </section>
  );
}

export function SignedOutState({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <section className="fsd-card" aria-label="Signed out">
      <div className="fsd-card__body fsd-stack">
        <h2 className="fsd-empty__title" style={{ margin: 0 }}>Sign in to use AI analysis</h2>
        <p className="fsd-p fsd-small">On-device rules work without an account. Signing in adds AI analysis, history and settings sync.</p>
        <button className="fsd-btn fsd-btn--primary fsd-btn--block" type="button" disabled={!onSignIn} onClick={onSignIn}>Sign in</button>
      </div>
    </section>
  );
}
