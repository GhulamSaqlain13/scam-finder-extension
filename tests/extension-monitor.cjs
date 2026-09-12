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
      window.resultBatches = 0;
      window.resultPayloads = [];
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
        runtime: { onMessage: { addListener(fn) { window.runtimeListener = fn; } }, sendMessage: async message => { window.resultBatches++; window.resultPayloads.push(message); window.saved.fsd_last_result = message.results.at(-1); } },
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
    assert.equal(await page.locator("[data-fsd-warning]").locator("strong").textContent(), "High risk");
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
    const batches = await page.evaluate(() => window.resultBatches);
    await page.evaluate(() => {
      const analyze = globalThis.fsdAnalyze;
      window.messageAnalyses = 0;
      globalThis.fsdAnalyze = (text, links) => {
        if (text === "Please send your verification code.") window.messageAnalyses++;
        return analyze(text, links);
      };
    });
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 97 }));
    await page.waitForFunction(() => document.querySelectorAll("[data-fsd-warning]").length === 1);
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 96 }));
    await page.waitForFunction(() => document.querySelectorAll("[data-fsd-warning]").length === 2);
    await page.locator("[data-fsd-warning]").last().locator("button").click();
    await page.evaluate(() => document.body.append(document.createElement("span")));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 1, "DOM updates must preserve Hide");
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 30 }));
    await page.waitForFunction(() => document.querySelectorAll("[data-fsd-warning]").length === 2);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.resultBatches), batches, "Threshold updates must not persist duplicate results");
    assert.equal(await page.evaluate(() => window.messageAnalyses), 0, "Threshold updates must reuse cached message analysis");
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: false }));
    await append("Install AnyDesk and send your access code.");
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 2, "Stop disables monitoring");
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 3, "Restart scans pending messages without duplicate warnings");
    await page.clock.install();
    const oldRow = page.locator('[data-conversation-id="old"]');
    await oldRow.locator('[data-testid="message-preview"]').evaluate(node => { node.textContent = "Thanks for the delivery."; });
    await page.clock.runFor(400);
    assert.equal(await oldRow.locator('[data-fsd-flag]').count(), 1, "Risk is retained briefly after evidence disappears");
    await oldRow.evaluate(node => { node.dataset.conversationId = "replacement"; });
    await page.clock.runFor(400);
    assert.equal(await page.locator('[data-conversation-id="replacement"] [data-fsd-flag]').count(), 0, "An identity-only row change must not inherit the old flag");
    await page.locator('[data-conversation-id="replacement"]').evaluate(node => { node.dataset.conversationId = "old"; });
    await page.clock.runFor(400);
    assert.equal(await oldRow.locator('[data-fsd-flag]').count(), 1, "Returning to the original conversation restores its unexpired risk");
    await page.locator('.conversation-list-item .message-preview').evaluate(node => { node.textContent = "Thanks."; });
    await page.clock.runFor(400);
    await page.locator('.conversation-list-item a').evaluate(node => { node.href = "/inbox/replacement"; });
    await page.clock.runFor(400);
    assert.equal(await page.locator('.conversation-list-item [data-fsd-flag]').count(), 0, "Changing only the conversation link resets a reused row");
    await page.clock.fastForward(31 * 60 * 1000);
    assert.equal(await oldRow.locator('[data-fsd-flag]').count(), 0, "Old evidence expires without further DOM updates");
    assert.equal(await page.locator('[data-conversation-id="new"] [data-fsd-flag]').count(), 1, "Currently suspicious previews remain flagged after expiration");
    let linkRequests = 0;
    page.on("request", () => { linkRequests++; });
    await page.evaluate(() => {
      const node = document.createElement("div");
      node.dataset.testid = "message";
      node.id = "link-message";
      const link = document.createElement("a");
      link.textContent = "https://example.org/design";
      link.href = "https://example.org/design";
      node.append(link);
      document.querySelector("main").append(node);
    });
    await page.clock.runFor(400);
    const linkWarning = page.locator('#link-message + [data-fsd-warning]');
    assert.equal(await linkWarning.count(), 0, "Ordinary matching external links are not flagged");
    await page.locator('#link-message a').evaluate(link => { link.href = "https://destination.example/private-sender?token=private-token"; });
    await page.clock.runFor(400);
    assert.equal(await linkWarning.count(), 1, "An href-only change invalidates cached analysis");
    assert.match(await linkWarning.locator('ul').textContent(), /destination.example.*example.org/);
    await page.locator('#link-message a').evaluate(link => { link.href = "https://example.org/design"; });
    await page.clock.runFor(400);
    assert.equal(await linkWarning.count(), 0, "Correcting the destination removes the warning");
    await page.locator('#link-message').evaluate(node => {
      node.dataset.direction = "outgoing";
      node.querySelector('a').href = "https://fiverr-login.example";
    });
    await page.clock.runFor(400);
    assert.equal(await linkWarning.count(), 0, "Outgoing links are excluded");
    assert.equal(linkRequests, 0, "Link checks must not make network requests");
    const payloads = await page.evaluate(() => JSON.stringify(window.resultPayloads));
    for (const value of ["destination.example", "example.org", "private-sender", "private-token", "linkDetails"]) {
      assert.ok(!payloads.includes(value), "Link data must stay out of storage messages: " + value);
    }
    const saved = await page.evaluate(() => window.saved);
    await page.evaluate(() => {
      window.analysisCalls = 0;
      window.documentScans = 0;
      const analyze = globalThis.fsdAnalyze;
      globalThis.fsdAnalyze = (...args) => { window.analysisCalls++; return analyze(...args); };
      const query = document.querySelectorAll.bind(document);
      document.querySelectorAll = (...args) => { window.documentScans++; return query(...args); };
      const noise = document.createElement("div"); noise.id = "noise"; document.body.append(noise);
    });
    for (let i = 0; i < 10; i++) {
      await page.evaluate(i => { document.getElementById("noise").textContent = String(i); }, i);
      await page.clock.runFor(30);
    }
    await page.evaluate(() => window.runtimeListener({ type: "FSD_STATUS" }, {}, () => {}));
    assert.equal(await page.evaluate(() => window.analysisCalls), 0, "Unrelated mutations and status requests do not analyze messages or previews");
    assert.equal(await page.evaluate(() => window.documentScans), 0, "Incremental updates never query the whole document");
    await page.evaluate(() => {
      const node = document.createElement("div"); node.id = "busy-message"; node.dataset.testid = "message";
      node.textContent = "Send your password."; document.querySelector("main").append(node);
    });
    for (let i = 0; i < 8; i++) {
      await page.evaluate(i => { document.getElementById("busy-message").firstChild.data = "Send your password. " + i; }, i);
      await page.clock.runFor(30);
    }
    assert.ok(await page.evaluate(() => window.analysisCalls > 0), "Continuous changes must be processed before the stream stops");
    assert.equal(await page.locator('#busy-message + [data-fsd-warning]').count(), 1);
    await page.clock.runFor(300);
    const calls = await page.evaluate(() => window.analysisCalls);
    await page.clock.runFor(500);
    assert.equal(await page.evaluate(() => window.analysisCalls), calls, "Injected warnings must not cause rescans");
    await page.locator('#busy-message').evaluate(node => node.remove());
    await page.clock.runFor(300);
    assert.equal(await page.evaluate(() => window.documentScans), 0);
    assert.equal(JSON.stringify(saved).includes("password"), false, "No message text persisted");
    console.log("PASS: stopped by default, Run, incoming alerts, score, outgoing filter, safe advice, deduplication, Stop, restart, metadata-only storage.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


