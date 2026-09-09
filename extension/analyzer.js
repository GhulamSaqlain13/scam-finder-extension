(() => {
  const rules = [
    { pattern: /\b(?:send|share|give|provide|enter|reply with)\b.{0,65}\b(?:password|otp|verification code|six[- ]digit code|6[- ]digit code|passcode)\b/i, score: 96, title: "Account credentials or verification code requested" },
    { pattern: /\b(?:card|debit|credit)\s*(?:details?|number|information)|\bcvv\b|\bbank account\b/i, score: 90, title: "Financial details requested" },
    { pattern: /\b(?:pay|payment|release)\b.{0,70}\b(?:verify|verification|link|page)\b|\b(?:verify|verification|link|page)\b.{0,70}\b(?:payment|release)\b/i, score: 65, title: "External payment verification" },
    { pattern: /\b(?:telegram|whatsapp)\b/i, score: 35, title: "Off-platform contact" },
    { pattern: /\b(?:anydesk|teamviewer|remote access)\b/i, score: 90, title: "Remote access requested" },
    { pattern: /\b(?:gift card|usdt|bitcoin|crypto|verification fee|registration fee)\b/i, score: 75, title: "Unusual payment or advance fee" },
    { pattern: /\b(?:urgent|immediately|suspended|last chance)\b/i, score: 20, title: "Pressure to act quickly" },
    { pattern: /\b(?:download|install|run)\b.{0,45}\b(?:app|software|exe|zip)\b/i, score: 65, title: "Unknown download" },
  ];
  function analyze(text) {
    // Ignore individual safety-advice sentences, not the entire message.
    const requests = text.split(/[.!?\n]+/).filter(s => !/^\s*(?:please\s+)?(?:do not|don't|never|avoid)\b/i.test(s)).join(" ");
    const matches = rules.filter(rule => rule.pattern.test(requests));
    return { score: Math.min(99, matches.reduce((n, rule) => n + rule.score, 0)), signals: matches.map(rule => rule.title) };
  }

  globalThis.fsdAnalyze = analyze;
})();
