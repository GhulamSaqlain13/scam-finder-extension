const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://www.fiverr.com/**", route => route.fulfill({ contentType: "text/html", body: '<main aria-busy="true">Loading conversation...</main>' }));
    await page.goto("https://www.fiverr.com/inbox/a");
    await page.evaluate(() => {
      window.saved = {};
      window.visibilityRequests = [];
      window.pending = [];
      window.observedConversations = [];
      window.chrome = {
        storage: { local: { get: async () => window.saved, set: async value => Object.assign(window.saved, value) }, onChanged: { addListener() {} } },
        runtime: {
          getURL: value => "https://extension.invalid/" + value,
          onMessage: { addListener: fn => { window.monitorListener = fn; } },
          sendMessage: async message => {
            if (message.type === "FSD_RESULTS") window.observedConversations.push(...(message.observations || []).map(record => record.conversationId));
            if (message.type === "FSD_VISIBILITY") { window.visibilityRequests.push(message); return { ok: true }; }
            if (message.type === "FSD_CONVERSATION_RISK") {
              if (window.hold && !message.scores) return new Promise(resolve => window.pending.push(resolve));
              return { ok: true, scores: {} };
            }
            return { ok: true };
          },
        },
      };
    });
    for (const file of ["link-scanner", "sensitive-information", "analyzer", "message-detector", "message-extractor", "conversation-detector", "draft-guard", "content-script"]) await page.addScriptTag({ path: path.resolve("extension/" + file + ".js") });
    const header = page.locator("[data-fsd-chat-flag]");
    await header.waitFor();
    assert.equal(await header.getAttribute("data-state"), "checking", "No sidebar or messages must not imply Safe");
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(() => window.visibilityRequests.length), 0, "Loading must not create a missing-message snapshot");
    await page.evaluate(() => {
      const main = document.querySelector("main");
      main.removeAttribute("aria-busy");
      main.innerHTML = '<div data-testid="message" data-message-id="a-message">You must send me your password.</div>';
    });
    await page.waitForFunction(() => document.querySelector("[data-fsd-chat-flag]")?.dataset.score === "96");
    await page.locator("[data-fsd-warning]").getByRole("button", { name: "Dismiss", exact: true }).click();
    await page.locator('[data-message-id="a-message"]').evaluate(node => { node.classList.add("updated-layout"); });
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 0, "Layout mutations preserve dismissal");
    await page.locator('[data-message-id="a-message"]').evaluate(node => node.replaceWith(node.cloneNode(true)));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 0, "Equivalent rerenders preserve dismissal");
    await page.evaluate(() => {
      window.hold = true;
      document.querySelector('[data-message-id="a-message"]').firstChild.data = "Send your password immediately.";
    });
    await page.waitForFunction(() => window.pending.length > 0);
    await page.evaluate(() => {
      window.hold = false;
      history.pushState({}, "", "/inbox/b");
      document.querySelector("main").innerHTML = '<div data-testid="message" data-message-id="b-message">Thanks for the logo.</div>';
    });
    await page.waitForFunction(() => document.querySelector("[data-fsd-chat-flag]")?.dataset.score === "0");
    await page.evaluate(() => window.pending.splice(0).forEach(resolve => resolve({ ok: true, scores: { "/inbox/a": 100 } })));
    await page.waitForTimeout(250);
    assert.equal(await header.getAttribute("data-score"), "0", "Old async scans cannot change the new chat's flag");
    await page.evaluate(() => history.pushState({}, "", "/inbox/c"));
    await page.waitForFunction(() => {
      let status;
      window.monitorListener({ type: "FSD_STATUS" }, {}, value => { status = value; });
      return status?.conversation?.conversationId === "/inbox/c";
    });
    await page.waitForFunction(() => window.observedConversations.includes("/inbox/c"));
    await page.close();

    const vault = await browser.newPage();
    await vault.route("https://vault.test/**", route => route.fulfill({ contentType: "text/html", body: "<main>Fixture</main>" }));
    await vault.goto("https://vault.test/");
    await vault.evaluate(async () => {
      window.saved = {};
      window.chrome = { storage: { local: { get: async () => window.saved, set: async value => Object.assign(window.saved, value) } } };
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence", 6);
        request.onupgradeneeded = () => {
          for (const name of ["evidence", "messages", "conversations", "riskEvents", "conversationMessages", "conversationSnapshots"]) request.result.createObjectStore(name);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const names = [...db.objectStoreNames];
      const tx = db.transaction(names, "readwrite");
      const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      const record = { id: "private-message", messageId: "private-message", conversationId: "/inbox/private-participant", sender: "private-sender", text: "private-message-body", message: "private-message-body", links: ["https://private-link.test/token"], riskScore: 96, riskLevel: "CRITICAL", categories: ["ACCOUNT_VERIFICATION"], signals: ["Account credentials or verification code requested"], suspicious: true, suspiciousKey: 1, capturedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
      tx.objectStore("messages").put(record, record.conversationId + "::" + record.id);
      tx.objectStore("conversationMessages").put(record, record.conversationId + "::" + record.id);
      tx.objectStore("evidence").put(record, "a".repeat(64));
      tx.objectStore("riskEvents").put({ ...record, eventId: "private-event" }, "private-event");
      tx.objectStore("conversations").put({ conversationId: record.conversationId, participants: [record.sender], messageIds: [record.id], messageRiskScores: { [record.id]: 96 }, highestRiskScore: 96, conversationRiskScore: 96, lastObservedAt: record.capturedAt }, record.conversationId);
      tx.objectStore("conversationSnapshots").put({ conversationId: record.conversationId, messageIds: [record.id], capturedAt: record.capturedAt }, record.conversationId);
      await done;
      db.close();
    });
    for (const file of ["metadata-store", "evidence-vault"]) await vault.addScriptTag({ path: path.resolve("extension/" + file + ".js") });
    await vault.evaluate(() => fsdEvidenceVault.initialize());
    const migration = await vault.evaluate(async () => {
      const db = await new Promise(resolve => { const request = indexedDB.open("fsd-evidence"); request.onsuccess = () => resolve(request.result); });
      const tx = db.transaction([...db.objectStoreNames], "readonly");
      const requests = [...db.objectStoreNames].map(name => ({ name, keys: tx.objectStore(name).getAllKeys(), values: tx.objectStore(name).getAll() }));
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      const result = requests.map(row => ({ name: row.name, keys: row.keys.result, values: row.values.result }));
      db.close();
      return result;
    });
    const serialized = JSON.stringify(migration);
    for (const secret of ["private-participant", "private-message", "private-sender", "private-link", "private-event"]) assert.ok(!serialized.includes(secret), "Migration removes private content from values and keys: " + secret);
    assert.equal(migration.find(row => row.name === "messages").values[0].riskScore, 96, "Migration preserves risk metadata");
    const risks = await vault.evaluate(() => fsdEvidenceVault.risk(["/inbox/private-participant"]));
    assert.equal(risks["/inbox/private-participant"], 96, "Migrated conversation lookup still works");
    const visibility = await vault.evaluate(async () => {
      const id = "/inbox/private-participant";
      const unseen = await fsdEvidenceVault.missing(id, [], []);
      const absent = await fsdEvidenceVault.missing(id, [], ["private-message"]);
      const deleted = await fsdEvidenceVault.missing(id, [], ["private-message"], ["private-message"]);
      await fsdEvidenceVault.missing(id, ["private-message"], ["private-message"]);
      const restored = await fsdEvidenceVault.details(id);
      return { unseen, absent, deleted, restored };
    });
    assert.equal(visibility.unseen.suspiciousMissingCount, 0, "Unloaded history is not a newly missing message");
    assert.equal(visibility.absent.suspiciousMissingCount, 1);
    assert.equal(visibility.absent.deletedCount, 0, "DOM absence is not confirmed deletion");
    assert.equal(visibility.deleted.deletedCount, 1);
    assert.equal(visibility.restored.messages[0].disappearedAt, null, "Reappearing unchanged messages clear missing status");
    await vault.clock.install();
    await vault.clock.fastForward(31 * 60 * 1000);
    assert.deepEqual(await vault.evaluate(() => fsdEvidenceVault.risk(["/inbox/private-participant"])), {}, "Old risk expires without extending on lookup");
    await vault.evaluate(() => fsdEvidenceVault.remove("a".repeat(64)));
    assert.equal((await vault.evaluate(() => fsdEvidenceVault.details("/inbox/private-participant"))).messages.length, 0, "Deleting evidence also removes its message copy");
    assert.equal((await vault.evaluate(() => fsdEvidenceVault.list())).total, 0);
    console.log("PASS: loading, stale scans, dismissal, metadata migration, visibility, expiration, and deletion regressions.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
