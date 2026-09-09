import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { HistoryPreview } from "@/components/scam-finder/history-preview";

export const metadata: Metadata = { title: "History | Fiverr Scam Detector" };

export default function HistoryPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 668 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Scan history</h1>
        <p className="fsd-p fsd-small">Sample scan metadata, without message text. Select a row to view details. Clearing this demo only changes the current page.</p>
      </header>
      <HistoryPreview />
    </main>
  );
}
