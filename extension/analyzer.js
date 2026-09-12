(() => {
  const rules = [
    { pattern: /\b(?:send|share|give|provide|enter|reply with)\b.{0,65}\b(?:password|otp|verification code|six[- ]digit code|6[- ]digit code|passcode)\b/i, score: 96, title: "Account credentials or verification code requested" },
    { pattern: /\b(?:send|share|give|provide|enter|confirm|submit|need)\b.{0,65}\b(?:(?:card|debit|credit)\s*(?:card\s*)?(?:details?|number|information)|cvv|bank account)\b/i, score: 90, title: "Financial details requested" },
    { pattern: /\b(?:pay|payment|release)\b.{0,70}\b(?:verify|verification|link|page)\b|\b(?:verify|verification|link|page)\b.{0,70}\b(?:payment|release)\b/i, score: 65, title: "External payment verification" },
    { pattern: /\b(?:contact|message|reach|join|add|text|chat|move|talk|connect)\b.{0,45}\b(?:telegram|whatsapp)\b/i, score: 35, title: "Off-platform contact" },
    { pattern: /\b(?:download|install|run|open|use|enable|allow|grant|give)\b.{0,45}\b(?:anydesk|teamviewer|remote access)\b/i, score: 90, title: "Remote access requested" },
    { pattern: /\b(?:pay|send|transfer|buy|purchase|deposit|accept|require)\b.{0,65}\b(?:gift cards?|usdt|bitcoin|crypto|verification fee|registration fee)\b|\b(?:verification fee|registration fee)\b.{0,35}\b(?:required|due|payable)\b/i, score: 75, title: "Unusual payment or advance fee" },
    { pattern: /\b(?:urgent|immediately|suspended|last chance)\b/i, score: 20, title: "Pressure to act quickly" },
    { pattern: /\b(?:download|install|run)\b.{0,45}\b(?:app|software|exe|zip)\b/i, score: 65, title: "Unknown download" },
  ];
  function webUrl(value) {
    try {
      const url = new URL(value);
      return /^(?:https?:)$/.test(url.protocol) ? url : null;
    } catch { return null; }
  }
  function hostname(url) {
    return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  }
  function displayedUrl(label) {
    const value = label.trim();
    if (/\s|[\u2026]/.test(value) || value.includes("...")) return null;
    if (/^https?:\/\//i.test(value)) return webUrl(value);
    // Bare domains are common link labels; filenames and email addresses are not URLs.
    if (/@/.test(value) || /\.(?:pdf|zip|png|jpe?g|gif|svg|docx?|xlsx?|txt|js|html?)$/i.test(value)) return null;
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::\d+)?(?:[/?#].*)?$/i.test(value)) return webUrl("https://" + value);
    return null;
  }
  function inspectLinks(links) {
    const findings = new Map();
    const details = [];
    for (const link of links) {
      const destination = webUrl(link.href);
      if (!destination) continue;
      const host = hostname(destination);
      const displayed = displayedUrl(link.text);
      const concerns = [];
      const add = (title, score) => {
        findings.set(title, { title, score });
        concerns.push(title);
      };
      if (displayed && hostname(displayed) !== host) {
        add("Displayed URL hostname differs from the link destination", 45);
      }
      if (destination.username || destination.password) {
        add("Link contains user information before @; the destination is the hostname after @", 50);
      }
      const official = host === "fiverr.com" || host.endsWith(".fiverr.com");
      if (!official && host.split(".").some(part => /^(?:fiverr|f1verr|flverr|fiver)(?:$|-)/.test(part))) {
        add("Destination uses a Fiverr-like name but is outside fiverr.com", 60);
      }
      if (concerns.length) {
        // Hostnames are only for the live warning, never result storage.
        const detail = "Link destination: " + destination.hostname +
          (displayed ? "; displayed hostname: " + displayed.hostname : "") + ".";
        if (!details.includes(detail)) details.push(detail);
      }
    }
    return { findings: [...findings.values()], details };
  }
  function analyze(text, links = []) {
    const normalized = text.normalize("NFKC").replace(/[\u2018\u2019]/g, "'");
    // Keep clauses separate so safety advice cannot hide a subsequent request,
    // and unrelated sentences cannot combine into a synthetic rule match.
    const clauses = normalized.split(/[.!?;\n]+|\b(?:but|however|instead)\b|,\s*(?=(?:please\s+)?(?:send|share|give|provide|enter|pay|install|download)\b)/i);
    const negatedAction = /\b(?:do not|don't|never|avoid|must not|mustn't|should not|shouldn't)\s+(?:(?:ever|please)\s+)?(?:send(?:ing)?|shar(?:e|ing)|giv(?:e|ing)|provid(?:e|ing)|enter(?:ing)?|pay(?:ing)?|transfer(?:ring)?|buy(?:ing)?|purchas(?:e|ing)|deposit(?:ing)?|accept(?:ing)?|requir(?:e|ing)|contact(?:ing)?|messag(?:e|ing)|reach(?:ing)?|join(?:ing)?|add(?:ing)?|text(?:ing)?|chat(?:ting)?|mov(?:e|ing)|talk(?:ing)?|connect(?:ing)?|download(?:ing)?|install(?:ing)?|run(?:ning)?|open(?:ing)?|us(?:e|ing)|enabl(?:e|ing)|allow(?:ing)?|grant(?:ing)?|confirm(?:ing)?|submit(?:ting)?)\b/i;
    const requests = clauses.filter(clause => !negatedAction.test(clause));
    const matches = rules.filter(rule => requests.some(clause => rule.pattern.test(clause)));
    const inspected = inspectLinks(links);
    const findings = [...matches, ...inspected.findings];
    return {
      score: Math.min(99, findings.reduce((n, rule) => n + rule.score, 0)),
      signals: findings.map(rule => rule.title),
      linkDetails: inspected.details,
    };
  }

  globalThis.fsdAnalyze = analyze;
  globalThis.fsdRiskLabel = score => score >= 60 ? "High" : score >= 30 ? "Suspicious" : "Low";
  const actions = {
    "Account credentials or verification code requested": "Do not share passwords or verification codes.",
    "Financial details requested": "Do not send card or bank details in chat.",
    "External payment verification": "Open Fiverr directly and check your order's payment status.",
    "Off-platform contact": "Keep the conversation and payment on Fiverr.",
    "Remote access requested": "Do not grant remote access to your device.",
    "Unusual payment or advance fee": "Do not pay a buyer a fee or send gift cards or cryptocurrency.",
    "Pressure to act quickly": "Pause and verify the request before acting.",
    "Unknown download": "Do not install or run an unverified download.",
    "Displayed URL hostname differs from the link destination": "Open the intended site directly instead of following this link.",
    "Link contains user information before @; the destination is the hostname after @": "Check the hostname after @ before opening the link.",
    "Destination uses a Fiverr-like name but is outside fiverr.com": "Open fiverr.com directly to check the request.",
  };
  globalThis.fsdSignalAction = signal => actions[signal] || "Verify this request before acting.";
})();
