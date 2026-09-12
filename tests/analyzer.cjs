const assert = require("node:assert/strict");
require("../extension/analyzer.js");

const safe = [
  "I design bitcoin logos.",
  "Build a WhatsApp landing page.",
  "The documentation explains remote access and AnyDesk.",
  "The mockup contains a card number field.",
  "Do not send anyone your password or OTP.",
  "For your safety, never share your password.",
  "Please don't send bitcoin.",
  "You should not install AnyDesk.",
  "Avoid sharing your password.",
  "Don\u2019t enter your card number.",
  "Please send the logo. Bitcoin is the theme.",
];
for (const message of safe) {
  assert.equal(globalThis.fsdAnalyze(message).score, 0, message);
}

const risky = [
  ["Never mind, send me your password.", 96],
  ["Please send your OTP.", 96],
  ["Send bitcoin to release your order.", 75],
  ["Pay the verification fee.", 75],
  ["A registration fee is required.", 75],
  ["Enter your debit card information.", 90],
  ["Contact me on WhatsApp.", 35],
  ["Install AnyDesk.", 90],
  ["Do not share your password. Send me your OTP.", 96],
  ["Never share your password, but send me your verification code.", 96],
  ["Don't send bitcoin; instead pay the registration fee.", 75],
  ["Do not share your password, please send your OTP.", 96],
];
for (const [message, minimum] of risky) {
  assert.ok(globalThis.fsdAnalyze(message).score >= minimum, message);
}
assert.equal(globalThis.fsdAnalyze("Send your OTP. Send your OTP.").score, 96);
console.log("PASS: analyzer request context, negation, mixed advice and requests, and rule deduplication.");

const analyzeLink = (href, text = "Project reference") => globalThis.fsdAnalyze("Project reference", [{ href, text }]);
for (const [href, label] of [
  ["https://example.com/design", "Project reference"],
  ["https://www.example.com/design", "https://example.com/design"],
  ["https://example.com./design", "example.com"],
  ["https://help.fiverr.com/article", "Help article"],
  ["https://example.com/file", "brief.pdf"],
  ["https://example.com/file", "https://fiverr.com/long..."],
  ["https://example.com/file", "person@example.org"],
  ["https://example.com/fiverr.com", "Reference"],
  ["https://xn--bcher-kva.example/", "Reference"],
  ["mailto:person@example.com", "Email"],
  ["not a URL", "Reference"],
]) assert.equal(analyzeLink(href, label).score, 0, href + " / " + label);

const mismatch = analyzeLink("https://example.net/private?token=secret", "https://fiverr.com/orders");
assert.equal(mismatch.score, 45);
assert.match(mismatch.signals[0], /hostname differs/);
assert.match(mismatch.linkDetails[0], /example.net.*fiverr.com/);
assert.ok(!JSON.stringify(mismatch).includes("secret"));
for (const href of ["https://fiverr.com.example.net", "https://fiverr-verify.example", "https://f1verr.example"]) {
  assert.equal(analyzeLink(href).score, 60, href);
}
assert.equal(analyzeLink("https://fiverr.com@other.example").score, 50);
assert.equal(globalThis.fsdAnalyze("", Array(3).fill({ href: "https://other.example", text: "fiverr.com" })).score, 45, "Repeated link findings count once");
console.log("PASS: link mismatch, hostname warnings, URL normalization, benign external links, and private URL components.");
for (const [score, label] of [[0, "Low"], [29, "Low"], [30, "Suspicious"], [59, "Suspicious"], [60, "High"], [99, "High"]]) {
  assert.equal(globalThis.fsdRiskLabel(score), label);
}
assert.match(globalThis.fsdSignalAction("Remote access requested"), /Do not grant remote access/);
