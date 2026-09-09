"use client";

import { useState } from "react";
import { SettingToggle } from "./setting-row";
import { SignalList, type RiskSignal } from "./signal-list";

const signals: RiskSignal[] = [
  {
    id: "financial-info", severity: "critical", title: "Card details requested",
    explanation: "The message asks for debit or credit card information. Fiverr never needs your card to release an order payment.",
    ruleId: "rule.financial_info_request", weight: 38,
  },
  {
    id: "payment-verification", severity: "high", title: "Payment step moved off Fiverr",
    explanation: "A separate verification page is presented as part of the Fiverr payment flow.",
    ruleId: "rule.external_payment_verification", weight: 24,
  },
  {
    id: "lookalike-domain", severity: "high", title: "Link imitates a Fiverr domain",
    explanation: "fiverr-secure-billing.example.com is not owned by Fiverr. The real domain is fiverr.com.",
    ruleId: "url.lookalike_domain", weight: 20,
  },
  {
    id: "urgency", severity: "medium", title: "Time pressure",
    explanation: "The message sets a short deadline to push a quick decision.",
    ruleId: "rule.urgency_pressure", weight: 9,
  },
];
const categories = ["fake_payment", "phishing_link", "personal_financial_info", "impersonation"];

export function SignalListPreview() {
  const [developerMode, setDeveloperMode] = useState(false);
  return (
    <div className="fsd-stack">
      <div className="fsd-card">
        <SettingToggle name="signal_preview_dev_mode" label="Developer mode"
          help="Show rule IDs and weights in this preview."
          checked={developerMode} onChange={setDeveloperMode} />
      </div>
      <SignalList signals={signals} categories={categories} developerMode={developerMode} />
    </div>
  );
}
