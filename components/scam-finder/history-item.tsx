"use client";

import { RiskBadge, type RiskLevel } from "./risk-badge";

export type ScanHistoryEntry = {
  id: string;
  score: number;
  risk: RiskLevel;
  categories: readonly string[];
  timeLabel: string;
  rulesVersion: string;
  aiVersion?: string;
};

const riskLabels: Record<RiskLevel, string> = {
  critical: "Very high",
  high: "High",
  suspicious: "Suspicious",
  low: "Low",
};

export function HistoryItem({ entry, onSelect, selected = false }: {
  entry: ScanHistoryEntry;
  onSelect: (entry: ScanHistoryEntry) => void;
  selected?: boolean;
}) {
  return (
    <button className="fsd-history__item" data-risk={entry.risk} type="button"
      aria-pressed={selected} onClick={() => onSelect(entry)}>
      <span className="fsd-history__score">{entry.score}</span>
      <span className="fsd-history__main">
        <span className="fsd-history__cats fsd-truncate" style={{ display: "block" }}>
          {entry.categories.join(", ")}
        </span>
        <span className="fsd-history__time" style={{ display: "block" }}>
          {entry.timeLabel} &middot; rules {entry.rulesVersion}
          {entry.aiVersion && <> &middot; ai {entry.aiVersion}</>}
        </span>
      </span>
      <RiskBadge risk={entry.risk}>{riskLabels[entry.risk]}</RiskBadge>
    </button>
  );
}
