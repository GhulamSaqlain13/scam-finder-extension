import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { Header } from "@/components/scam-finder/header";

export const metadata: Metadata = { title: "Header | Fiverr Scam Detector" };

export default function HeaderPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <div className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Header</h1>
        <p className="fsd-p fsd-small">
          Brand bar with example protection states. The settings icon opens the settings preview.
        </p>
      </div>
      <div className="fsd-stack">
        <Header />
        <Header isWatching={false} />
      </div>
    </main>
  );
}
