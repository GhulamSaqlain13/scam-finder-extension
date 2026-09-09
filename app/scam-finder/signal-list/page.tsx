import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { SignalListPreview } from "@/components/scam-finder/signal-list-preview";

export const metadata: Metadata = { title: "Signal list | Fiverr Scam Detector" };

export default function SignalListPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Signal list</h1>
        <p className="fsd-p fsd-small">Sample evidence, severity levels, and categories. The developer toggle only affects this preview.</p>
      </header>
      <SignalListPreview />
    </main>
  );
}
