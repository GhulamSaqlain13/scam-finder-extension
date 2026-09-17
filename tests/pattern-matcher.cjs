const assert = require("node:assert/strict");
const patterns = require("../data/scamPatterns.json");
require("../extension/normalizer.js");
require("../extension/patternMatcher.js");

const matcher = globalThis.fsdPatternMatcher.create(patterns);
const hasCategory = (result, category) => result.categories.includes(category);

const legitimate = [
  ["Please review the attached homepage mockup when you have time.", false],
  ["I will deliver the final SVG and source files today.", false],
  ["The Bitcoin logo concept is ready for your feedback.", true],
  ["This landing page design includes a WhatsApp icon.", true],
];
for (const [text, hasIndicator] of legitimate) {
  const result = matcher.match({ text });
  assert.equal(result.matched, hasIndicator, text);
  assert.equal(result.combinations.length, 0, text);
}

const suspicious = [
  [
    "Contact me on WhatsApp and pay the verification fee.",
    ["off_platform_communication", "payment_request"],
    "off_platform_communication_plus_payment_request",
  ],
  [
    "This is Fiverr support. Send me your password now.",
    ["fake_support", "account_credentials"],
    "fake_support_plus_account_credentials",
  ],
  [
    "Your account will be suspended. Verify it using this link immediately.",
    ["phishing", "urgency"],
    "phishing_plus_urgency",
  ],
  [
    "Pay the verification fee in bitcoin to continue.",
    ["payment_request", "cryptocurrency"],
    "cryptocurrency_plus_payment_request",
  ],
  ["Buy an Amazon gift card and send me the code.", ["gift_card"], null],
  ["Install AnyDesk and grant me remote access.", ["malicious_download"], null],
  [
    "Please send your passport and home address.",
    ["personal_information"],
    null,
  ],
  [
    "We are hiring for easy work. Pay a registration fee and message me on Telegram.",
    ["job_offer_scam", "payment_request", "off_platform_communication"],
    "off_platform_communication_plus_payment_request",
  ],
];
for (const [text, categories, combination] of suspicious) {
  const result = matcher.match({ text });
  assert.equal(result.matched, true, text);
  for (const category of categories)
    assert.ok(hasCategory(result, category), `${category}: ${text}`);
  if (combination)
    assert.ok(
      result.combinations.some((item) => item.id === combination),
      text,
    );
}

const duplicate = matcher.match({ text: "WhatsApp WhatsApp WhatsApp" });
assert.equal(
  duplicate.matches.filter(
    (match) =>
      match.category === "off_platform_communication" &&
      match.matchedText === "whatsapp",
  ).length,
  1,
  "Repeated indicators are returned once",
);
assert.ok(
  duplicate.matches.every((match) => match.reason && match.matchedText),
  "Every indicator includes exact text and a human-readable reason",
);

console.log(
  "PASS: pattern matcher covers legitimate context, suspicious categories, combinations, exact indicators, and deduplication.",
);
