/* global chrome */
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "FSD_CLEAR" && !sender.tab?.url?.startsWith("https://")) {
    queue = queue.then(async () => {
      await chrome.storage.local.remove(["fsd_history", "fsd_last_result"]);
      return { ok: true };
    });
  } else if (message?.type === "FSD_RESULTS" && sender.tab) {
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (url.protocol !== "https:" || !(url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com"))) return;
    const results = Array.isArray(message.results) ? message.results.slice(-100).filter(result =>
      Number.isInteger(result.score) && result.score >= 0 && result.score <= 99 &&
      Array.isArray(result.signals) && result.signals.every(signal => typeof signal === "string" && signal.length <= 150)
    ).map(result => ({ score: result.score, signals: result.signals.slice(0, 12), checkedAt: Date.now() })) : [];
    if (!results.length) return;
    queue = queue.then(async () => {
      const data = await chrome.storage.local.get(["fsd_enabled", "fsd_keep_history", "fsd_history"]);
      if (!data.fsd_enabled) return { ok: false };
      const update = { fsd_last_result: results[results.length - 1] };
      if (data.fsd_keep_history) update.fsd_history = [...(Array.isArray(data.fsd_history) ? data.fsd_history : []), ...results].slice(-100);
      await chrome.storage.local.set(update);
      return { ok: true };
    });
  } else return;
  queue.then(respond, error => respond({ ok: false, error: error.message }));
  queue = queue.catch(() => {});
  return true;
});
