/* global chrome */
const threshold = document.getElementById("threshold");
const keepHistory = document.getElementById("keep-history");
const notice = document.getElementById("notice");
let history = [];
threshold.addEventListener("input", () => { document.getElementById("threshold-value").textContent = threshold.value + " points"; });
async function loadHistory() {
  const data = await chrome.storage.local.get("fsd_history");
  history = Array.isArray(data.fsd_history) ? data.fsd_history : [];
  document.getElementById("count").textContent = history.length + " records";
  const container = document.getElementById("history");
  container.replaceChildren();
  if (!history.length) { const p = document.createElement("p"); p.textContent = "No saved scans."; container.append(p); }
  for (const result of [...history].reverse()) {
    const row = document.createElement("article");
    const score = document.createElement("strong"); score.textContent = globalThis.fsdDisplayRisk(result.score);
    const time = document.createElement("small"); time.textContent = new Date(result.checkedAt).toLocaleString();
    const signals = document.createElement("p"); signals.textContent = result.signals.map(signal => signal + ". " + globalThis.fsdSignalAction(signal)).join(" ") || "No rule matched. SAFE does not guarantee safety.";
    const categories = document.createElement("p"); categories.className = "category-summary";
    categories.textContent = globalThis.fsdCategoryLabels(result.signals).join(". ");
    row.append(score, categories, time, signals); container.append(row);
  }
  document.getElementById("export").disabled = history.length === 0;
}
chrome.storage.local.get(["fsd_threshold", "fsd_keep_history"]).then(data => {
  threshold.value = data.fsd_threshold ?? 21;
  document.getElementById("threshold-value").textContent = threshold.value + " points";
  keepHistory.checked = data.fsd_keep_history === true;
  document.getElementById("save").disabled = false;
}).catch(() => { notice.textContent = "Could not load settings. Reopen this page."; });
loadHistory().catch(() => { document.getElementById("history-notice").textContent = "Could not load history."; });
document.getElementById("settings").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await chrome.storage.local.set({ fsd_threshold: Number(threshold.value), fsd_keep_history: keepHistory.checked });
    if (!keepHistory.checked) await chrome.storage.local.remove("fsd_history");
    notice.textContent = "Settings saved.";
  } catch { notice.textContent = "Could not save settings."; }
});
document.getElementById("clear").addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: "FSD_CLEAR" });
    if (!response?.ok) throw Error();
    document.getElementById("history-notice").textContent = "Saved results deleted.";
  } catch { document.getElementById("history-notice").textContent = "Could not delete results."; }
});
document.getElementById("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "scam-finder-history.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.fsd_history) loadHistory().catch(() => {});
});
