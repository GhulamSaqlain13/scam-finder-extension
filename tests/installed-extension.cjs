const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scam-finder-test-"));
  const root = path.resolve(__dirname, "..");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true,
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
    const id = new URL(worker.url()).host;
    await context.route("https://www.fiverr.com/**", route => route.fulfill({
      contentType: "text/html",
      body: '<html><body><main><div data-testid="message" data-message-id="first">Send me your password immediately.</div>' + '<div data-testid="message">Thanks for the logo.</div>'.repeat(105) + '</main></body></html>',
    }));
    const chat = await context.newPage();
    await chat.goto("https://www.fiverr.com/inbox/test");
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/extension/home.html");
    await popup.waitForFunction(() => !document.getElementById("run").disabled);
    const popupSize = () => popup.evaluate(() => ({
      width: document.documentElement.getBoundingClientRect().width,
      height: document.documentElement.getBoundingClientRect().height,
    }));
    assert.deepEqual(await popupSize(), { width: 392, height: 600 });
    const tabId = await popup.evaluate(async () => (await chrome.tabs.query({url:"https://www.fiverr.com/*"}))[0].id);
    await popup.evaluate(id => chrome.tabs.update(id, {active:true}), tabId);
    // Exercise recovery when the initial connection to an open tab fails.
    await popup.evaluate(() => {
      const send = chrome.tabs.sendMessage.bind(chrome.tabs);
      const inject = chrome.scripting.executeScript.bind(chrome.scripting);
      window.injections = 0;
      chrome.tabs.sendMessage = (...args) => {
        if (!window.injections) return Promise.reject(new Error("No receiver"));
        return send(...args);
      };
      chrome.scripting.executeScript = (...args) => { window.injections++; return inject(...args); };
    });
    await popup.evaluate(() => document.getElementById("run").click());
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Monitoring this conversation");
    assert.equal(await popup.evaluate(() => window.injections), 1, "Run injects local scripts when the initial connection fails");
    await chat.locator("[data-fsd-warning]").waitFor();
    assert.equal(await chat.locator("[data-fsd-warning]").locator("strong").textContent(), "High risk");
    await popup.waitForFunction(() => document.getElementById("risk").textContent === "Low" && document.getElementById("highest-risk").textContent === "High");
    assert.match(await popup.locator("#highest-signals").textContent(), /Do not share passwords or verification codes/);
    await chat.evaluate(() => {
      const node = document.createElement("div"); node.dataset.testid = "message"; node.textContent = "Looks good."; document.querySelector("main").append(node);
    });
    await popup.waitForFunction(async () => {
      const data = await chrome.storage.local.get(["fsd_last_result", "fsd_highest_result"]);
      return data.fsd_last_result?.score === 0 && data.fsd_highest_result?.score === 99 && data.fsd_last_result.checkedAt > data.fsd_highest_result.checkedAt;
    });
    assert.deepEqual(await popupSize(), { width: 392, height: 600 }, "Scan results must not resize the popup document");
    assert.equal(await popup.evaluate(() => document.body.scrollWidth > document.body.clientWidth), false, "Popup must not overflow horizontally");
    await fs.promises.mkdir(path.join(root, "test-results"), { recursive: true });
    await popup.screenshot({ path: path.join(root, "test-results/status-monitoring.png") });
    await chat.evaluate(() => { document.querySelector("main").hidden = true; });
    await popup.waitForFunction(() => document.getElementById("status").textContent === "No messages detected");
    assert.equal(await popup.evaluate(() => document.body.dataset.monitoring), "false");
    await chat.evaluate(() => { document.querySelector("main").hidden = false; });
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Monitoring this conversation");
    await chat.evaluate(() => {
      window.originalMain = [...document.querySelector("main").childNodes];
      document.querySelector("main").innerHTML = '<div data-testid="message" data-direction="outgoing">Thanks.</div><div data-testid="message-preview"><div data-testid="message">Preview only</div></div>';
    });
    await popup.waitForFunction(() => document.getElementById("status").textContent === "No messages detected");
    await chat.evaluate(() => { history.pushState({}, "", "/categories/graphics-design"); });
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Open a Fiverr conversation");
    await chat.evaluate(() => {
      history.pushState({}, "", "/inbox/test");
      document.querySelector("main").replaceChildren(...window.originalMain);
    });
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Monitoring this conversation");
    const other = await context.newPage();
    await other.goto("about:blank");
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Open a Fiverr conversation");
    await popup.evaluate(id => chrome.tabs.update(id, { active: true }), tabId);
    await popup.waitForFunction(() => document.getElementById("status").textContent === "Monitoring this conversation");
    await other.close();
    await popup.close(); // Monitoring must survive closing its UI.
    await chat.evaluate(() => {
      const m = document.createElement("div"); m.dataset.testid="message"; m.textContent="Send me the verification code."; document.querySelector("main").append(m);
    });
    await chat.waitForFunction(() => document.querySelectorAll("[data-fsd-warning]").length === 2);
    const settings = await context.newPage();
    await settings.goto("chrome-extension://" + id + "/extension/options.html");
    await settings.locator("#keep-history").check();
    await settings.locator("#save").click();
    await settings.waitForFunction(() => document.getElementById("notice").textContent === "Settings saved.");
    await chat.evaluate(() => {
      const m = document.createElement("div"); m.dataset.testid="message"; m.textContent="Install AnyDesk immediately."; document.querySelector("main").append(m);
    });
    await settings.waitForFunction(() => document.getElementById("count").textContent === "1 records");
    const tester = await context.newPage();
    await tester.goto("chrome-extension://" + id + "/extension/tester.html");
    await tester.locator("#message").fill("Send me your password immediately.");
    await tester.locator("#tester > button").click();
    assert.equal(await tester.locator("#risk").textContent(), "High");
    assert.equal(await settings.locator("#history article strong").textContent(), "High");
    await settings.locator("#clear").click();
    await settings.waitForFunction(() => document.getElementById("count").textContent === "0 records");
    const popup2 = await context.newPage();
    await popup2.goto("chrome-extension://" + id + "/extension/home.html");
    await popup2.waitForFunction(() => !document.getElementById("run").disabled);
    assert.equal(await popup2.locator("#highest-risk").textContent(), "No messages checked");
    assert.equal(await popup2.locator("#risk").textContent(), "No messages checked");
    await popup2.locator("#run").click();
    await popup2.waitForFunction(() => document.getElementById("status").textContent === "Stopped");
    const count = await chat.locator("[data-fsd-warning]").count();
    await chat.evaluate(() => {
      const m = document.createElement("div"); m.dataset.testid="message"; m.textContent="Enter your card number."; document.querySelector("main").append(m);
    });
    await chat.waitForTimeout(400);
    assert.equal(await chat.locator("[data-fsd-warning]").count(), count);
    await fs.promises.mkdir(path.join(root,"test-results"), {recursive:true});
    await popup2.screenshot({path:path.join(root,"test-results/popup.png")});
    console.log("PASS: real installed MV3 extension: Run, live alert, worker result, popup close, history opt-in, shared tester, delete data, Stop.");
  } finally {
    await context.close();
    // This is an isolated test profile created above, never a user's browser profile.
    fs.rmSync(profile, {recursive:true,force:true});
  }
})().catch(error => { console.error(error); process.exitCode=1; });
