const assert = require("node:assert/strict");
require("../extension/link-scanner.js");
require("../extension/sensitive-information.js");
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
for (const [score, label] of [[0, "SAFE"], [20, "SAFE"], [21, "LOW"], [40, "LOW"], [41, "SUSPICIOUS"], [60, "SUSPICIOUS"], [61, "HIGH"], [80, "HIGH"], [81, "CRITICAL"], [100, "CRITICAL"]]) {
  assert.equal(globalThis.fsdRiskLabel(score), label);
  assert.equal(globalThis.fsdScoreIndicators([{ ruleId: "boundary", score }]).risk, label);
}
const weighted = globalThis.fsdScoreIndicators([10, 10, 25, 25].map((score, index) => ({ ruleId: "indicator_" + index, score })));
assert.equal(weighted.score, 70);
assert.equal(weighted.risk, "HIGH");
assert.equal(weighted.indicators.reduce((sum, item) => sum + item.points, 0), weighted.rawScore);
assert.equal(globalThis.fsdScoreIndicators([{ ruleId: "same", score: 25 }, { ruleId: "same", score: 25 }]).score, 25);
assert.equal(globalThis.fsdScoreIndicators([]).risk, "SAFE");
assert.throws(() => globalThis.fsdScoreIndicators([{ ruleId: "invalid", score: -1 }]), TypeError);
const capped = globalThis.fsdAnalyze("Send your password immediately.");
assert.equal(capped.score, 100);
assert.equal(capped.rawScore, 116);
assert.equal(capped.risk, "CRITICAL");
assert.match(globalThis.fsdSignalAction("Remote access requested"), /Do not grant remote access/);

for (const [text, category] of [
  ["Please pay outside Fiverr.", "PAYMENT_SCAM"],
  ["Send payment to my PayPal.", "PAYMENT_SCAM"],
  ["Send your OTP.", "ACCOUNT_VERIFICATION"],
  ["Contact me on Telegram.", "EXTERNAL_COMMUNICATION"],
  ["Please upload your passport.", "PERSONAL_INFORMATION"],
  ["Install AnyDesk.", "MALWARE"],
  ["I am from Fiverr support. Send your password.", "FAKE_SUPPORT"],
]) {
  const result = globalThis.fsdAnalyzeMessage({ text, links: [] });
  assert.ok(result.categories.includes(category), text);
  assert.equal(result.matches.length, result.signals.length);
  assert.equal(new Set(result.matches.map(match => match.ruleId)).size, result.matches.length);
  for (const match of result.matches) {
    assert.ok(match.ruleId && match.category && match.explanation && match.action);
    assert.ok(!JSON.stringify(match).includes(text), "Findings must not copy message text");
  }
}
for (const text of [
  "Please do not pay outside Fiverr.",
  "Never upload your passport.",
  "I contacted Fiverr support about my order.",
  "I am designing a Fiverr support guide. Click the heading to edit it.",
  "The mockup contains a credit card field.",
]) assert.equal(globalThis.fsdAnalyze(text).score, 0, text);
const phishing = analyzeLink("https://fiverr-login.example");
assert.deepEqual(phishing.categories, ["PHISHING"]);
assert.equal(phishing.matches[0].ruleId, "link_fiverr_lookalike");
const repeated = globalThis.fsdAnalyze("Pay outside Fiverr. Pay outside Fiverr.");
assert.equal(repeated.matches.filter(match => match.ruleId === "outside_payment").length, 1);
assert.equal(repeated.score, 70);
console.log("PASS: categorized rule engine, structured findings, deduplication, and benign context.");
for (const [text, label] of [
  ["Pay by bank transfer.", "Possible payment scam"],
  ["Verify your account on this page.", "Possible phishing"],
  ["Contact me on Discord.", "External communication request"],
  ["Send me your phone number.", "External communication request"],
  ["Email me tomorrow.", "External communication request"],
  ["Send your API key.", "Sensitive data request"],
  ["Share your token.", "Sensitive data request"],
  ["I am a Fiverr representative. Click here.", "Possible fake support"],
  ["This is Fiverr verification team. Confirm your identity.", "Possible fake support"],
]) assert.ok(globalThis.fsdCategoryLabels(globalThis.fsdAnalyze(text).signals).includes(label), text);
for (const text of [
  "Build a login page.", "The design includes a phone number field.",
  "I design Discord icons.", "The API key is documented in the manual.",
  "Do not verify your account on this page.", "Never email me personal details.",
  "Do not paste your token here.", "The article describes Fiverr security.",
]) assert.equal(globalThis.fsdAnalyze(text).score, 0, text);
assert.deepEqual(globalThis.fsdCategoryLabels(["Account credentials or verification code requested", "Financial details requested"]), ["Sensitive data request"]);
assert.deepEqual(globalThis.fsdCategoryLabels([]), []);
const scanner = globalThis.fsdLinkScanner;
for (const channel of ["WhatsApp", "Telegram", "Discord", "Skype", "Email", "Phone", "Instagram", "Facebook"]) {
  const result = globalThis.fsdAnalyze("Contact me on " + channel + " @example.");
  assert.deepEqual(result.categories, ["EXTERNAL_COMMUNICATION"]);
  assert.deepEqual(result.externalCommunication.channels, [channel]);
  assert.equal(result.score, 35);
  assert.equal(result.risk, "LOW");
  assert.equal(result.externalCommunication.riskIndicator, true);
  assert.equal(globalThis.fsdAnalyze("Do not contact me on " + channel + ".").externalCommunication, null);
}
const multiContact = globalThis.fsdAnalyze("Contact me on Telegram or WhatsApp. Email me.");
assert.equal(multiContact.score, 35, "Multiple contact channels count as one indicator");
assert.equal(multiContact.externalCommunication.channels.length, 3);
for (const text of ["Please send the Instagram logo.", "Add Facebook icons to the design.", "Build a WhatsApp landing page.", "Do not DM me on Instagram."]) {
  assert.equal(globalThis.fsdAnalyze(text).externalCommunication, null, text);
}
assert.match(globalThis.fsdSignalAction("Off-platform contact"), /not proof of a scam/);
for (const href of ["https://fake-fiverr.com", "https://fiverr-security.com", "https://fiverr.verify-example.com"]) {
  assert.equal(scanner.scan([href]).findings[0].id, "link_fiverr_lookalike", href);
}
assert.equal(scanner.scan(["https://www.fiverr.com./orders"]).links[0].external, false);
assert.equal(scanner.scan(["https://help.fiverr.com"]).links[0].external, false);
assert.equal(scanner.scan(["https://example.org"]).links[0].external, true);
assert.deepEqual(scanner.scan(["https://example.org"]).findings, []);
assert.equal(scanner.normalize("/help", "https://fiverr.com").href, "https://fiverr.com/help");
assert.equal(scanner.normalize("javascript:alert(1)"), null);
for (const href of ["https://192.0.2.1", "https://[2001:db8::1]", "https://0x7f000001"]) {
  assert.equal(scanner.scan([href]).findings[0].id, "link_ip_address");
}
assert.equal(scanner.scan(["https://bit.ly/example"]).findings[0].id, "link_shortener");
assert.equal(scanner.scan(["https://bit.ly.example.org/example"]).findings.length, 0);
const http = scanner.scan(["http://example.org"]);
assert.equal(http.findings[0].id, "link_http");
assert.equal(http.links[0].score, 10);
assert.equal(globalThis.fsdAnalyze("See https://fake-fiverr.com.").score, 60);
assert.equal(scanner.scan(["https://fake-fiverr.com/"], "https://fake-fiverr.com/").findings.length, 1);
assert.equal(scanner.textLinks("See (https://example.org/path). ")[0].href, "https://example.org/path");
console.log("PASS: dedicated local link scanner, normalization, IPs, shorteners, HTTP, and plain-text URLs.");
for (const [name, type] of [["OTP", "OTP"], ["password", "PASSWORD"], ["credit card", "CREDIT_CARD"], ["CVV", "CVV"], ["bank account", "BANK_ACCOUNT"], ["API key", "API_KEY"], ["GitHub token", "GITHUB_TOKEN"], ["AWS key", "AWS_KEY"], ["private key", "PRIVATE_KEY"]]) {
  const result = globalThis.fsdAnalyze("Send me your " + name + ".");
  assert.ok(result.score >= 90, name);
  assert.ok(result.sensitiveRequests.some(request => request.type === type), name);
  assert.equal(globalThis.fsdAnalyze("Never share your " + name + ".").sensitiveRequests.length, 0);
}
assert.match(globalThis.fsdAnalyze("Send me the OTP you received.").sensitiveRequests[0].action, /Never share authentication codes/);
for (const text of ["Please design a password reset screen.", "The project includes an API key guide.", "We use public key authentication."]) {
  assert.equal(globalThis.fsdAnalyze(text).sensitiveRequests.length, 0);
}
const draft = globalThis.fsdSensitiveInformation.draft("OTP: 938271");
for (const text of [
  "Message my manager on Telegram @projectmanager before I place the order.",
  "I already paid. Fiverr needs your email address before the payment can be released.",
  "Your account will be suspended in 10 minutes unless you verify it using this link.",
  "I cannot pay through Fiverr. Send me your PayPal address and I will pay directly.",
  "Pay the customs fee first and I will release your $2,000 project payment afterward.",
  "Scan this QR code to confirm your seller account and receive the payment.",
  "Use this shortened link to confirm your identity before we begin.",
  "Before I order, send $20 to prove you are a real freelancer. I will send it back.",
]) assert.ok(globalThis.fsdAnalyze(text).score > 20, "Must not display Safe: " + text);
assert.ok(globalThis.fsdAnalyze("Never share your password and please send me your OTP.").score >= 96);
for (const [score, label] of [[null, "Checking"], [0, "Safe"], [20, "Safe"], [21, "Suspicious"], [60, "Suspicious"], [61, "High Risk"], [100, "High Risk"]]) assert.equal(globalThis.fsdDisplayRisk(score), label);
assert.equal(draft[0].type, "OTP");
assert.ok(!JSON.stringify(draft).includes("938271"));
assert.equal(globalThis.fsdSensitiveInformation.draft("The order number is 938271").length, 0);
assert.equal(globalThis.fsdSensitiveInformation.draft("-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----")[0].type, "PRIVATE_KEY");

assert.equal(globalThis.fsdAnalyze("Never share your password and send anyone your OTP.").score, 0);
