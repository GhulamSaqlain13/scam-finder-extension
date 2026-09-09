import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { InlineWarningPreview } from "@/components/scam-finder/inline-warning-preview";

export const metadata: Metadata = { title: "Inline warnings | Fiverr Scam Detector" };

export default function InlineWarningPage() {
  return <main className="fsd-page" style={{ maxWidth: 608 }}>
    <header className="fsd-page__head">
      <BackButton />
      <h1 className="fsd-h1">Inline warnings</h1>
      <p className="fsd-p fsd-small">Sample warnings across four risk bands. Try Why, Hide, and feedback. Changes stay in this preview and are not saved.</p>
    </header>
    <InlineWarningPreview />
  </main>;
}
