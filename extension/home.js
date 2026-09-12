/* global chrome */
const button = document.getElementById("run");
const status = document.getElementById("status");
const notice = document.getElementById("notice");
let enabled = false;
let statusVersion = 0;
function setStatus(text, monitoring = false) {
  status.textContent = text;
  document.body.dataset.monitoring = String(monitoring);
}
function isFiverr(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "fiverr.com" || parsed.hostname.endsWith(".fiverr.com"));
  } catch { return false; }
}
async function refreshStatus() {
  const version = ++statusVersion;
  if (!enabled) { setStatus("Stopped"); return; }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (version !== statusVersion) return;
    if (!isFiverr(tab?.url)) { setStatus("Open a Fiverr conversation"); return; }
    const response = await chrome.tabs.sendMessage(tab.id, { type: "FSD_STATUS" });
    if (version !== statusVersion) return;
    if (!response?.supported || !response.running) setStatus("Waiting for protection to connect");
    else if (response.messageCount > 0) setStatus("Monitoring this conversation", true);
    else setStatus(response.conversationPage ? "No messages detected" : "Open a Fiverr conversation");
  } catch {
    if (version === statusVersion) setStatus("Cannot connect to this tab");
  }
}
function render(data) {
  if ("fsd_enabled" in data || !document.body.dataset.running) {
    if ("fsd_enabled" in data) enabled = data.fsd_enabled === true;
    setStatus(enabled ? "Checking this tab..." : "Stopped");
    document.body.dataset.running = String(enabled);
    button.textContent = enabled ? "Stop protection" : "Run protection";
    void refreshStatus();
  }
  for (const [key, prefix] of [["fsd_last_result", ""], ["fsd_highest_result", "highest-"]]) {
    if (!(key in data)) continue;
    const result = data[key];
    const risk = document.getElementById(prefix + "risk");
    risk.textContent = result ? globalThis.fsdRiskLabel(result.score) : "No messages checked";
    risk.style.color = !result ? "" : result.score >= 60 ? "#a2443e" : result.score >= 30 ? "#95631c" : "#176348";
    document.getElementById(prefix + "signals").replaceChildren(...(result?.signals || []).map(signal => {
      const li = document.createElement("li");
      li.textContent = signal + ". " + globalThis.fsdSignalAction(signal);
      return li;
    }));
    document.getElementById(prefix + "checked-at").textContent = result ? new Date(result.checkedAt).toLocaleString() : "";
  }
}
chrome.storage.local.get(["fsd_enabled", "fsd_last_result", "fsd_highest_result"]).then(data => {
  data.fsd_highest_result ??= data.fsd_last_result;
  render(data); button.disabled = false;
}).catch(() => { notice.textContent = "Could not load protection state. Reopen the extension."; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue])));
});
// The popup owns this timer; closing it ends polling. Counts never enter storage.
const statusTimer = setInterval(refreshStatus, 1000);
window.addEventListener("pagehide", () => clearInterval(statusTimer));
chrome.tabs.onActivated.addListener(() => { void refreshStatus(); });
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status || change.url) void refreshStatus();
});
button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    if (!enabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab?.url || "about:blank");
      if (url.protocol !== "https:" || !(url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com"))) throw Error("Open a Fiverr conversation, then press Run.");
      let response;
      try { response = await chrome.tabs.sendMessage(tab.id, { type: "FSD_STATUS" }); }
      catch { /* An already-open tab may not have the content scripts yet. */ }
      if (!response?.supported) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["extension/analyzer.js", "extension/content-script.js"],
          });
          response = await chrome.tabs.sendMessage(tab.id, { type: "FSD_STATUS" });
        } catch { throw Error("Could not connect to this Fiverr tab. Wait for it to finish loading, then press Run again."); }
      }
      if (!response?.supported) throw Error("This Fiverr tab is still loading. Please press Run again when it is ready.");
    }
    const nextEnabled = !enabled;
    await chrome.storage.local.set({ fsd_enabled: nextEnabled });
    render({ fsd_enabled: nextEnabled });
    notice.textContent = nextEnabled ? "Protection enabled for open Fiverr tabs." : "Protection stopped. Existing warnings remain visible.";
  } catch (error) { notice.textContent = error.message; }
  finally { button.disabled = false; }
});
