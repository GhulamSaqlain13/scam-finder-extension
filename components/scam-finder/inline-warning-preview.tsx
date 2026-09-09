"use client";

import { useState } from "react";
import { InlineWarning, type InlineWarningProps } from "./inline-warning";

const examples: InlineWarningProps[] = [
  {
    scanId: "warning-critical", risk: "critical", score: 94,
    summary: "This message copies a Fiverr payment step and sends you to another site to enter card details.",
    signals: [
      { id: "card", severity: "critical", title: "Card details requested", explanation: "Fiverr never asks for card details in chat to release a payment." },
      { id: "domain", severity: "high", title: "Link imitates a Fiverr domain", explanation: "fiverr-secure-billing.example.com is not a Fiverr address." },
      { id: "urgency", severity: "medium", title: "Time pressure", explanation: "A short deadline is used to rush the decision." },
    ],
    actions: ["Do not enter card or login details on the linked page.", "Check the order status from your Fiverr dashboard instead."],
  },
  {
    scanId: "warning-high", risk: "high", score: 71,
    summary: "This message asks to move the payment off Fiverr, which removes your order protection.",
    signals: [{ id: "payment", severity: "high", title: "Payment moved off Fiverr", explanation: "The sender asks to pay outside the platform." }],
    actions: ["Keep the payment inside Fiverr."],
  },
  {
    scanId: "warning-suspicious", risk: "suspicious", score: 38,
    summary: "The sender wants to continue on WhatsApp. That is common for real clients too, so read the rest of the chat before deciding.",
    signals: [{ id: "contact", severity: "medium", title: "Off-platform contact requested", explanation: "The sender wants to continue on WhatsApp. Consider the rest of the conversation before deciding." }],
    actions: ["Keep project communication on Fiverr."],
  },
  { scanId: "warning-low", risk: "low", score: 6, summary: "No known scam patterns in this message. Keep payments inside Fiverr anyway." },
];

export function InlineWarningPreview() {
  const [version, setVersion] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  return <div className="fsd-stack">
    <div className="fsd-stack" key={version}>
      {examples.map((example) => <InlineWarning key={example.scanId} {...example} onDismiss={() => setHiddenCount((count) => count + 1)} />)}
    </div>
    <p className="fsd-p fsd-small" role="status">{hiddenCount > 0 ? `${hiddenCount} warning${hiddenCount === 1 ? "" : "s"} hidden.` : ""}</p>
    <button className="fsd-btn" type="button" disabled={hiddenCount === 0} onClick={() => { setVersion((value) => value + 1); setHiddenCount(0); }}>Restore demo warnings</button>
  </div>;
}
