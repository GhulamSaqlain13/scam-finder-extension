import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { Feedback } from "@/components/scam-finder/feedback";

export const metadata: Metadata = { title: "Feedback | Fiverr Scam Detector" };

export default function FeedbackPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Feedback</h1>
        <p className="fsd-p fsd-small">Try the feedback flow. This demo does not save or send your response.</p>
      </header>
      <Feedback scanId="preview-scan" />
    </main>
  );
}
