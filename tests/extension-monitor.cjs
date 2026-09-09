/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser fixture runner. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main><div data-testid="message" data-message-id="1">Send me your password immediately.</div></main>');
    await page.evaluate(() => {
      const inbox = document.createElement("nav");
      inbox.innerHTML = '<div data-testid="conversation-item" data-conversation-id="old"><span>Existing chat</span><p data-testid="message-preview">Send me your password.</p></div><div data-testid="conversation-item" data-conversation-id="new"><span>Another chat</span><p data-testid="message-preview">Thanks for the delivery.</p></div>';
      document.body.prepend(inbox);
      const nested = document.createElement("div");
      nested.className = "conversation-list-item";
      nested.innerHTML = '<a href="/inbox/nested">Nested link chat</a><p class="message-preview">Send your password immediately.</p>';
      inbox.append(nested);
    });
    await page.evaluate(() => {
      window.saved = {};
      window.changeListeners = [];
      window.chrome = {
        storage: {
          local: {
            get: async () => ({ ...window.saved }),
            set: async values => {
              Object.assign(window.saved, values);
              for (const fn of window.changeListeners) fn(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])), "local");
            },
          },
          onChanged: { addListener: fn => window.changeListeners.push(fn) },
        },
        runtime: { onMessage: { addListener() {} }, sendMessage: async message => { window.saved.fsd_last_result = message.results.at(-1); } },
      };
    });
    await page.addScriptTag({ path: path.resolve("extension/analyzer.js") });
    await page.addScriptTag({ path: path.resolve("extension/content-script.js") });
    await page.waitForTimeout(200);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 0, "Must start stopped");
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 1);
    assert.equal(await page.locator('[data-conversation-id="old"] [data-fsd-flag]').count(), 1, "Existing suspicious preview gets a flag");
    assert.equal(await page.locator('[data-conversation-id="new"] [data-fsd-flag]').count(), 0, "Safe preview is not flagged");
    await page.locator('[data-conversation-id="new"] [data-testid="message-preview"]').evaluate(node => { node.textContent = "Send your verification code immediately."; });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-conversation-id="new"] [data-fsd-flag]').count(), 1, "New suspicious preview gets a flag");
    assert.match(await page.locator("[data-fsd-warning]").locator("strong").textContent(), /Risk 99%/);
    const append = async (text, outgoing = false) => page.evaluate(({ text, outgoing }) => {
      const node = document.createElement("div");
      node.dataset.testid = "message";
      if (outgoing) node.dataset.direction = "outgoing";
      node.textContent = text;
      document.querySelector("main").append(node);
    }, { text, outgoing });
    await append("Please send your verification code.");
    await append("Send me your password.", true);
    await append("Do not share your password or verification code.");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 2, "New incoming only; safe advice and outgoing ignored");
    await page.evaluate(() => document.body.append(document.createElement("span")));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 2, "No duplicates");
    assert.equal(await page.locator('.conversation-list-item > [data-fsd-flag]').count(), 1, "Nested links must not discard the wrapper preview");
    assert.equal(await page.locator("[data-fsd-flag]").count(), 3, "Flags do not duplicate on DOM updates");
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: false }));
    await append("Install AnyDesk and send your access code.");
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 2, "Stop disables monitoring");
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 3, "Restart scans pending messages without duplicate warnings");
    const saved = await page.evaluate(() => window.saved);
    assert.equal(JSON.stringify(saved).includes("password"), false, "No message text persisted");
    console.log("PASS: stopped by default, Run, incoming alerts, score, outgoing filter, safe advice, deduplication, Stop, restart, metadata-only storage.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


