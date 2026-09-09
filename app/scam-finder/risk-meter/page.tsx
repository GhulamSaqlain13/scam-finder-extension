import { BackButton } from "@/components/scam-finder/back-button";
import type { Metadata } from "next";

import { RiskMeter } from "@/components/scam-finder/risk-meter";

export const metadata: Metadata = { title: "Risk meter | Fiverr Scam Detector" };

export default function RiskMeterPage() {
  return (
    <main className="fsd-page" style={{ maxWidth: 468 }}>
      <header className="fsd-page__head">
        <BackButton />
        <h1 className="fsd-h1">Risk meter</h1>
        <p className="fsd-p fsd-small">Sample scores across all four risk bands.</p>
      </header>
      <div className="fsd-stack">
        <RiskMeter
          score={94}
          risk="critical"
          summary="This message copies a Fiverr payment step and asks for card details on another website. Fiverr never releases payments that way."
        />
        <RiskMeter score={8} risk="low" />
        <RiskMeter score={42} risk="suspicious" />
        <RiskMeter score={67} risk="high" />
      </div>
    </main>
  );
}
