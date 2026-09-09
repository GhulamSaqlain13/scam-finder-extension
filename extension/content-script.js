/* global chrome */
(() => {
  if (globalThis.__fsdMonitorLoaded) return;
  globalThis.__fsdMonitorLoaded = true;
  const selector = '[data-testid="message"],[data-testid="message-bubble"],[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="conversation-message"]';
  let running = false;
  let threshold = 30;
  let timer;
  let seen = new WeakMap();
  let storageVersion = 0;
  const alerts = new WeakMap();
  const rowContainerSelector = '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item';
  const rowSelector = rowContainerSelector + ',a[href*="/inbox/"]';
  const previewSelector = '[data-testid="message-preview"],[data-testid="last-message"],[class*="message-preview"],[class*="last-message"],.message-preview,.last-message,.message-snippet,.conversation-preview';
  // Conversation references and scores live only in this tab's memory.
  const conversationScores = new Map();
  const rowScores = new WeakMap();
  const flags = new WeakMap();
  function conversationKey(row) {
    const link = row.matches("a[href]") ? row : row.querySelector('a[href*="/inbox/"]');
    if (link) {
      try {
        const url = new URL(link.href, location.href);
        return "url:" + url.pathname + url.search;
      } catch { /* Fall back to an explicit conversation ID. */ }
    }
    return row.dataset.conversationId ? "id:" + row.dataset.conversationId : null;
  }
  function flagConversation(row, score) {
    const previous = flags.get(row);
    if (score < threshold) { previous?.remove(); return; }
    if (previous?.isConnected && previous.dataset.score === String(score)) return;
    previous?.remove();
    const flag = document.createElement("span");
    flag.dataset.fsdFlag = "true";
    flag.dataset.score = String(score);
    const root = flag.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ':host{display:inline-flex;vertical-align:middle;margin:4px 6px;flex-shrink:0}span{display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border:1px solid #e7b8ae;border-radius:5px;background:#fff1ed;color:#9b3528;font:600 11px/1.4 system-ui;white-space:nowrap}svg{width:12px;height:12px}';
    const badge = document.createElement("span");
    badge.textContent = "⚑ " + score + "% risk";
    badge.title = "Suspicious message patterns detected. This score is not proof that the sender is a scammer.";
    badge.setAttribute("aria-label", "Conversation risk: " + score + " percent. Suspicious message patterns detected.");
    root.append(style, badge);
    row.append(flag);
    flags.set(row, flag);
  }
  function scanConversations(messageResults) {
    const rows = new Set();
    for (const candidate of document.querySelectorAll(rowSelector)) {
      const row = candidate.closest(rowContainerSelector) || candidate;
      // Keep the row wrapper: it contains both the link and preview in many inbox layouts.
      if (row.querySelector(rowContainerSelector)) continue;
      if (row.querySelector(selector) && !row.querySelector(previewSelector)) continue;
      rows.add(row);
    }
    for (const row of rows) {
      const key = conversationKey(row);
      let score = Math.max(rowScores.get(row) || 0, key ? conversationScores.get(key) || 0 : 0);
      const preview = row.querySelector(previewSelector);
      if (preview && !preview.closest('[data-direction="outgoing"],[data-is-own="true"],.outgoing')) {
        const text = (preview.innerText || preview.textContent || "").trim();
        if (text && text.length <= 12000) score = Math.max(score, globalThis.fsdAnalyze(text).score);
      }
      const active = row.matches('[aria-current="page"],[aria-selected="true"],.selected,.active') ||
        !!row.querySelector('[aria-current="page"],[aria-selected="true"]') ||
        (key && key === "url:" + location.pathname + location.search);
      if (active) for (const result of messageResults) score = Math.max(score, result.score);
      rowScores.set(row, score);
      if (key) {
        conversationScores.set(key, score);
        if (conversationScores.size > 500) conversationScores.delete(conversationScores.keys().next().value);
      }
      flagConversation(row, score);
    }
  }
  function warn(node, result) {
    alerts.get(node)?.remove();
    if (result.score < threshold) return;
    const host = document.createElement("aside");
    host.dataset.fsdWarning = "true";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ':host{display:block;margin:8px 0;font:13px/1.5 system-ui;color:#663a31}section{border:1px solid #e2b0a5;border-left:3px solid #bb5945;background:#fff6f2;border-radius:6px;padding:12px}header{display:flex;gap:10px;align-items:center}strong{flex:1}button{border:1px solid #dcc4bc;border-radius:4px;background:white;padding:4px 8px;color:#663a31;cursor:pointer}p{margin:8px 0 0}ul{padding-left:18px;margin:8px 0}small{color:#826a62}';
    const section = document.createElement("section");
    section.setAttribute("role", "alert");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = (result.score >= 60 ? "Scam alert" : "Suspicious message") + " · Risk " + result.score + "%";
    const hide = document.createElement("button");
    hide.textContent = "Hide";
    hide.addEventListener("click", () => host.remove());
    header.append(title, hide);
    const list = document.createElement("ul");
    for (const signal of result.signals) { const li = document.createElement("li"); li.textContent = signal; list.append(li); }
    const note = document.createElement("small");
    note.textContent = "Pattern-based risk score, not proof of a scam. Check the order on Fiverr before acting.";
    section.append(header, list, note);
    root.append(style, section);
    node.after(host);
    alerts.set(node, host);
  }
  function scan() {
    if (!running) return;
    const results = [];
    const currentMessages = [];
    for (const node of document.querySelectorAll(selector)) {
      if (node.closest('[data-fsd-warning],[data-direction="outgoing"],[data-is-own="true"],.outgoing,.message--outgoing,[contenteditable="true"]')) continue;
      if (node.querySelector(selector)) continue; // Only the innermost message, never a whole conversation.
      if (node.closest(previewSelector)) continue;
      const text = (node.innerText || node.textContent || "").trim();
      if (!text || text.length > 12000) continue;
      const result = globalThis.fsdAnalyze(text);
      currentMessages.push(result);
      if (seen.get(node) === text) continue;
      seen.set(node, text);
      warn(node, result);
      results.push({ ...result, checkedAt: Date.now() }); // Metadata only.
    }
    scanConversations(currentMessages);
    if (results.length) chrome.runtime.sendMessage({ type: "FSD_RESULTS", results }).catch(() => {});
  }
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    if (running) timer = setTimeout(scan, 150);
  });
  function setRunning(enabled) {
    if (running === enabled) return;
    running = enabled;
    observer.disconnect();
    clearTimeout(timer);
    if (running) {
      seen = new WeakMap();
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      scan();
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "FSD_STATUS") { respond({ running, supported: true }); return; }
    if (message?.type === "FSD_SCAN" && running) scan();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.fsd_threshold) {
      threshold = Number.isInteger(changes.fsd_threshold.newValue) ? Math.max(1, Math.min(99, changes.fsd_threshold.newValue)) : 30;
      if (running) scan();
    }
    if (area === "local" && changes.fsd_enabled) {
      storageVersion++;
      setRunning(changes.fsd_enabled.newValue === true);
    }
  });
  const version = storageVersion;
  chrome.storage.local.get(["fsd_enabled", "fsd_threshold"]).then(data => {
    threshold = Number.isInteger(data.fsd_threshold) ? Math.max(1, Math.min(99, data.fsd_threshold)) : 30;
    if (version === storageVersion) setRunning(data.fsd_enabled === true);
  }).catch(() => {});
})();

