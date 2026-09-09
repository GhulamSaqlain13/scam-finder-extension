export type RiskBand = "low" | "suspicious" | "high" | "critical";

export type ScamSignal = {
  title: string;
  detail: string;
  score: number;
};

export type ScamAnalysis = {
  score: number;
  risk: RiskBand;
  label: string;
  signals: ScamSignal[];
};

const rules: Array<ScamSignal & { pattern: RegExp }> = [
  {
    pattern: /\b(whatsapp|telegram|signal|text me|dm me|contact me)\b/i,
    score: 22,
    title: "Wants to move off Fiverr",
    detail:
      "Keeping the conversation on Fiverr protects your account and order.",
  },
  {
    pattern:
      /\b(card|debit|credit)\s*(details?|number|information)|cvv|security code/i,
    score: 42,
    title: "Requests payment details",
    detail: "Never share card numbers, CVV codes, or banking details in chat.",
  },
  {
    pattern:
      /\b(otp|one[- ]time|verification)\s*(code|number)|six[- ]digit code|passcode/i,
    score: 45,
    title: "Requests a verification code",
    detail: "Fiverr support and buyers should never need your one-time code.",
  },
  {
    pattern:
      /\b(pay|payment|fee|release)\b.{0,45}\b(link|verify|verification|website|page)\b|\b(link|verify|verification|website|page)\b.{0,45}\b(pay|payment|fee|release)\b/i,
    score: 32,
    title: "Suspicious payment instruction",
    detail:
      "Verify payments from your Fiverr dashboard, not from a message link.",
  },
  {
    pattern:
      /\b(password|login|username|email address)\b.{0,35}\b(send|share|provide|give|confirm)\b/i,
    score: 35,
    title: "Requests account information",
    detail: "Do not share login or account details with another Fiverr user.",
  },
  {
    pattern:
      /\b(urgent|immediately|right now|within \d+ minutes|last chance)\b/i,
    score: 15,
    title: "Uses time pressure",
    detail: "Urgency is often used to stop you checking a request carefully.",
  },
  {
    pattern:
      /\b(download|install)\b.{0,35}\b(file|app|software|extension)\b|\.exe\b|anydesk|teamviewer/i,
    score: 35,
    title: "Suggests an unsafe download",
    detail: "Avoid unknown files and remote-access tools sent through chat.",
  },
  {
    pattern: /\b(bitcoin|crypto|gift card|usdt|ethereum)\b/i,
    score: 30,
    title: "Requests an unusual payment method",
    detail:
      "Keep payments inside Fiverr and do not pay with crypto or gift cards.",
  },
];

export function analyzeMessage(text: string, includeAI = true): ScamAnalysis {
  const signals = rules.filter((rule) => rule.pattern.test(text));
  const baseScore = signals.reduce((total, signal) => total + signal.score, 3);
  const score = Math.min(
    99,
    includeAI ? baseScore : Math.round(baseScore * 0.85),
  );
  const risk: RiskBand =
    score >= 80
      ? "critical"
      : score >= 60
        ? "high"
        : score >= 30
          ? "suspicious"
          : "low";
  const label =
    risk === "critical"
      ? "Very high risk"
      : risk === "high"
        ? "High risk"
        : risk === "suspicious"
          ? "Suspicious"
          : "Low risk";
  return { score, risk, label, signals };
}
