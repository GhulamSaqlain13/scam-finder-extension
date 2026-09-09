import type { RiskLevel } from "./risk-badge";

const labels: Record<RiskLevel, string> = {
  low: "Low risk", suspicious: "Suspicious", high: "High risk", critical: "Very high risk",
};

export function RiskMeter({ score, risk, summary }: { score: number; risk: RiskLevel; summary?: string }) {
  const value = Number.isFinite(score) ? Math.round(Math.min(100, Math.max(0, score))) : 0;
  return (
    <section className="fsd-card" data-risk={risk} aria-label="Risk result">
      <div className="fsd-card__body"><div className="fsd-meter">
        <div className="fsd-meter__top">
          <div className="fsd-meter__score">{value}<span>/100</span></div>
          <span className="fsd-badge fsd-meter__label">{labels[risk]}</span>
        </div>
        <div className="fsd-meter__bar" role="img" aria-label={`Risk score ${value} out of 100, ${labels[risk]}`}>
          {Array.from({ length: 20 }, (_, index) => <i key={index} className={`fsd-meter__seg${index < Math.round(value / 5) ? " is-on" : ""}`} />)}
        </div>
        <div className="fsd-meter__scale"><span>Low</span><span>Suspicious</span><span>High</span><span>Very high</span></div>
        {summary && <p className="fsd-p fsd-small">{summary}</p>}
      </div></div>
    </section>
  );
}
