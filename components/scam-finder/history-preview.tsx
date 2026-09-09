"use client";

import { useState } from "react";
import { HistoryList } from "./history-list";
import type { ScanHistoryEntry } from "./history-item";

const sampleEntries: ScanHistoryEntry[] = [
  { id: "demo-1", score: 94, risk: "critical", categories: ["fake_payment", "phishing_link", "personal_financial_info"], timeLabel: "Today, 14:02", rulesVersion: "v1.2", aiVersion: "v1" },
  { id: "demo-2", score: 71, risk: "high", categories: ["off_platform_payment", "crypto_payment"], timeLabel: "Today, 11:48", rulesVersion: "v1.2", aiVersion: "v1" },
  { id: "demo-3", score: 38, risk: "suspicious", categories: ["off_platform_contact"], timeLabel: "Yesterday, 19:20", rulesVersion: "v1.2" },
  { id: "demo-4", score: 6, risk: "low", categories: ["safe"], timeLabel: "Yesterday, 17:05", rulesVersion: "v1.2" },
];

export function HistoryPreview() {
  const [entries, setEntries] = useState(sampleEntries);
  const [selected, setSelected] = useState<ScanHistoryEntry | null>(null);

  return (
    <div className="fsd-stack">
      <HistoryList entries={entries} selectedId={selected?.id}
        onSelect={(entry) => setSelected((current) => current?.id === entry.id ? null : entry)}
        onClear={() => { setEntries([]); setSelected(null); }} />
      {selected && (
        <section className="fsd-card" aria-label="Selected scan" aria-live="polite">
          <div className="fsd-card__body fsd-stack">
            <h2 className="fsd-h2">Selected scan</h2>
            <p className="fsd-p fsd-small">Score: {selected.score}/100 &middot; {selected.timeLabel}</p>
            <div className="fsd-chip-row">
              {selected.categories.map((category) => <span className="fsd-chip" key={category}>{category}</span>)}
            </div>
            <p className="fsd-p fsd-small">Rules {selected.rulesVersion}{selected.aiVersion && <> &middot; AI {selected.aiVersion}</>}</p>
          </div>
        </section>
      )}
      {entries.length === 0 && (
        <button className="fsd-btn" type="button" onClick={() => setEntries(sampleEntries)}>Restore demo history</button>
      )}
    </div>
  );
}
