(() => {
  function riskBand(score) {
    return score <= 20
      ? "SAFE"
      : score <= 40
        ? "LOW"
        : score <= 60
          ? "SUSPICIOUS"
          : score <= 80
            ? "HIGH"
            : "CRITICAL";
  }
  function scoreIndicators(indicators) {
    const unique = new Map();
    for (const indicator of indicators) {
      if (
        !indicator.ruleId ||
        !Number.isInteger(indicator.score) ||
        indicator.score < 0 ||
        indicator.score > 100
      ) {
        throw new TypeError(
          "Indicators require a rule ID and integer weight from 0 to 100",
        );
      }
      if (!unique.has(indicator.ruleId))
        unique.set(indicator.ruleId, { ...indicator, points: indicator.score });
    }
    const breakdown = [...unique.values()];
    const rawScore = breakdown.reduce(
      (sum, indicator) => sum + indicator.points,
      0,
    );
    const score = Math.min(100, rawScore);
    return { score, rawScore, risk: riskBand(score), indicators: breakdown };
  }
  const rules = [
    {
      id: "account_credentials",
      category: "ACCOUNT_VERIFICATION",
      pattern:
        /\b(?:send|share|give|provide|enter|reply with)\b.{0,65}\b(?:password|otp|verification code|six[- ]digit code|6[- ]digit code|passcode)\b/i,
      score: 96,
      title: "Account credentials or verification code requested",
    },
    {
      id: "financial_details",
      category: "PERSONAL_INFORMATION",
      pattern:
        /\b(?:send|share|give|provide|enter|confirm|submit|need)\b.{0,65}\b(?:(?:card|debit|credit)\s*(?:card\s*)?(?:details?|number|information)|cvv|bank account)\b/i,
      score: 90,
      title: "Financial details requested",
    },
    {
      id: "payment_verification",
      category: "PAYMENT_SCAM",
      pattern:
        /\b(?:pay|payment|release)\b.{0,70}\b(?:verify|verification|link|page)\b|\b(?:verify|verification|link|page)\b.{0,70}\b(?:payment|release)\b/i,
      score: 65,
      title: "External payment verification",
    },
    {
      id: "external_contact",
      category: "EXTERNAL_COMMUNICATION",
      patterns: [
        /\b(?:contact|message|reach|text|call|dm|add|follow|join)\s+(?:me|us)\b.{0,45}\b(?:whatsapp|telegram|discord|skype|email|phone|instagram|facebook)\b/i,
        /\b(?:chat|move|talk|connect|continue (?:this|the) conversation)\b.{0,30}\b(?:on|to|via|over)\s+(?:whatsapp|telegram|discord|skype|email|phone|instagram|facebook)\b/i,
        /\b(?:send|share|give|provide)\b.{0,30}\b(?:phone number|email address|(?:whatsapp|telegram|discord|skype|instagram|facebook)(?:\s+(?:number|handle|account|id))?)\b(?!\s+(?:logo|icons?|design|page|mockup)\b)/i,
        /\b(?:email|phone|call)\s+me\b/i,
      ],
      score: 35,
      title: "Off-platform contact",
    },
    {
      id: "remote_access",
      category: "MALWARE",
      pattern:
        /\b(?:download|install|run|open|use|enable|allow|grant|give)\b.{0,45}\b(?:anydesk|teamviewer|remote access)\b/i,
      score: 90,
      title: "Remote access requested",
    },
    {
      id: "advance_payment",
      category: "PAYMENT_SCAM",
      pattern:
        /\b(?:pay|send|transfer|buy|purchase|deposit|accept|require)\b.{0,65}\b(?:gift cards?|usdt|bitcoin|crypto|verification fee|registration fee)\b|\b(?:verification fee|registration fee)\b.{0,35}\b(?:required|due|payable)\b/i,
      score: 75,
      title: "Unusual payment or advance fee",
    },
    {
      id: "time_pressure",
      category: "COERCION",
      pattern: /\b(?:urgent|immediately|suspended|last chance)\b/i,
      score: 20,
      title: "Pressure to act quickly",
    },
    {
      id: "unknown_download",
      category: "MALWARE",
      pattern:
        /\b(?:download|install|run)\b.{0,45}\b(?:app|software|exe|zip)\b/i,
      score: 65,
      title: "Unknown download",
    },
    {
      id: "outside_payment",
      category: "PAYMENT_SCAM",
      patterns: [
        /\b(?:pay|send payment|transfer money)\b.{0,50}\b(?:outside|off)[ -]?(?:of )?fiverr\b/i,
        /\b(?:pay|send payment|transfer money)\b.{0,50}\b(?:directly to me|to my (?:paypal|bank)|via paypal)\b/i,
      ],
      score: 70,
      title: "Payment outside Fiverr requested",
    },
    {
      id: "identity_document",
      category: "PERSONAL_INFORMATION",
      pattern:
        /\b(?:send|share|provide|upload)\b.{0,55}\b(?:passport|national id|social security number|home address)\b/i,
      score: 80,
      title: "Sensitive personal information requested",
    },
    {
      id: "support_impersonation",
      category: "FAKE_SUPPORT",
      patterns: [
        /\b(?:i am|i'm|we are|we're|this is)\s+(?:(?:from|with|the)\s+)?(?:fiverr support|fiverr (?:security|support) team)\b/i,
        /\b(?:official message|message from)\b.{0,20}\bfiverr support\b/i,
      ],
      requires: /\b(?:send|share|provide|enter|pay|install|verify|click)\b/i,
      score: 60,
      title: "Fiverr support claim paired with an instruction",
    },
  ];
  rules.push(
    {
      id: "third_party_contact",
      category: "EXTERNAL_COMMUNICATION",
      pattern:
        /\b(?:message|contact|reach|text|call|dm|add)\s+(?:my|our|the)\s+(?:manager|assistant|team|colleague|agent)\b.{0,55}\b(?:telegram|whatsapp|discord|skype|email|phone)\b/i,
      score: 35,
      title: "Off-platform contact with a third party requested",
    },
    {
      id: "payment_email",
      category: "PAYMENT_SCAM",
      pattern:
        /\b(?:fiverr|buyer|payment)\b.{0,45}\b(?:needs?|requires?)\b.{0,30}\bemail address\b.{0,70}\b(?:payment|paid|release|order)\b/i,
      score: 70,
      title: "Contact information requested to release a payment",
    },
    {
      id: "paypal_request",
      category: "PAYMENT_SCAM",
      pattern:
        /\b(?:send|share|give|provide)\b.{0,45}\bpaypal (?:address|email|account|details)\b/i,
      score: 70,
      title: "Direct PayPal payment details requested",
    },
    {
      id: "advance_fee_request",
      category: "PAYMENT_SCAM",
      patterns: [
        /\b(?:pay|send|transfer|deposit)\b.{0,55}\b(?:customs fee|refundable (?:fee|deposit)|security deposit)\b/i,
        /\b(?:pay|send|transfer)\s+(?:me\s+)?(?:[$€£]\s*\d+|\d+\s*(?:usd|dollars?))\b.{0,70}\b(?:prove|verify|release|refund|send it back)\b/i,
      ],
      score: 75,
      title: "Upfront payment requested for verification or release",
    },
    {
      id: "qr_verification",
      category: "PHISHING",
      pattern:
        /\bscan\b.{0,25}\bqr code\b.{0,65}\b(?:confirm|verify|payment|account)\b/i,
      score: 65,
      title: "QR code requested for account or payment verification",
    },
    {
      id: "threat_verification",
      category: "PHISHING",
      pattern:
        /\b(?:account|profile)\b.{0,45}\b(?:suspended|blocked|closed)\b.{0,80}\bverify\b.{0,40}\blink\b/i,
      score: 65,
      title: "Account threat paired with a verification link",
    },
    {
      id: "identity_link",
      category: "PHISHING",
      pattern:
        /\b(?:use|open|follow|click)\b.{0,40}\blink\b.{0,50}\b(?:confirm|verify)\s+(?:your\s+)?(?:identity|account)\b/i,
      score: 60,
      title: "Message link requested for identity verification",
    },
    {
      id: "bank_transfer",
      category: "PAYMENT_SCAM",
      pattern:
        /\b(?:pay|send|transfer)\b.{0,40}\b(?:bank transfer|wire transfer)\b/i,
      score: 70,
      title: "Direct bank payment requested",
    },
    {
      id: "secret_key",
      category: "PERSONAL_INFORMATION",
      pattern:
        /\b(?:send|share|give|provide|enter|paste)\b.{0,45}\b(?:api key|access token|auth(?:entication)? token|token|secret key)\b/i,
      score: 96,
      title: "Secret key or token requested",
    },
    {
      id: "login_verification",
      category: "PHISHING",
      pattern:
        /(?:^\s*|\b(?:please|must|need to|should)\s+)(?:(?:log in|login)\s+(?:here|(?:on|at|using|through)\b.{0,35}\b(?:link|page|website))|(?:verify (?:your )?account|confirm (?:your )?identity|complete (?:a |the )?security check)\b.{0,55}\b(?:here|link|page|website))\b/i,
      score: 60,
      title: "Login or identity verification through a message link requested",
    },
    {
      id: "support_identity",
      category: "FAKE_SUPPORT",
      pattern:
        /\b(?:i am|i'm|we are|we're|this is)\s+(?:(?:from|with|the|a)\s+)?fiverr\s+(?:security(?!\s+team\b)|representative|verification team)\b/i,
      requires:
        /\b(?:send|share|provide|enter|pay|install|verify|click|confirm)\b/i,
      score: 60,
      title: "Fiverr staff identity claim paired with an instruction",
    },
  );
  function analyze(text, links = []) {
    const normalized = text.normalize("NFKC").replace(/[\u2018\u2019]/g, "'");
    // Keep clauses separate so safety advice cannot hide a subsequent request,
    // and unrelated sentences cannot combine into a synthetic rule match.
    const clauses = normalized.split(
      /[.!?;\n]+|\b(?:but|however|instead)\b|(?:,\s*|\band\s+(?:then\s+|(?=please\s+)))(?=(?:please\s+)?(?:send|share|give|provide|enter|pay|install|download)\b)/i,
    );
    const negatedAction =
      /\b(?:do not|don't|never|avoid|must not|mustn't|should not|shouldn't)\s+(?:(?:ever|please)\s+)?(?:send(?:ing)?|shar(?:e|ing)|giv(?:e|ing)|provid(?:e|ing)|enter(?:ing)?|pay(?:ing)?|transfer(?:ring)?|buy(?:ing)?|purchas(?:e|ing)|deposit(?:ing)?|accept(?:ing)?|requir(?:e|ing)|contact(?:ing)?|messag(?:e|ing)|reach(?:ing)?|join(?:ing)?|add(?:ing)?|text(?:ing)?|chat(?:ting)?|mov(?:e|ing)|talk(?:ing)?|connect(?:ing)?|download(?:ing)?|install(?:ing)?|run(?:ning)?|open(?:ing)?|us(?:e|ing)|enabl(?:e|ing)|allow(?:ing)?|grant(?:ing)?|confirm(?:ing)?|submit(?:ting)?)\b/i;
    const requests = clauses.filter(
      (clause) =>
        !negatedAction.test(clause) &&
        !/\b(?:do not|don't|never|avoid|should not|shouldn't)\s+(?:upload(?:ing)?|verif(?:y|ying)|past(?:e|ing)|email(?:ing)?|phon(?:e|ing)|call(?:ing)?|dm(?:ing)?|follow(?:ing)?|log(?:ging)? in|login|complet(?:e|ing))\b/i.test(
          clause,
        ),
    );
    const matches = rules.filter(
      (rule) =>
        requests.some((clause) =>
          (rule.patterns || [rule.pattern]).some((pattern) =>
            pattern.test(clause),
          ),
        ) &&
        (!rule.requires ||
          requests.some((clause) => rule.requires.test(clause))),
    );
    const inspected = globalThis.fsdLinkScanner.scan(links, text);
    const sensitiveRequests =
      globalThis.fsdSensitiveInformation.requests(requests);
    const contactRule = matches.find((rule) => rule.id === "external_contact");
    const contactClauses = contactRule
      ? requests.filter((clause) =>
          contactRule.patterns.some((pattern) => pattern.test(clause)),
        )
      : [];
    const contactChannels = [
      "WhatsApp",
      "Telegram",
      "Discord",
      "Skype",
      "Email",
      "Phone",
      "Instagram",
      "Facebook",
    ].filter((channel) =>
      contactClauses.some((clause) =>
        new RegExp(
          "\\b" + (channel === "Phone" ? "(?:phone|call)" : channel) + "\\b",
          "i",
        ).test(clause),
      ),
    );
    const findings = [...matches, ...inspected.findings];
    if (
      sensitiveRequests.length &&
      !matches.some((rule) =>
        ["account_credentials", "financial_details", "secret_key"].includes(
          rule.id,
        ),
      )
    ) {
      findings.push({
        id: "sensitive_information",
        category: "PERSONAL_INFORMATION",
        score: 96,
        title: "Sensitive information requested",
      });
    }
    const indicators = findings.map((rule) => ({
      ruleId: rule.id,
      category: rule.category,
      score: rule.score,
      explanation: rule.title,
      action: globalThis.fsdSignalAction(rule.title),
    }));
    return {
      ...scoreIndicators(indicators),
      signals: findings.map((rule) => rule.title),
      categories: [...new Set(findings.map((rule) => rule.category))],
      matches: indicators,
      sensitiveRequests,
      externalCommunication: contactRule
        ? {
            channels: contactChannels,
            explanation:
              "The user is asking you to continue communication outside Fiverr.",
            riskIndicator: true,
          }
        : null,
      linkDetails: inspected.details,
    };
  }

  globalThis.fsdAnalyze = analyze;
  globalThis.fsdAnalyzeMessage = (message) => {
    const normalized = globalThis.fsdMessageNormalizer?.normalize(
      message.text,
    ) || {
      originalText: message.text,
      normalizedText: message.text,
    };
    return globalThis.fsdAnalyze(
      normalized.normalizedText,
      message.linkMetadata ?? message.links.map((href) => ({ href, text: "" })),
    );
  };
  globalThis.fsdRiskLabel = riskBand;
  globalThis.fsdDisplayRisk = (score) =>
    score === null || score === undefined
      ? "Checking"
      : score <= 20
        ? "Safe"
        : score <= 60
          ? "Suspicious"
          : "High Risk";
  globalThis.fsdScoreIndicators = scoreIndicators;
  globalThis.fsdRiskColor = (score) =>
    score === null || score === undefined
      ? "#667085"
      : score <= 20
        ? "#238052"
        : score <= 60
          ? "#b47716"
          : "#b23b3b";
  const categoryLabels = {
    PAYMENT_SCAM: "Possible payment scam",
    PHISHING: "Possible phishing",
    EXTERNAL_COMMUNICATION: "External communication request",
    ACCOUNT_VERIFICATION: "Sensitive data request",
    PERSONAL_INFORMATION: "Sensitive data request",
    FAKE_SUPPORT: "Possible fake support",
    MALWARE: "Possible unsafe software",
    COERCION: "Pressure tactics",
    ACCOUNT_STATUS: "Fiverr contact unavailable",
  };
  const signalCategories = new Map(
    rules.map((rule) => [rule.title, rule.category]),
  );
  signalCategories.set(
    "External contact details requested",
    "EXTERNAL_COMMUNICATION",
  );
  signalCategories.set(
    "Sensitive information requested",
    "PERSONAL_INFORMATION",
  );
  signalCategories.set(
    "Fiverr contact is no longer available",
    "ACCOUNT_STATUS",
  );
  for (const title of [
    "Destination uses an IP address instead of a domain name",
    "Known URL shortener hides the final destination",
    "Link uses unencrypted HTTP instead of HTTPS",
    "Displayed URL hostname differs from the link destination",
    "Link contains user information before @; the destination is the hostname after @",
    "Destination uses a Fiverr-like name but is outside fiverr.com",
  ])
    signalCategories.set(title, "PHISHING");
  // Derive labels from fixed signals so existing saved results remain compatible.
  globalThis.fsdCategoryLabels = (signals) => [
    ...new Set(
      signals
        .map((signal) => categoryLabels[signalCategories.get(signal)])
        .filter(Boolean),
    ),
  ];
  const actions = {
    "Sensitive information requested":
      "Do not share authentication codes, financial details, or secret keys.",
    "Destination uses an IP address instead of a domain name":
      "Verify who owns the destination before sharing information.",
    "Known URL shortener hides the final destination":
      "Ask for the full destination URL before opening it.",
    "Link uses unencrypted HTTP instead of HTTPS":
      "Do not enter credentials or payment details over HTTP.",
    "Direct bank payment requested": "Keep payment within the Fiverr order.",
    "External contact details requested":
      "This is a risk indicator, not proof of a scam. Keep the conversation on Fiverr.",
    "Secret key or token requested":
      "Do not share API keys or access tokens. Revoke any secret already exposed.",
    "Login or identity verification through a message link requested":
      "Open the service directly to check any verification request.",
    "Fiverr staff identity claim paired with an instruction":
      "Open Fiverr directly and verify the claim through its support channel.",
    "Account credentials or verification code requested":
      "Do not share passwords or verification codes.",
    "Financial details requested": "Do not send card or bank details in chat.",
    "External payment verification":
      "Open Fiverr directly and check your order's payment status.",
    "Off-platform contact":
      "This is a risk indicator, not proof of a scam. Keep the conversation on Fiverr.",
    "Remote access requested": "Do not grant remote access to your device.",
    "Unusual payment or advance fee":
      "Do not pay a buyer a fee or send gift cards or cryptocurrency.",
    "Pressure to act quickly": "Pause and verify the request before acting.",
    "Unknown download": "Do not install or run an unverified download.",
    "Payment outside Fiverr requested": "Keep payment within the Fiverr order.",
    "Sensitive personal information requested":
      "Do not send identity documents or personal identifiers in chat.",
    "Fiverr support claim paired with an instruction":
      "Open Fiverr directly and verify the claim through its support channel.",
    "Displayed URL hostname differs from the link destination":
      "Open the intended site directly instead of following this link.",
    "Link contains user information before @; the destination is the hostname after @":
      "Check the hostname after @ before opening the link.",
    "Destination uses a Fiverr-like name but is outside fiverr.com":
      "Open fiverr.com directly to check the request.",
    "Fiverr contact is no longer available":
      "Treat this conversation carefully and keep any saved evidence before continuing.",
  };
  globalThis.fsdSignalAction = (signal) =>
    actions[signal] || "Verify this request before acting.";
})();
