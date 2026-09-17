(() => {
  const types = [
    { type: "OTP", name: "an OTP or authentication code", pattern: /\b(?:otp|one[- ]time (?:password|code)|verification code|six[- ]digit code|6[- ]digit code|passcode)\b/i, action: "Never share authentication codes." },
    { type: "PASSWORD", name: "a password", pattern: /\bpassword\b/i, action: "Never share your account password." },
    { type: "CREDIT_CARD", name: "credit card information", pattern: /\b(?:(?:credit|debit) card|card (?:number|details|information))\b/i, action: "Do not send card information in chat." },
    { type: "CVV", name: "a CVV", pattern: /\bcvv\b/i, action: "Never share your card security code in chat." },
    { type: "BANK_ACCOUNT", name: "bank account information", pattern: /\bbank account\b/i, action: "Do not send bank account information to a buyer." },
    { type: "API_KEY", name: "an API key", pattern: /\bapi key\b/i, action: "Do not share API keys; revoke any key already exposed." },
    { type: "GITHUB_TOKEN", name: "a GitHub token", pattern: /\bgithub (?:access |personal access )?token\b/i, action: "Do not share GitHub tokens; revoke any token already exposed." },
    { type: "AWS_KEY", name: "an AWS key", pattern: /\baws (?:access |secret |secret access )?key\b/i, action: "Do not share AWS keys; rotate any key already exposed." },
    { type: "PRIVATE_KEY", name: "a private key", pattern: /\bprivate key\b/i, action: "Never share private keys. Replace any exposed key pair." },
  ];
  function requests(clauses) {
    return types.filter(type => clauses.some(clause => {
      const request = /\b(?:send|share|give|provide|enter|paste|reply with|upload)\b/i.exec(clause);
      return request && type.pattern.test(clause.slice(request.index, request.index + 110));
    })).map(({ type, name, action }) => ({ type, explanation: "This person appears to be requesting " + name + ".", action }));
  }
  function draft(text) {
    const found = new Set();
    const labeled = [
      ["OTP", /\b(?:otp|verification code|passcode)\s*(?:is|:|=)\s*\d{4,8}\b/i],
      ["PASSWORD", /\bpassword\s*(?:is|:|=)\s*["']?[^\s"']{6,}/i],
      ["CREDIT_CARD", /\b(?:card number|credit card|debit card)\s*(?:is|:|=)\s*(?:\d[ -]?){13,19}\b/i],
      ["CVV", /\bcvv\s*(?:is|:|=)\s*\d{3,4}\b/i],
      ["BANK_ACCOUNT", /\bbank account(?: number)?\s*(?:is|:|=)\s*[A-Z0-9][A-Z0-9 -]{5,33}\b/i],
      ["API_KEY", /\bapi key\s*(?:is|:|=)\s*["']?[A-Z0-9_/-]{12,}/i],
      ["GITHUB_TOKEN", /\bgithub (?:access |personal access )?token\s*(?:is|:|=)\s*["']?[A-Z0-9_]{12,}/i],
      ["AWS_KEY", /\baws (?:access |secret |secret access )?key\s*(?:is|:|=)\s*["']?[A-Z0-9/+=]{16,}/i],
      ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
    ];
    for (const [type, pattern] of labeled) if (pattern.test(text)) found.add(type);
    return types.filter(type => found.has(type.type)).map(({ type, name, action }) => ({ type, explanation: "This draft may contain " + name + ".", action }));
  }
  globalThis.fsdSensitiveInformation = { requests, draft };
})();
