/* global chrome */
(() => {
  if (globalThis.__fsdMonitorLoaded) return;
  globalThis.__fsdMonitorLoaded = true;
  const selector = '[data-testid="message"],[data-testid="message-bubble"],[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="conversation-message"]';
  let running = false;
  let threshold = 30;
  let timer;
  let expiryTimer;
  let seen = new WeakMap();
  let storageVersion = 0;
  let messageCount = 0;
  const pendingMessages = new Set();
  const pendingRows = new Set();
  const currentResults = new Map();
  const knownRows = new Set();
  const previewCache = new WeakMap();
  const alerts = new WeakMap();
  const rowContainerSelector = '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item';
  const rowSelector = rowContainerSelector + ',a[href*="/inbox/"]';
  const previewSelector = '[data-testid="message-preview"],[data-testid="last-message"],[class*="message-preview"],[class*="last-message"],.message-preview,.last-message,.message-snippet,.conversation-preview';
  // Conversation references and scores live only in this tab's memory.
  const conversationScores = new Map();
  const rowKeys = new WeakMap();
  const riskRetentionMs = 30 * 60 * 1000;
  const flags = new WeakMap();
  function messageLinks(node) {
    const anchors = [...node.querySelectorAll("a[href]")];
    if (node.matches("a[href]")) anchors.unshift(node);
    return anchors.map(link => ({ href: link.href, text: (link.innerText || link.textContent || "").trim() }));
  }
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
    badge.textContent = "⚑ " + globalThis.fsdRiskLabel(score);
    badge.title = "Suspicious message patterns detected. This score is not proof that the sender is a scammer.";
    badge.setAttribute("aria-label", "Conversation risk: " + globalThis.fsdRiskLabel(score) + ". Suspicious message patterns detected.");
    root.append(style, badge);
    row.append(flag);
    flags.set(row, flag);
  }
  function scanConversations(messageResults, candidates = document.querySelectorAll(rowSelector)) {
    clearTimeout(expiryTimer);
    const now = Date.now();
    for (const [key, record] of conversationScores) {
      if (record.expiresAt <= now) conversationScores.delete(key);
    }
    const rows = new Set();
    for (const candidate of candidates) {
      if (!candidate.isConnected) continue;
      const row = candidate.closest(rowContainerSelector) || candidate;
      // Keep the row wrapper: it contains both the link and preview in many inbox layouts.
      if (row.querySelector(rowContainerSelector)) continue;
      if (row.querySelector(selector) && !row.querySelector(previewSelector)) continue;
      rows.add(row);
      knownRows.add(row);
    }
    for (const row of rows) {
      const key = conversationKey(row);
      if (rowKeys.get(row) !== key) {
        flags.get(row)?.remove();
        flags.delete(row);
        rowKeys.set(row, key);
      }
      let score = 0;
      const preview = row.querySelector(previewSelector);
      if (preview && !preview.closest('[data-direction="outgoing"],[data-is-own="true"],.outgoing')) {
        const text = (preview.innerText || preview.textContent || "").trim();
        const links = messageLinks(preview);
        if ((text || links.length) && text.length <= 12000) {
          const linkKey = JSON.stringify(links);
          let cached = previewCache.get(preview);
          if (cached?.text !== text || cached?.linkKey !== linkKey) {
            cached = { text, linkKey, result: globalThis.fsdAnalyze(text, links) };
            previewCache.set(preview, cached);
          }
          score = Math.max(score, cached.result.score);
        }
      }
      const active = row.matches('[aria-current="page"],[aria-selected="true"],.selected,.active') ||
        !!row.querySelector('[aria-current="page"],[aria-selected="true"]') ||
        (key && key === "url:" + location.pathname + location.search);
      if (active) for (const result of messageResults) score = Math.max(score, result.score);
      if (key) {
        const retained = conversationScores.get(key);
        // Only current evidence at least as strong renews a retained score.
        // Missing or weaker evidence must not extend an old warning forever.
        if (score > 0 && (!retained || score >= retained.score)) {
          conversationScores.set(key, { score, expiresAt: now + riskRetentionMs });
        }
        score = Math.max(score, conversationScores.get(key)?.score || 0);
        if (conversationScores.size > 500) conversationScores.delete(conversationScores.keys().next().value);
      }
      flagConversation(row, score);
    }
    if (conversationScores.size) {
      const nextExpiry = Math.min(...Array.from(conversationScores.values(), record => record.expiresAt));
      expiryTimer = setTimeout(() => {
        if (running) scanConversations([...currentResults.values()], knownRows);
      }, Math.max(1, nextExpiry - Date.now()));
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
    title.textContent = globalThis.fsdRiskLabel(result.score) + " risk";
    const hide = document.createElement("button");
    hide.textContent = "Hide";
    hide.addEventListener("click", () => host.remove());
    header.append(title, hide);
    const list = document.createElement("ul");
    for (const signal of result.signals) { const li = document.createElement("li"); li.textContent = signal + ". " + globalThis.fsdSignalAction(signal); list.append(li); }
    for (const detail of result.linkDetails) {
      const li = document.createElement("li");
      li.textContent = detail;
      li.style.overflowWrap = "anywhere";
      list.append(li);
    }
    const note = document.createElement("small");
    note.textContent = "Pattern-based risk score, not proof of a scam. Check the order on Fiverr before acting.";
    section.append(header, list, note);
    root.append(style, section);
    node.after(host);
    alerts.set(node, host);
  }
  function scan(full = true) {
    if (!running) return;
    clearTimeout(timer);
    timer = undefined;
    const results = [];
    const nodes = full ? new Set([...currentResults.keys(), ...document.querySelectorAll(selector)]) : [...pendingMessages];
    const rows = full ? document.querySelectorAll(rowSelector) : new Set(pendingRows);
    pendingMessages.clear();
    pendingRows.clear();
    for (const node of currentResults.keys()) {
      if (!node.isConnected) { currentResults.delete(node); alerts.get(node)?.remove(); }
    }
    for (const row of knownRows) if (!row.isConnected) knownRows.delete(row);
    for (const node of nodes) {
      currentResults.delete(node);
      if (!node.isConnected || !node.matches(selector) ||
          node.closest('[data-fsd-warning],[data-direction="outgoing"],[data-is-own="true"],.outgoing,.message--outgoing,[contenteditable="true"]') ||
          node.querySelector(selector) || node.closest(previewSelector) ||
          !node.getClientRects().length || getComputedStyle(node).visibility === "hidden") {
        alerts.get(node)?.remove();
        seen.delete(node);
        continue;
      }
      const text = (node.innerText || node.textContent || "").trim();
      const links = messageLinks(node);
      if ((!text && !links.length) || text.length > 12000) {
        alerts.get(node)?.remove();
        seen.delete(node);
        continue;
      }
      const linkKey = JSON.stringify(links);
      const cached = seen.get(node);
      const changed = cached?.text !== text || cached?.linkKey !== linkKey;
      const result = changed ? globalThis.fsdAnalyze(text, links) : cached.result;
      currentResults.set(node, result);
      // Refresh presentation independently of analysis and result persistence.
      // Ordinary DOM updates leave dismissed warnings hidden.
      if (changed || cached.threshold !== threshold) {
        seen.set(node, { text, linkKey, result, threshold });
        warn(node, result);
      }
      if (changed) results.push({ score: result.score, signals: result.signals, checkedAt: Date.now() }); // Metadata only, no link details.
    }
    messageCount = currentResults.size;
    if (!full && nodes.length) {
      for (const row of knownRows) {
        const key = conversationKey(row);
        if (row.matches('[aria-current="page"],[aria-selected="true"],.selected,.active') ||
            row.querySelector('[aria-current="page"],[aria-selected="true"]') ||
            key === "url:" + location.pathname + location.search) rows.add(row);
      }
    }
    scanConversations([...currentResults.values()], rows);
    if (results.length) chrome.runtime.sendMessage({ type: "FSD_RESULTS", results }).catch(() => {});
  }
  function queueAffected(node, descendants = false) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element || element.closest('[data-fsd-warning],[data-fsd-flag]')) return;
    const message = element.closest(selector);
    if (message) pendingMessages.add(message);
    if (currentResults.has(element)) pendingMessages.add(element);
    const row = element.closest(rowSelector);
    if (row) pendingRows.add(row);
    if (knownRows.has(element)) pendingRows.add(element);
    if (descendants) {
      for (const child of element.querySelectorAll(selector)) pendingMessages.add(child);
      for (const child of element.querySelectorAll(rowSelector)) pendingRows.add(child);
    }
  }
  const observer = new MutationObserver(records => {
    if (!running) return;
    let removed = false;
    for (const record of records) {
      if (record.type === "childList") {
        const changed = [...record.addedNodes, ...record.removedNodes].filter(node =>
          !(node.nodeType === 1 && node.matches('[data-fsd-warning],[data-fsd-flag]')));
        if (!changed.length) continue;
        queueAffected(record.target);
        for (const node of record.addedNodes) queueAffected(node, true);
        removed ||= record.removedNodes.length > 0;
      } else queueAffected(record.target, record.type === "attributes");
    }
    // Keep the first deadline: continuous mutations cannot postpone processing.
    if (timer === undefined && (removed || pendingMessages.size || pendingRows.size)) {
      timer = setTimeout(() => scan(false), 150);
    }
  });
  function setRunning(enabled) {
    if (running === enabled) return;
    running = enabled;
    observer.disconnect();
    clearTimeout(timer);
    timer = undefined;
    pendingMessages.clear();
    pendingRows.clear();
    currentResults.clear();
    knownRows.clear();
    clearTimeout(expiryTimer);
    if (running) {
      seen = new WeakMap();
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["href", "data-conversation-id", "aria-current", "aria-selected", "class", "data-direction", "data-is-own", "hidden", "style", "contenteditable", "data-testid", "data-message-id"],
      });
      scan();
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "FSD_STATUS") {
      respond({
        running, supported: true, messageCount: running ? messageCount : 0,
        conversationPage: /^\/inbox(?:\/|$)/.test(location.pathname),
      });
      return;
    }
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

