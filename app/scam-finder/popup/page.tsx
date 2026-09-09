import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { Popup, type PopupResult } from "@/components/scam-finder/popup";

export const metadata: Metadata = { title: "Popup | Fiverr Scam Detector" };

const sampleResult: PopupResult = {
  scanId: "popup-demo", score: 94, risk: "critical",
  summary: "The latest message copies a Fiverr payment step and asks for card details on another site.",
  signals: [
    { id: "card", severity: "critical", title: "Card details requested", explanation: "The message asks for card details in chat to release a payment." },
    { id: "domain", severity: "high", title: "Link imitates a Fiverr domain", explanation: "fiverr-secure-billing.example.com is not a Fiverr address." },
    { id: "urgency", severity: "medium", title: "Time pressure", explanation: "A short deadline is used to rush the decision." },
  ],
  categories: ["fake_payment", "phishing_link", "personal_financial_info"],
  recommendations: [
    "Do not enter card or login details on the linked page.",
    "Check the order status from your Fiverr dashboard.",
    "Keep the payment inside Fiverr.",
  ],
};

export default function PopupPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 412 }}>
      <div className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Extension popup</h1>
      </div>
      <Popup result={sampleResult} pageUrl="fiverr.com/inbox/design_studio_kb" messageCount={7} />
    </main>
  );
}
