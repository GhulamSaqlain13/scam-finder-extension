/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser fixture runner. */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<main><div data-testid="message" data-message-id="1">Send me your password immediately.</div></main>',
    );
    await page.evaluate(() => {
      const inbox = document.createElement("nav");
      inbox.innerHTML =
        '<div data-testid="conversation-item" data-conversation-id="old"><span>Existing chat</span><p data-testid="message-preview">Send me your password.</p></div><div data-testid="conversation-item" data-conversation-id="new"><span>Another chat</span><p data-testid="message-preview">Thanks for the delivery.</p></div>';
      document.body.prepend(inbox);
      const nested = document.createElement("div");
      nested.className = "conversation-list-item";
      nested.innerHTML =
        '<a href="/inbox/nested">Nested link chat</a><p class="message-preview">Send your password immediately.</p>';
      inbox.append(nested);
      const fallbackRow = document.createElement("div");
      fallbackRow.className = "conversation-list-item";
      fallbackRow.innerHTML =
        '<a href="/inbox/preview-scam">Preview fallback</a><span>Please verify your payment here.</span>';
      inbox.append(fallbackRow);
      const removedRow = document.createElement("div");
      removedRow.className = "conversation-list-item";
      removedRow.innerHTML =
        '<a href="/inbox/removed-account">Removed account</a><span>This user can no longer be contacted.</span>';
      inbox.append(removedRow);
    });
    await page.evaluate(() => {
      window.saved = {};
      window.resultBatches = 0;
      window.resultPayloads = [];
      window.changeListeners = [];
      window.pendingRiskLookups = [];
      window.holdRiskLookups = true;
      window.chrome = {
        storage: {
          local: {
            get: async () => ({ ...window.saved }),
            set: async (values) => {
              Object.assign(window.saved, values);
              for (const fn of window.changeListeners)
                fn(
                  Object.fromEntries(
                    Object.entries(values).map(([key, value]) => [
                      key,
                      { newValue: value },
                    ]),
                  ),
                  "local",
                );
            },
          },
          onChanged: { addListener: (fn) => window.changeListeners.push(fn) },
        },
        runtime: {
          onMessage: {
            addListener(fn) {
              window.runtimeListener = fn;
            },
          },
          sendMessage: async (message) => {
            if (message.type === "FSD_HEARTBEAT") return { ok: true };
            if (message.type === "FSD_VISIBILITY")
              return { ok: true, missingCount: 0 };
            if (message.type === "FSD_CONVERSATION_RISK" && !message.scores && window.holdRiskLookups)
              return new Promise(resolve => window.pendingRiskLookups.push(resolve));
            if (message.type === "FSD_CONVERSATION_RISK")
              return { ok: true, scores: {} };
            window.resultBatches++;
            window.resultPayloads.push(message);
            window.saved.fsd_last_result = message.results.at(-1);
            return { ok: true };
          },
        },
      };
    });
    await page.addScriptTag({ path: path.resolve("extension/analyzer.js") });
    await page.addScriptTag({
      path: path.resolve("extension/link-scanner.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/sensitive-information.js"),
    });
    await page.addScriptTag({ path: path.resolve("extension/draft-guard.js") });
    await page.addScriptTag({
      path: path.resolve("extension/message-detector.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/message-extractor.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/conversation-detector.js"),
    });
    const extracted = await page.evaluate(() => {
      const conversation = document.createElement("div");
      conversation.dataset.conversationId = "private-conversation";
      conversation.innerHTML =
        '<div data-message-id="msg_123" data-sender="private-sender"><span data-testid="message-sender">private-sender</span><div data-testid="message-text">Please review<br>this <a href="https://example.com/reference">reference</a></div><time datetime="2026-09-12T17:00:00+05:00">5 PM</time></div>';
      document.body.append(conversation);
      const node = conversation.firstChild;
      const first = globalThis.fsdMessageExtractor.extract(node);
      const second = globalThis.fsdMessageExtractor.extract(node);
      node.removeAttribute("data-message-id");
      node.dataset.testid = "message";
      node.removeAttribute("data-sender");
      node.querySelector("span").remove();
      node.querySelector("time").setAttribute("datetime", "5 PM");
      const fallback = globalThis.fsdMessageExtractor.extract(node);
      const again = globalThis.fsdMessageExtractor.extract(node);
      conversation.dataset.conversationId = "different-conversation";
      const recycled = globalThis.fsdMessageExtractor.extract(node);
      const clone = node.cloneNode(true);
      conversation.append(clone);
      const cloneResult = globalThis.fsdMessageExtractor.extract(clone);
      conversation.remove();
      return { first, second, fallback, again, recycled, cloneResult };
    });
    assert.equal(extracted.first.id, "msg_123");
    assert.equal(extracted.first.sender, "private-sender");
    assert.equal(extracted.first.text, "Please review\nthis reference");
    assert.deepEqual(extracted.first.links, ["https://example.com/reference"]);
    assert.equal(extracted.first.timestamp, "2026-09-12T12:00:00.000Z");
    assert.equal(extracted.first.conversationId, "private-conversation");
    assert.ok(Number.isFinite(Date.parse(extracted.first.detectedAt)));
    assert.deepEqual(
      extracted.first,
      extracted.second,
      "Unchanged extraction preserves identity and first-detected time",
    );
    assert.equal(extracted.fallback.sender, null);
    assert.equal(extracted.fallback.timestamp, null);
    assert.match(extracted.fallback.id, /^msg_[a-f0-9]{32}$/);
    assert.equal(extracted.fallback.id, extracted.again.id);
    assert.notEqual(
      extracted.fallback.id,
      extracted.recycled.id,
      "Reused DOM nodes in different conversations get a new fallback ID",
    );
    assert.equal(
      extracted.recycled.id,
      extracted.cloneResult.id,
      "Fingerprint IDs are stable across equivalent DOM nodes",
    );
    const understood = await page.evaluate(() =>
      globalThis.fsdConversationDetector.inspect(),
    );
    assert.equal(understood.selected, false);
    assert.equal(understood.foundConversationArea, true);
    const extractionCases = await page.evaluate(() => {
      const wrapper = document.createElement("section");
      wrapper.innerHTML = '<div data-testid="message">You must send me your password.</div><div data-testid="message"><a href="https://fiverr-login.example"><img alt="Verify account"></a></div><div data-testid="message"><span data-testid="sender-name">You</span>Send your password.</div><div data-testid="message"><p>Send your OTP.</p></div>';
      document.querySelector("main").append(wrapper);
      const messages = [...wrapper.children].map(node => Boolean(globalThis.fsdMessageExtractor.extract(node)));
      const nested = globalThis.fsdMessageDetector.isMessage(wrapper.lastChild.firstChild);
      wrapper.remove();
      return { messages, nested };
    });
    assert.deepEqual(extractionCases.messages, [true, true, false, true], "Incoming You text and image-only links are checked; sender metadata excludes own messages");
    assert.equal(extractionCases.nested, false, "Nested paragraphs must not count the same native bubble twice");
    await page.addScriptTag({
      path: path.resolve("extension/content-script.js"),
    });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-conversation-id="old"] [data-fsd-flag]').getAttribute('data-state'), 'checked',
      'Risky previews render before background lookups complete');
    assert.equal(await page.locator('[data-conversation-id="new"] [data-fsd-flag]').getAttribute('data-score'), 'null',
      'Benign previews remain unknown without sufficient message data');
    await page.evaluate(() => {
      window.holdRiskLookups = false;
      window.pendingRiskLookups.splice(0).forEach(resolve => resolve({ ok: true, scores: {} }));
    });
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      1,
      "Starts monitoring automatically",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const fixtures = document.createElement('aside');
      fixtures.id = 'preview-regression';
      fixtures.innerHTML = '<div class="conversation-list-item" data-conversation-id="fallback-safe"><a href="/inbox/fallback-safe">Buyer</a><span>Thanks for the delivery.</span></div><div class="contact ce05uz8" data-conversation-id="contact-safe"><div class="user-info"><p>Buyer Two</p><p>Thanks for the logo.</p></div></div><div class="conversation-list-item" data-conversation-id="loading-preview" aria-busy="true"><a href="/inbox/loading-preview">Buyer Three</a><span>Loading...</span></div>';
      document.body.append(fixtures);
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-conversation-id="fallback-safe"] [data-fsd-flag]')?.dataset.state === 'unavailable' &&
      document.querySelector('[data-conversation-id="contact-safe"] [data-fsd-flag]')?.dataset.state === 'unavailable');
    assert.equal(await page.locator('[data-conversation-id="loading-preview"] [data-fsd-flag]').getAttribute('data-state'), 'checking');
    await page.locator('[data-conversation-id="loading-preview"]').evaluate(node => {
      node.removeAttribute('aria-busy');
      node.querySelector(':scope > span').firstChild.data = 'Thanks for the delivery.';
    });
    await page.waitForFunction(() => document.querySelector('[data-conversation-id="loading-preview"] [data-fsd-flag]')?.dataset.state === 'unavailable',
      null, { timeout: 1500 });
    await page.evaluate(() => {
      const row = document.createElement('div');
      row.className = 'contact ce05uz8';
      row.dataset.conversationId = 'no-preview';
      row.innerHTML = '<span class="avatar">A</span><div class="user-info"><p>Buyer Name</p></div><time>4 weeks</time>';
      document.querySelector('#preview-regression').append(row);
    });
    await page.waitForFunction(() => document.querySelector('[data-conversation-id="no-preview"] [data-fsd-flag]')?.dataset.state === 'unavailable');
    await page.locator('[data-conversation-id="no-preview"] .user-info').evaluate(node => {
      const preview = document.createElement('p');
      preview.textContent = 'Send your password immediately.';
      node.append(preview);
    });
    await page.waitForFunction(() => Number(document.querySelector('[data-conversation-id="no-preview"] [data-fsd-flag]')?.dataset.score) >= 61);
    await page.locator('[data-conversation-id="fallback-safe"] > span').evaluate(node => { node.textContent = 'Send your password immediately.'; });
    await page.waitForFunction(() => Number(document.querySelector('[data-conversation-id="fallback-safe"] [data-fsd-flag]')?.dataset.score) >= 61);
    await page.locator('#preview-regression').evaluate(node => node.remove());
    await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 1);
    assert.equal(
      await page
        .locator('[data-conversation-id="old"] [data-fsd-flag]')
        .count(),
      1,
      "Existing suspicious preview gets a flag",
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "Benign preview gets an unknown status flag",
    );
    await page
      .locator('[data-conversation-id="new"] [data-testid="message-preview"]')
      .evaluate((node) => {
        node.textContent = "Send your verification code immediately.";
      });
    await page.waitForTimeout(300);
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "New suspicious preview gets a flag",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/preview-scam"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Already visible suspicious chat rows are flagged",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/removed-account"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Fiverr unavailable contact rows are flagged",
    );
    assert.equal(
      await page.locator("[data-fsd-warning]").locator("strong").textContent(),
      "High Risk message",
    );
    const firstWarning = page.locator("[data-fsd-warning]").first();
    assert.equal(await firstWarning.locator("#details").isVisible(), false);
    assert.match(
      await firstWarning.locator("section").textContent(),
      /This message may be a phishing attempt/,
    );
    assert.match(
      await firstWarning.locator("section").textContent(),
      /Reasons:/,
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="old"] [data-fsd-flag]')
        .getByRole("img")
        .getAttribute("aria-label"),
      "High Risk conversation status.",
    );
    await fs.promises.mkdir(path.resolve("test-results"), { recursive: true });
    await firstWarning.screenshot({
      path: path.resolve("test-results/warning-desktop.png"),
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await firstWarning
      .getByRole("button", { name: "View details", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await firstWarning.locator("#details").isVisible(),
      true,
      "Details can be opened by keyboard",
    );
    await firstWarning.screenshot({
      path: path.resolve("test-results/warning-mobile.png"),
    });
    assert.equal(
      await firstWarning.evaluate((node) => {
        const section = node.shadowRoot.querySelector("section");
        return (
          section.scrollWidth <= section.clientWidth &&
          node.getBoundingClientRect().right <= innerWidth
        );
      }),
      true,
      "Expanded warning must fit a narrow viewport",
    );
    await firstWarning
      .getByRole("button", { name: "Hide details", exact: true })
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
    const append = async (text, outgoing = false) =>
      page.evaluate(
        ({ text, outgoing }) => {
          const node = document.createElement("div");
          node.dataset.testid = "message";
          if (outgoing) node.dataset.direction = "outgoing";
          node.textContent = text;
          document.querySelector("main").append(node);
        },
        { text, outgoing },
      );
    await append("Please send your verification code.");
    await append("Send me your password.", true);
    await append("Do not share your password or verification code.");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "New incoming only; safe advice and outgoing ignored",
    );
    await page.evaluate(() =>
      document.body.append(document.createElement("span")),
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "No duplicates",
    );
    assert.equal(
      await page.locator('a[href="/inbox/nested"] [data-fsd-flag]').count(),
      1,
      "Nested links retain their conversation status flag",
    );
    assert.equal(
      await page.locator("[data-fsd-flag]").count(),
      5,
      "Flags do not duplicate on DOM updates",
    );
    const batches = await page.evaluate(() => window.resultBatches);
    await page.evaluate(() => {
      const analyze = globalThis.fsdAnalyze;
      window.messageAnalyses = 0;
      globalThis.fsdAnalyze = (text, links) => {
        if (text === "Please send your verification code.")
          window.messageAnalyses++;
        return analyze(text, links);
      };
    });
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 97 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 1,
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 96 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    await page
      .locator("[data-fsd-warning]")
      .last()
      .getByRole("button", { name: "Dismiss", exact: true })
      .click();
    await page.evaluate(() =>
      document.body.append(document.createElement("span")),
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      1,
      "DOM updates must preserve Hide",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 30 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.resultBatches),
      batches,
      "Threshold updates must not persist duplicate results",
    );
    assert.equal(
      await page.evaluate(() => window.messageAnalyses),
      0,
      "Threshold updates must reuse cached message analysis",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: false }));
    await append("Install AnyDesk and send your access code.");
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "Stop disables monitoring",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      3,
      "Restart scans pending messages without duplicate warnings",
    );
    await page.clock.install();
    const oldRow = page.locator('[data-conversation-id="old"]');
    await oldRow.locator('[data-testid="message-preview"]').evaluate((node) => {
      node.textContent = "Thanks for the delivery.";
    });
    await page.clock.runFor(400);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Risk is retained briefly after evidence disappears",
    );
    await oldRow.evaluate((node) => {
      node.dataset.conversationId = "replacement";
    });
    await page.clock.runFor(400);
    assert.equal(
      await page
        .locator('[data-conversation-id="replacement"] [data-fsd-flag]')
        .count(),
      1,
      "An identity-only row change gets a fresh safe flag",
    );
    await page
      .locator('[data-conversation-id="replacement"]')
      .evaluate((node) => {
        node.dataset.conversationId = "old";
      });
    await page.clock.runFor(400);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Returning to the original conversation restores its unexpired risk",
    );
    await page
      .locator('a[href="/inbox/nested"] >> xpath=../p')
      .evaluate((node) => {
        node.textContent = "Thanks.";
      });
    await page.clock.runFor(400);
    await page.locator('a[href="/inbox/nested"]').evaluate((node) => {
      node.href = "/inbox/replacement";
    });
    await page.clock.runFor(400);
    assert.equal(
      await page.evaluate(
        () =>
          document
            .querySelector('a[href="/inbox/replacement"]')
            .parentElement.querySelectorAll("[data-fsd-flag]").length,
      ),
      1,
      "Changing only the conversation link resets a reused row to safe",
    );
    await page.clock.fastForward(31 * 60 * 1000);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Old evidence expires to a safe flag without further DOM updates",
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "Currently suspicious previews remain flagged after expiration",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/removed-account"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Unavailable contact rows stay flagged while visible",
    );
    let linkRequests = 0;
    page.on("request", () => {
      linkRequests++;
    });
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
    const linkWarning = page.locator("#link-message + [data-fsd-warning]");
    assert.equal(
      await linkWarning.count(),
      0,
      "Ordinary matching external links are not flagged",
    );
    await page.locator("#link-message a").evaluate((link) => {
      link.href =
        "https://destination.example/private-sender?token=private-token";
    });
    await page.clock.runFor(400);
    assert.equal(
      await linkWarning.count(),
      1,
      "An href-only change invalidates cached analysis",
    );
    await linkWarning
      .getByRole("button", { name: "View details", exact: true })
      .click();
    assert.equal(
      await linkWarning
        .getByRole("button", { name: "Hide details", exact: true })
        .getAttribute("aria-expanded"),
      "true",
    );
    assert.match(
      await linkWarning.locator("#details ul").textContent(),
      /destination.example.*example.org/,
    );
    await linkWarning
      .getByRole("button", { name: "Hide details", exact: true })
      .click();
    assert.equal(await linkWarning.locator("#details").isVisible(), false);
    await page.locator("#link-message a").evaluate((link) => {
      link.href = "https://example.org/design";
    });
    await page.clock.runFor(400);
    assert.equal(
      await linkWarning.count(),
      0,
      "Correcting the destination removes the warning",
    );
    await page.locator("#link-message").evaluate((node) => {
      node.dataset.direction = "outgoing";
      node.querySelector("a").href = "https://fiverr-login.example";
    });
    await page.clock.runFor(400);
    assert.equal(await linkWarning.count(), 0, "Outgoing links are excluded");
    assert.equal(linkRequests, 0, "Link checks must not make network requests");
    const payloads = await page.evaluate(() =>
      JSON.stringify(window.resultPayloads.map((batch) => batch.results)),
    );
    assert.equal(
      await page.evaluate(() =>
        window.resultPayloads
          .flatMap((batch) => batch.evidence || [])
          .every((record) => record.riskScore >= 61),
      ),
      true,
    );
    for (const value of [
      "destination.example",
      "example.org",
      "private-sender",
      "private-token",
      "linkDetails",
      "conversationId",
      "detectedAt",
      '"sender"',
      '"id"',
    ]) {
      assert.ok(
        !payloads.includes(value),
        "Link data must stay out of storage messages: " + value,
      );
    }
    const saved = await page.evaluate(() => window.saved);
    await page.evaluate(() => {
      window.analysisCalls = 0;
      window.documentScans = 0;
      const analyze = globalThis.fsdAnalyze;
      globalThis.fsdAnalyze = (...args) => {
        window.analysisCalls++;
        return analyze(...args);
      };
      const query = document.querySelectorAll.bind(document);
      document.querySelectorAll = (...args) => {
        window.documentScans++;
        return query(...args);
      };
      const noise = document.createElement("div");
      noise.id = "noise";
      document.body.append(noise);
    });
    for (let i = 0; i < 10; i++) {
      await page.evaluate((i) => {
        document.getElementById("noise").textContent = String(i);
      }, i);
      await page.clock.runFor(30);
    }
    await page.evaluate(() =>
      window.runtimeListener({ type: "FSD_STATUS" }, {}, () => {}),
    );
    assert.equal(
      await page.evaluate(() => window.analysisCalls),
      0,
      "Unrelated mutations and status requests do not analyze messages or previews",
    );
    assert.equal(
      await page.evaluate(() => window.documentScans),
      0,
      "Incremental updates never query the whole document",
    );
    await page.evaluate(() => {
      const node = document.createElement("div");
      node.id = "busy-message";
      node.dataset.testid = "message";
      node.textContent = "Send your password.";
      document.querySelector("main").append(node);
    });
    for (let i = 0; i < 8; i++) {
      await page.evaluate((i) => {
        document.getElementById("busy-message").firstChild.data =
          "Send your password. " + i;
      }, i);
      await page.clock.runFor(30);
    }
    assert.ok(
      await page.evaluate(() => window.analysisCalls > 0),
      "Continuous changes must be processed before the stream stops",
    );
    assert.equal(
      await page.locator("#busy-message + [data-fsd-warning]").count(),
      1,
    );
    await page.clock.runFor(300);
    const calls = await page.evaluate(() => window.analysisCalls);
    await page.clock.runFor(500);
    assert.equal(
      await page.evaluate(() => window.analysisCalls),
      calls,
      "Injected warnings must not cause rescans",
    );
    await page.locator("#busy-message").evaluate((node) => node.remove());
    await page.clock.runFor(300);
    assert.equal(await page.evaluate(() => window.documentScans), 0);
    await page.evaluate(() => {
      const wrapper = document.createElement("div");
      wrapper.id = "delayed-wrapper";
      wrapper.dataset.messageId = "delayed";
      wrapper.textContent = "Send your password.";
      const fragment = document.createDocumentFragment();
      fragment.append(wrapper);
      document.querySelector("main").append(fragment);
    });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper + [data-fsd-warning]").count(),
      1,
    );
    await page.locator("#delayed-wrapper").evaluate((node) => {
      const inner = document.createElement("div");
      inner.dataset.testid = "message-bubble";
      inner.textContent = "Send your password.";
      node.replaceChildren(inner);
    });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper + [data-fsd-warning]").count(),
      0,
      "A wrapper stops being a message when a nested bubble arrives",
    );
    assert.equal(
      await page.locator("#delayed-wrapper [data-fsd-warning]").count(),
      1,
    );
    await page
      .locator('#delayed-wrapper [data-testid="message-bubble"]')
      .evaluate((node) => {
        node.firstChild.data = "Thanks for your work.";
      });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper [data-fsd-warning]").count(),
      0,
      "Text-node edits update the extracted message",
    );
    await page.locator("#delayed-wrapper").evaluate((node) => node.remove());
    await page.clock.runFor(200);
    assert.equal(
      JSON.stringify(saved).includes("password"),
      false,
      "No message text persisted",
    );
    console.log(
      "PASS: stopped by default, Run, incoming alerts, score, outgoing filter, safe advice, deduplication, Stop, restart, metadata-only storage.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
