const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "qa-dataset.json"), "utf8"));
const patterns = require("../data/scamPatterns.json");
require("../extension/normalizer.js");
require("../extension/urlDetector.js");
require("../extension/patternMatcher.js");
require("../extension/scorer.js");

const matcher = globalThis.fsdPatternMatcher.create(patterns);
const scorer = globalThis.fsdScorer.create(patterns);
const level = score => score >= 60 ? "red" : score >= 30 ? "yellow" : "green";
const all = Object.entries(dataset).flatMap(([group, messages]) => messages.map(record => ({ group, ...record })));
const results = all.map(record => {
  const urlDetection = globalThis.fsdUrlDetector.detect(record.message);
  const matched = matcher.match({ text: record.message });
  matched.urlDetection = urlDetection;
  const scored = scorer.score(matched);
  const actualIndicators = [...new Set([...matched.categories, ...urlDetection.indicators.map(indicator => indicator.category)])];
  return {
    ...record,
    actualLevel: level(scored.score),
    score: scored.score,
    actualIndicators,
    reasons: scored.reasons,
  };
});

const byGroup = {};
for (const result of results) {
  byGroup[result.group] ||= { total: 0, correct: 0, falsePositives: 0, falseNegatives: 0 };
  const summary = byGroup[result.group];
  summary.total++;
  if (result.actualLevel === result.expectedLevel) summary.correct++;
  if (result.expectedLevel === "green" && result.actualLevel !== "green") summary.falsePositives++;
  if (result.expectedLevel !== "green" && result.actualLevel === "green") summary.falseNegatives++;
}
const falsePositives = results.filter(result => result.expectedLevel === "green" && result.actualLevel !== "green");
const falseNegatives = results.filter(result => result.expectedLevel !== "green" && result.actualLevel === "green");
const indicatorMisses = results.filter(result => result.expectedIndicators.some(indicator => !result.actualIndicators.includes(indicator)));
const unexpectedIndicators = results.filter(result => result.actualIndicators.some(indicator => !result.expectedIndicators.includes(indicator)));

console.log(JSON.stringify({
  total: results.length,
  correct: results.filter(result => result.actualLevel === result.expectedLevel).length,
  accuracy: Number((results.filter(result => result.actualLevel === result.expectedLevel).length / results.length).toFixed(3)),
  falsePositiveCount: falsePositives.length,
  falseNegativeCount: falseNegatives.length,
  indicatorMissCount: indicatorMisses.length,
  unexpectedIndicatorCount: unexpectedIndicators.length,
  byGroup,
  falsePositives,
  falseNegatives,
  indicatorMisses: indicatorMisses.map(({ group, message, expectedIndicators, actualIndicators, score, reasons }) => ({ group, message, expectedIndicators, actualIndicators, score, reasons })),
  unexpectedIndicators: unexpectedIndicators.map(({ group, message, expectedIndicators, actualIndicators, score, reasons }) => ({ group, message, expectedIndicators, actualIndicators, score, reasons })),
}, null, 2));

assert.equal(results.length, 130, "QA dataset must contain 130 records");
