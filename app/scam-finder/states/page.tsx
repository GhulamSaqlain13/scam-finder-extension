import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { LoadingState, NoScansState, NotOnFiverrState, ScanErrorState, SignedOutState } from "@/components/scam-finder/states";

export const metadata: Metadata = { title: "States | Fiverr Scam Detector" };

export default function StatesPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Interface states</h1>
        <p className="fsd-p fsd-small">Examples of empty, loading, error, and signed-out screens. Actions are disabled until scanning and sign-in are connected.</p>
      </header>
      <div className="fsd-stack">
        <NotOnFiverrState />
        <NoScansState />
        <LoadingState messageCount={4} />
        <ScanErrorState description="The server did not respond. On-device rules still ran and found no strong signals." />
        <SignedOutState />
      </div>
    </main>
  );
}
