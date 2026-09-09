import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { RecommendedActions } from "@/components/scam-finder/recommended-actions";

export const metadata: Metadata = { title: "Recommended actions | Fiverr Scam Detector" };

const actions = [
  "Do not enter card, bank or login details on any page linked in this chat.",
  "Open the order from your Fiverr dashboard to check its real status.",
  "Keep the conversation and the payment inside Fiverr.",
  "Report the message to Fiverr support if the sender keeps pushing.",
];

export default function RecommendedActionsPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Recommended actions</h1>
        <p className="fsd-p fsd-small">Example next steps for a very high risk result.</p>
      </header>
      <RecommendedActions
        risk="critical"
        actions={actions}
        notice="This is a risk estimate from message wording and links. It is not a judgement about the account you are talking to."
      />
    </main>
  );
}
