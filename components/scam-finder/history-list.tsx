"use client";

import { HistoryItem, type ScanHistoryEntry } from "./history-item";

export function HistoryList({ entries, onSelect, onClear, selectedId }: {
  entries: readonly ScanHistoryEntry[];
  onSelect: (entry: ScanHistoryEntry) => void;
  onClear: () => void;
  selectedId?: string;
}) {
  return (
    <section className="fsd-card" aria-label="Recent scans">
      <div className="fsd-card__head">
        <h2 className="fsd-h2">Recent scans</h2>
        <button className="fsd-btn fsd-btn--ghost fsd-btn--sm" type="button"
          disabled={entries.length === 0} onClick={onClear}>Clear history</button>
      </div>
      {entries.length ? (
        <div className="fsd-history">
          {entries.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} onSelect={onSelect} selected={selectedId === entry.id} />
          ))}
        </div>
      ) : (
        <div className="fsd-empty" role="status">
          <div className="fsd-empty__title">No scans yet</div>
          <p className="fsd-p fsd-small">Your scan history is empty.</p>
        </div>
      )}
    </section>
  );
}
