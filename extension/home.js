/* global chrome */
const button = document.getElementById("run");
const status = document.getElementById("status");
const notice = document.getElementById("notice");
let enabled = false;
function render(data) {
  if ("fsd_enabled" in data || !document.body.dataset.running) {
    if ("fsd_enabled" in data) enabled = data.fsd_enabled === true;
    status.textContent = enabled ? "Running" : "Stopped";
    document.body.dataset.running = String(enabled);
    button.textContent = enabled ? "Stop protection" : "Run protection";
  }
  if (data.fsd_last_result) {
    const result = data.fsd_last_result;
    document.getElementById("risk").textContent = result.score + "% risk";
    document.getElementById("risk").style.color = result.score >= 60 ? "#a2443e" : result.score >= 30 ? "#95631c" : "#176348";
    document.getElementById("signals").replaceChildren(...result.signals.map(text => {
      const li = document.createElement("li"); li.textContent = text; return li;
    }));
    document.getElementById("checked-at").textContent = new Date(result.checkedAt).toLocaleString();
  } else if ("fsd_last_result" in data) {
    document.getElementById("risk").textContent = "No messages checked";
    document.getElementById("risk").style.color = "";
    document.getElementById("signals").replaceChildren();
    document.getElementById("checked-at").textContent = "";
  }
}
chrome.storage.local.get(["fsd_enabled", "fsd_last_result"]).then(data => {
  render(data); button.disabled = false;
}).catch(() => { notice.textContent = "Could not load protection state. Reopen the extension."; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue])));
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
    notice.textContent = nextEnabled ? "Monitoring open Fiverr tabs. New rendered messages will be checked." : "Protection stopped. Existing warnings remain visible.";
  } catch (error) { notice.textContent = error.message; }
  finally { button.disabled = false; }
});
