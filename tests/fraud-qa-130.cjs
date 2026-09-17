// Independent QA evaluation. This runner never adjusts production rules or labels.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const datasetPath = "tests/fixtures/fraud-qa-130.json";
const sourceFiles = [
  "extension/normalizer.js", "extension/patternMatcher.js", "extension/scorer.js",
  "extension/urlDetector.js", "extension/link-scanner.js", "extension/sensitive-information.js",
  "extension/analyzer.js", "data/scamPatterns.json", "extension/content-script.js",
  "extension/alertUI.js", "manifest.json",
];
const output = path.join(root, "reports/fraud-qa-130");
const replay = process.argv.includes("--snapshot");
const inputRoot = replay ? path.join(output, "snapshot") : root;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const datasetSource = fs.readFileSync(path.join(inputRoot, datasetPath), "utf8");
const groups = JSON.parse(datasetSource);
const expectedCounts = { legitimate: 20, suspicious: 20, highRisk: 20, legitimateExternalContact: 10, legitimatePayment: 10, links: 10, unusualSpelling: 10, emojis: 10, mixedCase: 10, multiSentence: 10 };
assert.deepEqual(Object.keys(groups).sort(), Object.keys(expectedCounts).sort());
const levels = ["green", "yellow", "red"];
const seenMessages = new Set();
const inputs = Object.entries(groups).flatMap(([group, records]) => {
  assert.equal(records.length, expectedCounts[group], group + " count");
  return records.map((record, index) => {
    assert.deepEqual(Object.keys(record).sort(), ["expectedIndicators", "expectedLevel", "message"]);
    assert.ok(typeof record.message === "string" && record.message.length > 0);
    assert.ok(levels.includes(record.expectedLevel));
    assert.ok(Array.isArray(record.expectedIndicators) && record.expectedIndicators.every(value => typeof value === "string"));
    assert.ok(!seenMessages.has(record.message), "Duplicate case: " + record.message);
    seenMessages.add(record.message);
    return { id: group + "-" + String(index + 1).padStart(2, "0"), group, ...record };
  });
});
assert.equal(inputs.length, 130);
const sources = Object.fromEntries(sourceFiles.map(file => [file, fs.readFileSync(path.join(inputRoot, file), "utf8")]));
const context = vm.createContext({ URL, TextEncoder });
for (const file of sourceFiles.slice(0, 7)) vm.runInContext(sources[file], context, { filename: file, timeout: 5000 });
const catalog = JSON.parse(sources["data/scamPatterns.json"]);
const matcher = context.fsdPatternMatcher.create(catalog);
const scorer = context.fsdScorer.create(catalog);
const legacyCategories = { EXTERNAL_COMMUNICATION: ["off_platform_communication", "external_contact"], ACCOUNT_VERIFICATION: ["account_credentials"], PERSONAL_INFORMATION: ["personal_information", "account_credentials"], PAYMENT_SCAM: ["payment_request", "off_platform_payment"], MALWARE: ["malicious_download"], FAKE_SUPPORT: ["fake_support"], PHISHING: ["phishing", "suspicious_link"], COERCION: ["urgency"] };
function errorType(expected, actual) {
  if (expected === actual) return "correct";
  if (expected === "green") return "falsePositive";
  if (actual === "green") return "falseNegative";
  return expected === "red" ? "undergraded" : "overgraded";
}
const results = inputs.map(record => {
  const matched = matcher.match({ text: record.message });
  matched.urlDetection = context.fsdUrlDetector.detect(record.message, []);
  const scored = scorer.score(matched);
  // These are the entry points used by currentResults/flags and preview analysis.
  const legacy = context.fsdAnalyzeMessage({ text: record.message, links: [] });
  const preview = context.fsdAnalyze(record.message, []);
  const legacyLevel = score => ({ Safe: "green", Suspicious: "yellow", "High Risk": "red" })[context.fsdDisplayRisk(score)];
  const actualIndicators = [...new Set(scored.categories)];
  return {
    ...record,
    normalizedMessage: context.fsdMessageNormalizer.normalize(record.message).normalizedText,
    inline: { actualLevel: scored.level, score: scored.score, errorType: errorType(record.expectedLevel, scored.level), actualIndicators, missingIndicators: record.expectedIndicators.filter(value => !actualIndicators.includes(value)), unexpectedIndicators: actualIndicators.filter(value => !record.expectedIndicators.includes(value)), matches: matched.matches, combinations: matched.combinations, urlIndicators: matched.urlDetection.indicators, reasons: scored.reasons },
    flag: { actualLevel: legacyLevel(legacy.score), score: legacy.score, errorType: errorType(record.expectedLevel, legacyLevel(legacy.score)), actualIndicators: legacy.categories, mappedIndicators: [...new Set(legacy.categories.flatMap(category => legacyCategories[category] || []))], matches: legacy.matches },
    preview: { actualLevel: legacyLevel(preview.score), score: preview.score, matches: preview.matches },
    disagrees: scored.level !== legacyLevel(legacy.score),
  };
});
function summarize(records, engine) {
  const counts = { total: records.length, correct: 0, falsePositive: 0, falseNegative: 0, undergraded: 0, overgraded: 0 };
  const confusion = Object.fromEntries(levels.map(level => [level, Object.fromEntries(levels.map(actual => [actual, 0]))]));
  for (const record of records) { counts[record[engine].errorType]++; confusion[record.expectedLevel][record[engine].actualLevel]++; }
  const positives = records.filter(record => record.expectedLevel !== "green").length;
  const negatives = records.length - positives;
  const detected = positives - counts.falseNegative;
  return { ...counts, accuracy: counts.correct / counts.total, expectedPositive: positives, expectedNegative: negatives, binaryPrecision: detected / (detected + counts.falsePositive), binaryRecall: detected / positives, falsePositiveRate: counts.falsePositive / negatives, confusion };
}
const summary = {
  inline: summarize(results, "inline"), flag: summarize(results, "flag"),
  disagreements: results.filter(record => record.disagrees).length,
  previewDisagreements: results.filter(record => record.preview.actualLevel !== record.flag.actualLevel).length,
  casesMissingExpectedIndicators: results.filter(record => record.inline.missingIndicators.length).length,
  casesWithUnexpectedIndicators: results.filter(record => record.inline.unexpectedIndicators.length).length,
  byGroup: Object.fromEntries(Object.keys(groups).map(group => [group, { inline: summarize(results.filter(record => record.group === group), "inline"), flag: summarize(results.filter(record => record.group === group), "flag") }])),
};
// Detect concurrent edits rather than silently reporting a moving rule set.
for (const [file, source] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(inputRoot, file), "utf8")), hash(source), "Source changed during evaluation: " + file);
assert.equal(hash(fs.readFileSync(path.join(inputRoot, datasetPath), "utf8")), hash(datasetSource), "Expectations changed during evaluation");
const report = {
  runAt: new Date().toISOString(), node: process.version,
  scope: "Synthetic, message-level rule evaluation. Inline catalog scorer after catalog load is primary; normalized legacy flag scoring and unnormalized preview scoring are reported separately. This is not a live DOM recall test or production accuracy estimate.",
  labelPolicy: { green: "Legitimate work, safety advice, or clearly quoted/design context without a real sensitive request.", yellow: "Off-platform contact or an opaque/unencrypted destination that warrants caution without clear theft or coercive payment evidence.", red: "Credential/secret collection, remote access, verification/activation fees, scam-like payment diversion, or account-threat verification.", indicators: "Minimum semantic categories expected, using catalog IDs. Additional indicators are reported for review, not automatically classified as false positives." },
  thresholds: { inline: "Production scorer.level: green 0–29, yellow 30–59, red 60–100", flag: "Production fsdDisplayRisk: green 0–20, yellow 21–60, red 61–100" },
  datasetSha256: hash(datasetSource), sourceSha256: Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, hash(source)])),
  summary, results,
};
fs.mkdirSync(output, { recursive: true });
if (!replay) for (const [file, source] of Object.entries({ ...sources, [datasetPath]: datasetSource })) {
  const target = path.join(output, "snapshot", file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}
fs.writeFileSync(path.join(output, replay ? "replay.json" : "results.json"), JSON.stringify(report, null, 2) + "\n");
const escape = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = [
  "# Fiverr rule-based fraud QA — 130 synthetic messages", "", report.scope, "",
  "No production rules, weights, or thresholds were changed for this evaluation. Expected labels are human-authored QA judgments, not verified fraud outcomes.", "",
  "## Classification results", "", "| Path | Correct | Accuracy | False positives | Missed warnings | Red → yellow | Yellow → red |", "|---|---:|---:|---:|---:|---:|---:|",
  ...["inline", "flag"].map(engine => { const s = summary[engine]; return `| ${engine} | ${s.correct}/${s.total} | ${(100*s.accuracy).toFixed(1)}% | ${s.falsePositive} | ${s.falseNegative} | ${s.undergraded} | ${s.overgraded} |`; }), "",
  "False positive means expected green but actual yellow/red. Missed warning means expected yellow/red but actual green. Red → yellow is reported separately as missed high-risk severity. Correct classifications require an exact three-color match.", "",
  `Inline/flag disagreement: ${summary.disagreements}/130. Flag/preview disagreement: ${summary.previewDisagreements}/130.`, "",
  "## Results by requested group", "", "| Group | Cases | Inline correct | Flag correct | Inline FP | Inline missed | Undergraded | Overgraded |", "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(summary.byGroup).map(([group,s]) => `| ${group} | ${s.inline.total} | ${s.inline.correct} | ${s.flag.correct} | ${s.inline.falsePositive} | ${s.inline.falseNegative} | ${s.inline.undergraded} | ${s.inline.overgraded} |`), "",
  "## Inline confusion matrix", "", "| Expected / actual | Green | Yellow | Red |", "|---|---:|---:|---:|",
  ...levels.map(level => `| ${level} | ${levels.map(actual => summary.inline.confusion[level][actual]).join(" | ")} |`), "",
  "## Incorrect inline classifications", "", "| Case | Expected | Actual / score | Error | Message | Matched categories |", "|---|---|---|---|---|---|",
  ...results.filter(record => record.inline.errorType !== "correct").map(record => `| ${record.id} | ${record.expectedLevel} | ${record.inline.actualLevel} / ${record.inline.score} | ${record.inline.errorType} | ${escape(record.message)} | ${record.inline.actualIndicators.join(", ")} |`), "",
  "## All classifications", "", "Every record's indicators, phrases/regex matches, URL evidence and combinations are in results.json.", "",
  "| Case | Expected | Inline | Flag | Preview | Outcome | Message |", "|---|---|---|---|---|---|---|",
  ...results.map(record => `| ${record.id} | ${record.expectedLevel} | ${record.inline.actualLevel} (${record.inline.score}) | ${record.flag.actualLevel} (${record.flag.score}) | ${record.preview.actualLevel} (${record.preview.score}) | ${record.inline.errorType} | ${escape(record.message)} |`), "",
  "## Reproduce", "", "Run `node tests/fraud-qa-130.cjs` against the current working tree. Run `node tests/fraud-qa-130.cjs --snapshot` to reproduce the recorded source snapshot. results.json records SHA-256 hashes for the dataset and evaluated runtime files. Snapshot copies are QA artifacts and are not loaded by the extension.", "",
  "This corpus is hand-selected and not statistically representative of Fiverr traffic. Some yellow/red policy boundaries need human adjudication. No URL is visited, no messages are sent, and no AI is used.", "",
];
if (!replay) fs.writeFileSync(path.join(output, "report.md"), lines.join("\n"));
console.log(JSON.stringify({ report: path.relative(root, output), ...summary }, null, 2));
