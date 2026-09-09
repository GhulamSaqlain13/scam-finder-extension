export type RiskSignal = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  explanation: string;
  ruleId?: string;
  weight?: number;
};

export function SignalList({ signals, categories, developerMode = false }: {
  signals: readonly RiskSignal[];
  categories: readonly string[];
  developerMode?: boolean;
}) {
  return (
    <section className="fsd-card">
      <div className="fsd-card__head">
        <h2 className="fsd-h2">Why this was flagged</h2>
        <span className="fsd-small fsd-muted">{signals.length} {signals.length === 1 ? "signal" : "signals"}</span>
      </div>
      <div className="fsd-card__body">
        {signals.length ? <ul className="fsd-signals">
          {signals.map((signal) => <li className="fsd-signal" data-severity={signal.severity} key={signal.id}><div>
            <div className="fsd-signal__title">{signal.title}</div>
            <div className="fsd-signal__text">{signal.explanation}</div>
            {developerMode && signal.ruleId && (
              <div className="fsd-signal__meta">
                {signal.ruleId}
                {signal.weight !== undefined && <> &middot; {signal.weight >= 0 ? "+" : ""}{signal.weight}</>}
              </div>
            )}
          </div></li>)}
        </ul> : <p className="fsd-p fsd-small">No signals found.</p>}
        {categories.length > 0 && <><hr className="fsd-divider" /><div className="fsd-chip-row">
          {categories.map((category) => <span className="fsd-chip" key={category}>{category}</span>)}
        </div></>}
      </div>
    </section>
  );
}
