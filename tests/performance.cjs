/* eslint-disable @typescript-eslint/no-require-imports -- Standalone performance regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
  const catalog = JSON.parse(read('data/scamPatterns.json'));
  const messages = Object.values(JSON.parse(read('tests/fixtures/fraud-qa-130.json'))).flat();
  function engine(file) {
    let allocations = 0;
    const context = vm.createContext({ URL, RegExp: function (...args) { allocations++; return new RegExp(...args); } });
    vm.runInContext(read('extension/normalizer.js'), context);
    vm.runInContext(read(file), context);
    vm.runInContext(read('extension/scorer.js'), context);
    const matcher = context.fsdPatternMatcher.create(catalog);
    const scorer = context.fsdScorer.create(catalog);
    return { match: message => matcher.match(message), score: result => scorer.score(result), allocations: () => allocations };
  }
  const before = engine('reports/performance/before/patternMatcher.js');
  const after = engine('extension/patternMatcher.js');
  for (const message of messages) {
    const a = before.match(message), b = after.match(message);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(JSON.stringify(before.score(a)), JSON.stringify(after.score(b)));
  }
  const stats = {};
  for (const [name, matcher] of Object.entries({ before, after })) {
    const initial = matcher.allocations();
    const started = performance.now();
    for (let pass = 0; pass < 20; pass++) for (const message of messages) matcher.match(message);
    stats[name] = { messages: messages.length * 20, milliseconds: Math.round(performance.now() - started), regexAllocations: matcher.allocations() - initial };
  }
  assert.equal(stats.after.regexAllocations, 0);

  let reads = 0, listener;
  let records = [{ id: 'a', conversationId: 'c', score: 65, detectedAt: Date.now() }];
  const context = vm.createContext({ chrome: { storage: {
    onChanged: { addListener(fn) { listener = fn; } },
    local: { async get() { reads++; return { fsd_message_history: records }; }, async set(value) { records = value.fsd_message_history; listener({ fsd_message_history: {} }, 'local'); } },
  } } });
  vm.runInContext(read('extension/messageHistory.js'), context);
  await Promise.all(Array.from({ length: 100 }, () => context.fsdMessageHistory.getMessage('a', 'c')));
  assert.equal(reads, 1, 'Concurrent history lookups share one read');
  records = [];
  listener({ fsd_message_history: {} }, 'local');
  assert.equal(await context.fsdMessageHistory.getMessage('a', 'c'), null);
  assert.equal(reads, 2, 'External updates invalidate history cache');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main><div data-testid="message">Hello</div></main>');
    await page.addScriptTag({ path: path.join(root, 'extension/message-detector.js') });
    await page.evaluate(() => {
      window.batches = 0;
      window.detector = window.fsdMessageDetector.create({ onBatch: () => window.batches++, hasMessage: () => false, hasRow: () => false });
      window.detector.start();
      window.batches = 0;
      for (let i = 0; i < 100; i++) {
        const alert = document.createElement('span');
        alert.dataset.fsdAlert = 'true';
        document.querySelector('main').append(alert);
      }
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.batches), 0, 'Green alerts do not trigger scans');
    await page.evaluate(() => {
      const message = document.querySelector('[data-testid="message"]');
      for (let i = 0; i < 100; i++) message.textContent = 'Edit ' + i;
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.batches), 1, 'A burst produces one batch');
    await page.evaluate(() => window.detector.stop());
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(root, 'reports/performance/measurements.json'), JSON.stringify({ ruleMatching: stats, equivalentCases: messages.length, historyReadsFor100ConcurrentLookups: 1, scanBatchesFor100GreenAlerts: 0, scanBatchesFor100MessageEdits: 1 }, null, 2));
  console.log('PASS: equivalent catalog results, compiled patterns, history invalidation, owned DOM filtering, and mutation batching.', stats);
})().catch(error => { console.error(error); process.exitCode = 1; });
