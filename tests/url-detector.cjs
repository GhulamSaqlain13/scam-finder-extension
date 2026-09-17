const assert = require("node:assert/strict");
const patterns = require("../data/scamPatterns.json");
require("../extension/urlDetector.js");
require("../extension/scorer.js");
const detector = globalThis.fsdUrlDetector;
const scorer = globalThis.fsdScorer.create(patterns);

const ordinary = detector.detect("Here is the project brief: https://example.com/brief");
assert.equal(ordinary.hasUrl, true);
assert.equal(ordinary.urls.length, 1);
assert.equal(ordinary.urls[0].external, true);
assert.equal(ordinary.indicators.length, 0, "Ordinary external URLs are not automatically suspicious");
assert.equal(ordinary.score, 0);

const fiverr = detector.detect("Verify your Fiverr account at https://fiverr-verify.example/login immediately.");
assert.ok(fiverr.indicators.some((indicator) => indicator.id === "fake_fiverr_domain"));
assert.ok(fiverr.indicators.some((indicator) => indicator.id === "url_login_verification"));
assert.ok(fiverr.score > 0);

const payment = detector.detect("Pay the invoice here: https://pay.example/checkout");
assert.ok(payment.indicators.some((indicator) => indicator.id === "url_payment_claim"));

const shortened = detector.detect("Please login and send your password: https://bit.ly/abc123");
assert.ok(shortened.indicators.some((indicator) => indicator.id === "url_shortener"));
assert.ok(shortened.indicators.some((indicator) => indicator.id === "shortener_suspicious_context"));

const safeFiverr = detector.detect("Open the official help page https://help.fiverr.com/article");
assert.equal(safeFiverr.indicators.length, 0);

const scoredUrl = scorer.score({
	categories: [],
	matches: [],
	combinations: [],
	urlDetection: detector.detect("Verify your Fiverr account: https://fiverr-verify.example/login"),
});
assert.ok(scoredUrl.score >= 60, "Suspicious URL indicators contribute to scorer output");
assert.ok(scoredUrl.categories.includes("suspicious_link"));
assert.ok(scoredUrl.categories.includes("phishing"));

const repeated = detector.detect("https://example.com/a https://example.com/a");
assert.equal(repeated.urls.length, 1);

console.log("PASS: local URL extraction, external URL neutrality, lookalike/login/payment/shortener indicators, and deduplication.");