const assert = require("node:assert/strict");
const patterns = require("../data/scamPatterns.json");
require("../extension/normalizer.js");
require("../extension/patternMatcher.js");
require("../extension/scorer.js");

const matcher = globalThis.fsdPatternMatcher.create(patterns);
const scorer = globalThis.fsdScorer.create(patterns);
const score = (text) => scorer.score(matcher.match({ text }));

const safe = score(
  "Please review the attached project brief when you have time.",
);
assert.deepEqual(safe, {
  score: 0,
  level: "green",
  label: "Safe",
  categories: [],
  reasons: [],
});

const suspicious = score("Do you have an email address?");
assert.equal(suspicious.score, 20, "Weak keyword-only indicators are dampened");
assert.equal(suspicious.level, "green");
assert.equal(suspicious.label, "Safe");
assert.ok(suspicious.categories.includes("external_contact"));

const highRisk = score("This is Fiverr support. Send me your password now.");
assert.equal(highRisk.level, "red");
assert.equal(highRisk.label, "High Risk");
assert.ok(highRisk.score <= 100);
assert.ok(highRisk.score >= 60);
assert.ok(highRisk.reasons.some((reason) => reason.includes("password")));

const multiple = score("Contact me on WhatsApp and pay the verification fee.");
assert.equal(multiple.level, "red");
assert.ok(multiple.categories.includes("off_platform_communication"));
assert.ok(multiple.categories.includes("payment_request"));
assert.ok(
  multiple.reasons.some((reason) =>
    reason.toLowerCase().includes("combination"),
  ),
);

const legitimateEmail = score(
  "Please email the finished logo to the project contact.",
);
assert.ok(legitimateEmail.score < 60);
assert.notEqual(legitimateEmail.level, "red");

const legitimateLink = score(
  "Here is the link to the project brief: https://example.com/brief.",
);
assert.ok(legitimateLink.score < 60);
assert.notEqual(legitimateLink.level, "red");

const duplicate = scorer.score({
  categories: ["external_contact", "external_contact"],
  matches: [
    {
      category: "external_contact",
      matchedText: "email",
      reason: "Email detected",
    },
    {
      category: "external_contact",
      matchedText: "email",
      reason: "Email detected",
    },
  ],
  combinations: [],
});
assert.equal(
  duplicate.score,
  25,
  "Duplicate categories and exact matches are not double-counted",
);

const capped = scorer.score({
  categories: [
    "off_platform_communication",
    "payment_request",
    "fake_support",
    "account_credentials",
  ],
  matches: [],
  combinations: [
    {
      id: "one",
      categories: ["off_platform_communication", "payment_request"],
      bonusScore: 80,
      reason: "One",
    },
    {
      id: "one",
      categories: ["off_platform_communication", "payment_request"],
      bonusScore: 80,
      reason: "One",
    },
  ],
});
assert.equal(capped.score, 100, "The final score is capped at 100");

console.log(
  "PASS: scorer covers safe, suspicious, high-risk, multi-indicator, legitimate email/link, deduplication, and cap cases.",
);
