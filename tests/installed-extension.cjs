const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scam-finder-test-"));
  const root = path.resolve(__dirname, "..");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    const id = new URL(worker.url()).host;
    const protectedIds = await worker.evaluate(async () => ({ conversation: await fsdMetadata.reference('/inbox/test'), first: await fsdMetadata.reference('first') }));
    await context.route("https://www.fiverr.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body:
          '<html><body><main><div data-testid="message" data-message-id="first" data-sender="test-sender">Send me your password immediately. <a href="https://example.org/reference">Reference</a></div>' +
          '<div data-testid="message">Thanks for the logo.</div>'.repeat(105) +
          "</main></body></html>",
      }),
    );
    const chat = await context.newPage();
    await chat.goto("https://www.fiverr.com/inbox/test");
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/extension/home.html");
    await popup.waitForFunction(() => !document.getElementById("run").disabled);
    const popupSize = () =>
      popup.evaluate(() => ({
        width: document.documentElement.getBoundingClientRect().width,
        height: document.documentElement.getBoundingClientRect().height,
      }));
    assert.deepEqual(await popupSize(), { width: 392, height: 600 });
    const tabId = await popup.evaluate(
      async () =>
        (await chrome.tabs.query({ url: "https://www.fiverr.com/*" }))[0].id,
    );
    await popup.evaluate(
      (id) => chrome.tabs.update(id, { active: true }),
      tabId,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    assert.equal(
      await popup.locator("#run").textContent(),
      "Stop protection",
      "Protection starts automatically",
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("conversation-state").textContent ===
        "Chat found",
    );
    const conversationSummary = await popup
      .locator("#conversation-summary")
      .textContent();
    assert.match(conversationSummary, /Chat with/);
    assert.match(conversationSummary, /Messages from them/);
    assert.doesNotMatch(conversationSummary, /\/inbox\//);
    await chat.locator("[data-fsd-warning]").waitFor();
    assert.equal(
      await chat.locator("[data-fsd-warning]").locator("strong").textContent(),
      "High Risk message",
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /This message may be a phishing attempt/,
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /Reasons:/,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("risk").textContent === "Safe" &&
        document.getElementById("highest-risk").textContent === "High Risk",
    );
    assert.match(
      await popup.locator("#highest-signals").textContent(),
      /Do not share passwords or verification codes/,
    );
    assert.match(
      await popup.locator("#highest-categories").textContent(),
      /Sensitive data request/,
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /Sensitive data request/,
    );
    await chat.evaluate(() => {
      const editor = document.createElement("textarea");
      editor.id = "draft-editor";
      document.body.append(editor);
    });
    await chat.locator("#draft-editor").fill("OTP: 938271");
    await chat.locator("[data-fsd-draft-warning]").waitFor();
    assert.match(
      await chat
        .locator("[data-fsd-draft-warning]")
        .locator("section")
        .textContent(),
      /Never share authentication codes/,
    );
    const stored = await popup.evaluate(async () =>
      JSON.stringify(await chrome.storage.local.get(null)),
    );
    assert.ok(!stored.includes("938271"), "Draft contents never enter storage");
    await chat.locator("#draft-editor").fill("Thanks for your order.");
    assert.equal(await chat.locator("[data-fsd-draft-warning]").count(), 0);
    await chat.locator("#draft-editor").evaluate((node) => node.remove());
    await chat.evaluate(() => {
      const node = document.createElement("div");
      node.dataset.testid = "message";
      node.textContent = "Looks good.";
      document.querySelector("main").append(node);
    });
    await popup.waitForFunction(async () => {
      const data = await chrome.storage.local.get([
        "fsd_last_result",
        "fsd_highest_result",
      ]);
      return (
        data.fsd_last_result?.score === 0 &&
        data.fsd_highest_result?.score === 100 &&
        data.fsd_last_result.checkedAt > data.fsd_highest_result.checkedAt
      );
    });
    const beforeFallbackCount = await popup.evaluate(
      (tabId) =>
        chrome.tabs
          .sendMessage(tabId, { type: "FSD_STATUS" })
          .then((response) => response.messageCount),
      tabId,
    );
    await chat.evaluate(() => {
      const row = document.createElement("section");
      row.setAttribute("role", "listitem");
      row.innerHTML =
        "<strong>hinda_metropoli</strong><p>Hi, your experience really impressed me - interested in discussing further.</p>";
      document.querySelector("main").append(row);
    });
    await popup.waitForFunction(
      async ({ tabId, beforeFallbackCount }) => {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "FSD_STATUS",
        });
        return response.messageCount > beforeFallbackCount;
      },
      { tabId, beforeFallbackCount },
    );
    assert.deepEqual(
      await popupSize(),
      { width: 392, height: 600 },
      "Scan results must not resize the popup document",
    );
    assert.equal(
      await popup.evaluate(
        () => document.body.scrollWidth > document.body.clientWidth,
      ),
      false,
      "Popup must not overflow horizontally",
    );
    await chat.evaluate(() => {
      const row = document.createElement("div");
      row.className = "ce05uz8 contact";
      row.innerHTML =
        '<a href="/inbox/test"><p>test-sender</p><span>Me: Thank you</span></a>';
      document.querySelector("main").append(row);
    });
    await chat.locator(".ce05uz8.contact [data-fsd-flag]").waitFor();
    assert.equal(
      await chat
        .locator(".ce05uz8.contact [data-fsd-flag]")
        .getByRole("img")
        .getAttribute("aria-label"),
      "High Risk conversation status.",
    );
    await fs.promises.mkdir(path.join(root, "test-results"), {
      recursive: true,
    });
    await popup.screenshot({
      path: path.join(root, "test-results/status-monitoring.png"),
    });
    await chat.evaluate(() => {
      document.querySelector("main").hidden = true;
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "No incoming messages detected",
    );
    assert.match(
      await popup.locator("#notice").textContent(),
      /only your own replies or Fiverr system text/,
    );
    assert.equal(
      await popup.evaluate(() => document.body.dataset.monitoring),
      "false",
    );
    await chat.evaluate(() => {
      document.querySelector("main").hidden = false;
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await chat.evaluate(() => {
      window.originalMain = [...document.querySelector("main").childNodes];
      document.querySelector("main").innerHTML =
        '<div data-testid="message" data-direction="outgoing">Thanks.</div><div data-testid="message-preview"><div data-testid="message">Preview only</div></div>';
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "No incoming messages detected",
    );
    await chat.evaluate(() => {
      document.querySelector("main").innerHTML =
        "<p>Fiverr Only visible to you</p><p>cosmicpuma635 can no longer be contacted.</p>";
    });
    await popup.waitForFunction(
      () => document.getElementById("risk").textContent === "High Risk",
    );
    assert.match(
      await popup.locator("#categories").textContent(),
      /Fiverr contact unavailable/,
    );
    assert.match(
      await popup.locator("#conversation-summary").textContent(),
      /Fiverr notices/,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/inbox");
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Select a Fiverr conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/categories/graphics-design");
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Open a Fiverr conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/inbox/test");
      document.querySelector("main").replaceChildren(...window.originalMain);
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    const other = await context.newPage();
    await other.goto("about:blank");
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Open a Fiverr conversation",
    );
    await popup.evaluate(
      (id) => chrome.tabs.update(id, { active: true }),
      tabId,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await other.close();
    await popup.close(); // Monitoring must survive closing its UI.
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Send me the verification code.";
      document.querySelector("main").append(m);
    });
    await chat.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    const settings = await context.newPage();
    await settings.goto("chrome-extension://" + id + "/extension/options.html");
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    const evidence = await settings.evaluate(() =>
      chrome.runtime.sendMessage({ type: "FSD_VAULT_LIST" }),
    );
    assert.equal(
      evidence.total,
      2,
      "Only high-risk incoming messages are captured; rescans are deduplicated",
    );
    const firstEvidence = evidence.rows.find((record) => record.id === protectedIds.first);
    assert.equal(firstEvidence.sender, undefined);
    assert.equal(firstEvidence.conversationId, protectedIds.conversation);
    assert.equal(firstEvidence.message, undefined);
    assert.equal(firstEvidence.links, undefined);
    assert.equal(firstEvidence.riskScore, 100);
    assert.ok(firstEvidence.categories.includes("ACCOUNT_VERIFICATION"));
    assert.ok(Number.isFinite(Date.parse(firstEvidence.capturedAt)));
    assert.ok(
      !JSON.stringify(evidence).includes("938271"),
      "Drafts are excluded from evidence",
    );
    const localHistory = await worker.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const readAll = (storeName) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const rows = tx.objectStore(storeName).getAll();
          rows.onsuccess = () => resolve(rows.result);
          rows.onerror = () => reject(rows.error);
        });
      const stores = Array.from(db.objectStoreNames);
      const [conversations, messages, riskEvents, evidenceRows, snapshots] =
        await Promise.all([
          readAll("conversations"),
          readAll("messages"),
          readAll("riskEvents"),
          readAll("evidence"),
          readAll("conversationSnapshots"),
        ]);
      db.close();
      return {
        stores,
        conversations,
        messages,
        riskEvents,
        evidenceRows,
        snapshots,
      };
    });
    for (const store of [
      "conversations",
      "messages",
      "riskEvents",
      "evidence",
      "conversationSnapshots",
    ])
      assert.ok(localHistory.stores.includes(store), store + " store exists");
    assert.ok(
      localHistory.conversations.some(
        (row) =>
          row.conversationId === protectedIds.conversation && row.highestRiskScore === 100,
      ),
    );
    assert.ok(
      localHistory.conversations.some(
        (row) =>
          row.conversationId === protectedIds.conversation &&
          row.conversationRiskScore === 100 &&
          row.riskLevel === "CRITICAL",
      ),
    );
    const storedMessage = localHistory.messages.find(
      (row) =>
        row.conversationId === protectedIds.conversation && row.messageId === protectedIds.first,
    );
    assert.ok(
      storedMessage &&
        storedMessage.senderType === "other" &&
        storedMessage.text === undefined && storedMessage.sender === undefined,
    );
    assert.equal(storedMessage.analysis.riskLevel, "CRITICAL");
    assert.equal(storedMessage.analysis.riskScore, 100);
    assert.ok(
      storedMessage.analysis.signals.includes(
        "Account credentials or verification code requested",
      ),
    );
    assert.ok(
      storedMessage.analysis.matches.some(
        (match) => match.ruleId === "account_credentials",
      ),
    );
    const storedRiskEvent = localHistory.riskEvents.find(
      (row) =>
        row.conversationId === protectedIds.conversation && row.messageId === protectedIds.first,
    );
    assert.ok(storedRiskEvent && storedRiskEvent.riskLevel === "CRITICAL");
    assert.ok(
      storedRiskEvent.matches.some(
        (match) => match.ruleId === "account_credentials",
      ),
    );
    assert.ok(
      localHistory.evidenceRows.some(
        (row) => row.id === protectedIds.first && row.riskScore === 100,
      ),
    );
    assert.equal(
      (await worker.evaluate(() => fsdEvidenceVault.risk(["/inbox/test"])))[
        "/inbox/test"
      ],
      100,
    );
    await worker.evaluate(() =>
      fsdEvidenceVault.missing("/inbox/test", ["first"], ["first"]),
    );
    await chat.locator('[data-message-id="first"]').evaluate((node) => {
      window.removedFirstMessage = node;
      node.remove();
    });
    await chat.locator("[data-fsd-previous]").waitFor();
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Previously flagged message is not visible/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Suspicious messages from this conversation are no longer visible on Fiverr/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Previously detected:\s*1/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Risk:\s*High Risk/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /only appears because the missing message was already suspicious/i,
    );
    assert.equal(
      await chat
        .locator("[data-fsd-previous]")
        .getByRole("button", { name: "View Evidence", exact: true })
        .count(),
      1,
    );
    const [evidenceViewer] = await Promise.all([
      context.waitForEvent("page"),
      chat
        .locator("[data-fsd-previous]")
        .getByRole("button", { name: "View Evidence", exact: true })
        .click(),
    ]);
    await evidenceViewer.waitForLoadState("domcontentloaded");
    await evidenceViewer.waitForURL(/\/extension\/options\.html/);
    await evidenceViewer.locator("#conversation-evidence").waitFor();
    await evidenceViewer.waitForFunction(
      () => !document.getElementById("conversation-evidence").hidden,
    );
    assert.match(evidenceViewer.url(), /conversation=%2Finbox%2Ftest/);
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Scam evidence/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Saved conversation/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Status: HIGH RISK/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Previously captured messages: 2/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Message content is not stored/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Risk: High Risk/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Account credentials or verification code requested/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /cannot prove Fiverr deleted a message/i,
    );
    await evidenceViewer.close();
    assert.equal(
      await chat
        .locator('[data-message-id="first"] + [data-fsd-warning]')
        .count(),
      0,
      "Removed messages lose their live warning",
    );
    await chat.evaluate(() => {
      document.querySelector("main").prepend(window.removedFirstMessage);
    });
    await chat.waitForFunction(
      () => document.querySelectorAll("[data-fsd-previous]").length === 0,
    );
    await chat
      .locator('[data-message-id="first"] + [data-fsd-warning]')
      .waitFor();
    const denied = await settings.evaluate(async (tabId) => {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          chrome.runtime
            .sendMessage({ type: "FSD_VAULT_LIST" })
            .catch(() => null),
      });
      return injection.result;
    }, tabId);
    assert.ok(!denied?.ok, "Fiverr content scripts cannot read the vault");
    await settings.reload();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    await settings.locator("#keep-history").check();
    await settings.locator("#save").click();
    await settings.waitForFunction(
      () => document.getElementById("notice").textContent === "Settings saved.",
    );
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Install AnyDesk immediately.";
      document.querySelector("main").append(m);
    });
    await settings.waitForFunction(
      () => document.getElementById("count").textContent === "1 records",
    );
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "3 records",
    );
    await settings
      .locator("#vault-records article")
      .first()
      .getByRole("button", { name: "Delete evidence", exact: true })
      .click();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    await worker.evaluate(async () => {
      const records = Array.from({ length: 30 }, (_, index) => ({
        id: "page-test-" + index,
        conversationId: "pagination",
        sender: "fixture",
        message: "Synthetic evidence " + index,
        links: [],
        riskScore: 70,
        categories: ["PAYMENT_SCAM"],
        capturedAt: new Date().toISOString(),
      }));
      await fsdEvidenceVault.save([...records, records[0]]);
      await fsdEvidenceVault.observe([
        {
          id: "safe-observed",
          conversationId: "memory",
          riskScore: 0,
          categories: [],
          seenAt: new Date().toISOString(),
        },
        {
          id: "risky-observed",
          conversationId: "memory",
          riskScore: 90,
          categories: ["PHISHING"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-1",
          conversationId: "cumulative",
          riskScore: 5,
          categories: ["COERCION"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-2",
          conversationId: "cumulative",
          riskScore: 20,
          categories: ["EXTERNAL_COMMUNICATION"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-3",
          conversationId: "cumulative",
          riskScore: 30,
          categories: ["PAYMENT_SCAM"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-4",
          conversationId: "cumulative",
          riskScore: 35,
          categories: ["PAYMENT_SCAM"],
          seenAt: new Date().toISOString(),
        },
      ]);
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("conversationSnapshots", "readwrite");
          tx.objectStore("conversationSnapshots").delete("memory");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      });
      const initialMissing = await fsdEvidenceVault.missing(
        "memory",
        ["safe-observed", "risky-observed"],
        ["safe-observed", "risky-observed"],
      );
      if (initialMissing.missingCount !== 0)
        throw new Error(
          "First conversation snapshot should not report missing messages",
        );
      const missing = await fsdEvidenceVault.missing(
        "memory",
        ["safe-observed"],
        ["safe-observed", "risky-observed"],
      );
      if (
        missing.suspiciousMissingCount !== 1 ||
        missing.ignoredMissingCount !== 0 ||
        missing.maxRisk !== 90 ||
        missing.suspiciousMissingIds[0] !== await fsdMetadata.reference("risky-observed")
      )
        throw new Error(
          "Conversation memory did not detect missing suspicious state",
        );
      await fsdEvidenceVault.observe([
        {
          id: "safe-removed",
          conversationId: "safe-missing",
          riskScore: 0,
          categories: [],
          seenAt: new Date().toISOString(),
        },
        {
          id: "still-visible",
          conversationId: "safe-missing",
          riskScore: 90,
          categories: ["PHISHING"],
          seenAt: new Date().toISOString(),
        },
      ]);
      await fsdEvidenceVault.missing(
        "safe-missing",
        ["safe-removed", "still-visible"],
        ["safe-removed", "still-visible"],
      );
      const ignored = await fsdEvidenceVault.missing(
        "safe-missing",
        ["still-visible"],
        ["safe-removed", "still-visible"],
      );
      if (
        ignored.suspiciousMissingCount !== 0 ||
        ignored.ignoredMissingCount !== 1
      ) {
        throw new Error("Safe disappeared messages should be ignored");
      }
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const cumulativeKey = await fsdMetadata.reference("cumulative");
      const conversation = await new Promise((resolve, reject) => {
        const request = db
          .transaction("conversations", "readonly")
          .objectStore("conversations")
          .get(cumulativeKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (
        conversation.highestRiskScore !== 35 ||
        conversation.conversationRiskScore !== 63 ||
        conversation.riskLevel !== "HIGH"
      ) {
        throw new Error("Cumulative conversation risk was not saved as HIGH");
      }
    });
    await settings.locator("#vault-refresh").click();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "32 records",
    );
    assert.equal(await settings.locator("#vault-records article").count(), 25);
    await settings.locator("#vault-next").click();
    await settings.waitForFunction(
      () => document.querySelectorAll("#vault-records article").length === 7,
    );
    await settings.locator("#vault-prev").click();
    await settings.waitForFunction(
      () => document.querySelectorAll("#vault-records article").length === 25,
    );
    const tester = await context.newPage();
    await tester.goto("chrome-extension://" + id + "/extension/tester.html");
    await tester.locator("#message").fill("Send me your password immediately.");
    await tester.locator("#tester > button").click();
    assert.equal(await tester.locator("#risk").textContent(), "High Risk");
    assert.match(
      await tester.locator("#categories").textContent(),
      /Sensitive data request/,
    );
    await tester.locator("#message").fill("Please pay outside Fiverr.");
    assert.equal(await tester.locator("#categories").textContent(), "");
    await tester.locator("#tester > button").click();
    assert.equal(
      await tester.locator("#categories").textContent(),
      "Possible payment scam",
    );
    assert.equal(
      await settings.locator("#history article strong").textContent(),
      "High Risk",
    );
    await settings.locator("#clear").click();
    await settings.waitForFunction(
      () => document.getElementById("count").textContent === "0 records",
    );
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "0 records",
    );
    const popup2 = await context.newPage();
    await popup2.goto("chrome-extension://" + id + "/extension/home.html");
    await popup2.waitForFunction(
      () => !document.getElementById("run").disabled,
    );
    assert.equal(
      await popup2.locator("#highest-risk").textContent(),
      "No messages checked",
    );
    assert.equal(
      await popup2.locator("#risk").textContent(),
      "No messages checked",
    );
    await popup2.locator("#run").click();
    await popup2.waitForFunction(
      () => document.getElementById("status").textContent === "Stopped",
    );
    const count = await chat.locator("[data-fsd-warning]").count();
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Enter your card number.";
      document.querySelector("main").append(m);
    });
    await chat.waitForTimeout(400);
    assert.equal(await chat.locator("[data-fsd-warning]").count(), count);
    await fs.promises.mkdir(path.join(root, "test-results"), {
      recursive: true,
    });
    await popup2.screenshot({
      path: path.join(root, "test-results/popup.png"),
    });
    await popup2.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    const reloadChat = await context.newPage();
    let loading = false;
    await reloadChat.route("https://www.fiverr.com/inbox/reload-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<html><body><nav><div data-testid="conversation-item" data-conversation-id="reload-private-reference"><p data-testid="message-preview">' +
          (loading ? "" : "Send me your password immediately.") +
          '</p></div></nav><main>Loading conversation...</main></body></html>',
      }),
    );
    await reloadChat.goto("https://www.fiverr.com/inbox/reload-fixture");
    const reloadFlag = reloadChat.locator("[data-fsd-flag]");
    await reloadFlag.waitFor();
    const originalScore = await reloadFlag.getAttribute("data-score");
    assert.ok(Number(originalScore) > 60);
    await popup2.waitForFunction(async () => {
      const data = await chrome.storage.session.get("fsd_flag_scores");
      return Object.values(data.fsd_flag_scores || {}).some((record) => record.score === 100);
    });
    // Wait for the specific conversation to finish its queued cache write.
    const reloadHash = await worker.evaluate(() => fsdMetadata.reference("reload-private-reference"));
    await popup2.evaluate(hash => { window.reloadHash = hash; }, reloadHash);
    await popup2.waitForFunction(async () =>
      (await chrome.storage.session.get("fsd_flag_scores")).fsd_flag_scores?.[window.reloadHash],
    );
    loading = true;
    await reloadChat.reload();
    // Local status paints immediately; retained risk arrives asynchronously.
    await reloadChat.waitForFunction(score =>
      document.querySelector('[data-fsd-flag]')?.dataset.score === score,
      originalScore, { timeout: 5000 });
    assert.equal(await reloadFlag.getAttribute("data-score"), originalScore,
      "Reload restores the previous flag while the preview and messages are still loading");
    const flagCache = await popup2.evaluate(async () =>
      JSON.stringify(await chrome.storage.session.get("fsd_flag_scores")),
    );
    assert.ok(!flagCache.includes("reload-private-reference"));
    assert.ok(!flagCache.includes("password"));
    await reloadChat.close();
    // Exercise the real MAIN -> ISOLATED bridge, not only same-world fixtures.
    await context.route('https://www.fiverr.com/api/inbox/fixture', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [{ id: 'network-risk', messages: [{ text: 'Send your password immediately.' }] }] }),
    }));
    await context.route('https://www.fiverr.com/inbox/background-fixture', route => route.fulfill({
      contentType: 'text/html',
      body: '<html><head><script>window.__INITIAL_STATE__={conversations:[{id:"state-safe",messages:[{text:"Thanks for the logo."}]}]};fetch("/api/inbox/fixture").then(r=>r.json()).then(value=>window.pageResponse=value);</script></head><body><nav><div data-testid="conversation-item" data-conversation-id="network-risk">Network buyer</div><div data-testid="conversation-item" data-conversation-id="state-safe">State buyer</div><div data-testid="conversation-item" data-conversation-id="unknown">Unknown buyer</div></nav><main><header>Selected chat</header></main></body></html>',
    }));
    const backgroundChat = await context.newPage();
    const bridgeLogs = [];
    backgroundChat.on('console', message => bridgeLogs.push(message.text()));
    await popup2.evaluate(() => chrome.storage.local.set({ fsd_debug: true }));
    await backgroundChat.goto('https://www.fiverr.com/inbox/background-fixture');
    await backgroundChat.waitForFunction(() =>
      document.querySelector('[data-conversation-id="network-risk"] [data-fsd-flag]')?.dataset.score === '100' &&
      document.querySelector('[data-conversation-id="state-safe"] [data-fsd-flag]')?.dataset.score === '0').catch(async error => {
        console.error('Bridge diagnostics:', bridgeLogs, await backgroundChat.locator('nav').innerHTML());
        throw error;
      });
    assert.equal(await backgroundChat.locator('[data-conversation-id="unknown"] [data-fsd-flag]').getAttribute('data-score'), 'null');
    assert.equal(await backgroundChat.evaluate(() => window.pageResponse.conversations[0].id), 'network-risk');
    assert.equal(new URL(backgroundChat.url()).pathname, '/inbox/background-fixture');
    await backgroundChat.close();
    console.log(
      "PASS: real installed MV3 extension: Run, live alert, worker result, popup close, history opt-in, shared tester, delete data, Stop.",
    );
  } finally {
    await context.close();
    // This is an isolated test profile created above, never a user's browser profile.
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
