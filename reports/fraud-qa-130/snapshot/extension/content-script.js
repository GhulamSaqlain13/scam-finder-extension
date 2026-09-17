/* global chrome */
(() => {
  if (globalThis.__fsdMonitorLoaded) return;
  globalThis.__fsdMonitorLoaded = true;
  const {
    selector,
    candidateSelector,
    rowContainerSelector,
    rowSelector,
    previewSelector,
  } = globalThis.fsdMessageDetector;
  const { links: messageLinks } = globalThis.fsdMessageExtractor;
  let running = false;
  let threshold = 21;
  let expiryTimer;
  let seen = new WeakMap();
  let storageVersion = 0;
  let messageCount = 0;
  const currentResults = new Map();
  const visibleMessages = new Map();
  const observedMessages = new Map();
  const lastConversationByPath = new Map();
  let conversationStatus;
  let visibilityTimer;
  let visibilityVersion = 0;
  let previousNotice;
  let noticePath = location.pathname;
  let scannedPath = location.pathname;
  let conversationScanVersion = 0;
  const dismissed = new Map();
  const patternAlerts = new WeakMap();
   let deletedMessageNotice;
  let patternMatcher;
  let patternScorer;
  const patternReady = globalThis.fsdPatternMatcher
    ?.load?.()
    .then((matcher) => {
      patternMatcher = matcher;
      patternScorer = globalThis.fsdScorer?.create?.(matcher.catalog);
      refreshPatternAlerts();
    })
    .catch(() => null);
   const deletedMessageDetector = globalThis.fsdDeletedMessageDetector?.create?.({
     onPreviouslyDetected: (result) => {
       deletedMessageNotice?.remove();
       deletedMessageNotice = globalThis.fsdAlertUI?.showPreviouslyDetected?.({
         result,
         onDismiss: () => {
           deletedMessageNotice = undefined;
         },
       });
     },
   });
  const warningIdentity = (message) =>
    JSON.stringify([
      message.conversationId,
      message.id,
      message.text,
      message.links,
      threshold,
    ]);
  function activeResults() {
    return [...currentResults]
      .filter(([node]) => visibleMessages.get(node)?.path === location.pathname)
      .map(([, result]) => result);
  }
  function clearPreviousNotice() {
    previousNotice?.remove();
    previousNotice = undefined;
  }
  function trimObservedConversations() {
    while (observedMessages.size > 100)
      observedMessages.delete(observedMessages.keys().next().value);
    while (lastConversationByPath.size > 100)
      lastConversationByPath.delete(lastConversationByPath.keys().next().value);
  }
  function observeMessage(message) {
    const path = location.pathname;
    visibleMessages.set(message.node, {
      id: message.id,
      conversationId: message.conversationId,
      path,
    });
    if (!message.conversationId) return;
    if (!observedMessages.has(message.conversationId))
      observedMessages.set(message.conversationId, new Set());
    const observed = observedMessages.get(message.conversationId);
    if (observed.size < 10000) observed.add(message.id);
    if (/^\/inbox\/[^/]+/.test(path))
      lastConversationByPath.set(path, message.conversationId);
    trimObservedConversations();
  }
  function updatePreviousNotice() {
    clearTimeout(visibilityTimer);
    visibilityTimer = undefined;
    const version = ++visibilityVersion;
    const path = location.pathname;
    if (!running || !/^\/inbox\/[^/]+/.test(path)) {
      clearPreviousNotice();
      return;
    }
    const main =
      globalThis.fsdConversationDetector?.conversationRoot?.() ||
      document.querySelector('main,[role="main"]') ||
      document.body;
    if (main && !main.getClientRects().length) {
      clearPreviousNotice();
      return;
    }
    if (globalThis.fsdConversationDetector.isLoading(main)) {
      clearPreviousNotice();
      return;
    }
    const visibleInPath = [...visibleMessages.values()].filter(
      (message) => message.path === path,
    );
    const conversationIds = new Set(
      visibleInPath.map((message) => message.conversationId).filter(Boolean),
    );
    if (conversationIds.size > 1 || visibleInPath.length > 10000) {
      clearPreviousNotice();
      return;
    }
    const conversationId =
      [...conversationIds][0] || lastConversationByPath.get(path) || path;
    const visibleIds = visibleInPath
      .filter(
        (message) =>
          message.conversationId === conversationId && !message.deleted,
      )
      .map((message) => message.id);
    const deletedIds = visibleInPath
      .filter((message) => message.deleted)
      .map((message) => message.id);
    const observedIds = [...(observedMessages.get(conversationId) || [])];
    if (observedIds.length > 10000) {
      clearPreviousNotice();
      return;
    }
    chrome.runtime
      .sendMessage({
        type: "FSD_VISIBILITY",
        conversationId,
        visibleIds,
        observedIds,
        deletedIds,
      })
      .then((response) => {
        if (
          !running ||
          version !== visibilityVersion ||
          path !== location.pathname
        )
          return;
        clearPreviousNotice();
        if (!response?.ok || !response.suspiciousMissingCount) return;
        const host = document.createElement("aside");
        host.dataset.fsdPrevious = "true";
        const root = host.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent =
          ":host{display:block;max-width:420px;margin:12px 0}section{font:13px/1.5 system-ui;padding:12px;border:1px solid #b99036;border-left:4px solid var(--risk-color);border-radius:6px;background:#fff9e9;color:#3f3218;box-shadow:0 2px 10px rgba(45,36,16,.08)}strong{display:block;color:var(--risk-color);font-size:13px;letter-spacing:0;text-transform:uppercase}p{margin:6px 0 0}.meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 10px;margin:10px 0 0}.meta span:nth-child(odd){font-weight:700}a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font:700 12px/1.4 system-ui;border:1px solid #9f812f;border-radius:4px;background:#fff;color:#3f3218;min-height:32px;margin-top:12px;padding:6px 10px;cursor:pointer}a:hover{background:#fff3ca}a:focus-visible{outline:2px solid #176348;outline-offset:2px}";
        host.style.setProperty(
          "--risk-color",
          globalThis.fsdRiskColor(response.maxRisk || 61),
        );
        const section = document.createElement("section");
        section.setAttribute("role", "status");
        const title = document.createElement("strong");
        title.textContent = response.deletedCount
          ? "Previously flagged message was marked deleted"
          : "Previously flagged message is not visible";
        const text = document.createElement("p");
        text.textContent =
          "Suspicious messages from this conversation are no longer visible on Fiverr.";
        const meta = document.createElement("div");
        meta.className = "meta";
        const detectedLabel = document.createElement("span");
        detectedLabel.textContent = "Previously detected:";
        const detectedValue = document.createElement("span");
        detectedValue.textContent = String(response.suspiciousMissingCount);
        const riskLabel = document.createElement("span");
        riskLabel.textContent = "Risk:";
        const riskValue = document.createElement("span");
        riskValue.textContent = globalThis.fsdDisplayRisk(
          response.maxRisk || 61,
        );
        const note = document.createElement("p");
        note.textContent =
          "Messages can disappear for multiple reasons. This warning only appears because the missing message was already suspicious before it disappeared.";
        const button = document.createElement("a");
        button.textContent = "View Evidence";
        button.href = chrome.runtime.getURL(
          "extension/options.html?conversation=" +
            encodeURIComponent(conversationId) +
            "#conversation-evidence",
        );
        button.target = "_blank";
        button.rel = "noopener";
        button.setAttribute("role", "button");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          chrome.runtime
            .sendMessage({ type: "FSD_OPEN_EVIDENCE", conversationId })
            .catch(() => {
              window.open(button.href, "_blank", "noopener");
            });
        });
        meta.append(detectedLabel, detectedValue, riskLabel, riskValue);
        section.append(title, text, meta, note, button);
        root.append(style, section);
        (document.querySelector("main") || document.body).prepend(host);
        previousNotice = host;
      })
      .catch(() => {});
  }
  function scheduleVisibility() {
    visibilityVersion++;
    clearTimeout(visibilityTimer);
    visibilityTimer = setTimeout(updatePreviousNotice, 750);
  }
  const knownRows = new Set();
  const previewCache = new WeakMap();
  const alerts = new WeakMap();
  // Conversation references and scores live only in this tab's memory.
  const conversationScores = new Map();
  const rowKeys = new WeakMap();
  const riskRetentionMs = 30 * 60 * 1000;
  const flags = new WeakMap();
  let heartbeatTimer;
  let chatFlag;
  const unavailablePattern =
    /\b(?:can no longer be contacted|no longer available|account (?:disabled|removed|restricted|unavailable)|user (?:disabled|removed|restricted|unavailable)|fiverr (?:removed|restricted|blocked))\b/i;
  function conversationRiskScore(results) {
    const scores = results
      .map((result) => result.score)
      .filter((score) => Number.isInteger(score) && score > 0)
      .sort((a, b) => b - a);
    if (!scores.length) return 0;
    return Math.min(
      100,
      scores[0] +
        Math.round(
          scores.slice(1).reduce((sum, score) => sum + score, 0) * 0.5,
        ),
    );
  }
  function riskSummary(result) {
    const categories = new Set(result.categories || []);
    if (categories.has("PHISHING") || categories.has("ACCOUNT_VERIFICATION"))
      return "This message may be a phishing attempt.";
    if (categories.has("PAYMENT_SCAM"))
      return "This message may be a payment scam.";
    if (categories.has("PERSONAL_INFORMATION"))
      return "This message may be requesting sensitive information.";
    if (categories.has("MALWARE")) return "This message may be unsafe.";
    if (categories.has("EXTERNAL_COMMUNICATION"))
      return "This message asks to move communication outside Fiverr.";
    return "This message contains warning signs.";
  }
  function compactText(node) {
    return (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function rowPreview(row) {
    if (globalThis.fsdConversationDetector.isLoading(row)) return null;
    const preview = row.querySelector(previewSelector);
    if (preview)
      return {
        node: preview,
        confirmed: true,
        text: compactText(preview),
        links: messageLinks(preview),
      };
    const copy = row.cloneNode(true);
    for (const element of copy.querySelectorAll(
      "[data-fsd-flag],.user-info > p:first-child",
    ))
      element.remove();
    for (const link of copy.querySelectorAll('a[href*="/inbox/"]'))
      if (!link.childElementCount) link.remove();
    const text = compactText(copy);
    if (!text || text.length > 12000) return null;
    return { node: row, text, links: messageLinks(row), confirmed: false };
  }
  function unavailableResult(text) {
    if (!unavailablePattern.test(text)) return null;
    return {
      score: 61,
      signals: ["Fiverr contact is no longer available"],
      categories: ["ACCOUNT_STATUS"],
    };
  }
  function statusResult() {
    if (!/^\/inbox\/[^/]+/.test(location.pathname)) return null;
    const main =
      globalThis.fsdConversationDetector?.conversationRoot?.() ||
      document.querySelector('main,[role="main"]') ||
      document.body;
    if (!main || !main.getClientRects().length) return null;
    const text = compactText(main);
    const result = unavailableResult(text);
    return result
      ? {
          id: "status:contact-unavailable",
          conversationId: location.pathname,
          text,
          result,
        }
      : null;
  }
  function conversationKey(row) {
    const link = row.matches("a[href]")
      ? row
      : row.querySelector('a[href*="/inbox/"]');
    if (link) {
      try {
        const url = new URL(link.href, location.href);
        return "url:" + url.pathname + url.search;
      } catch {
        /* Fall back to an explicit conversation ID. */
      }
    }
    if (row.dataset.conversationId) return "id:" + row.dataset.conversationId;
    const participant = row.matches(".ce05uz8.contact,.ce05uz0.contact")
      ? row.querySelector('.user-info p, .user-info [data-track-tag="text"], p')
      : null;
    if (participant) {
      const name = compactText(participant).replace(/^@/, "").trim();
      if (name)
        return "url:/inbox/" + encodeURIComponent(name.replace(/\s+/g, "_"));
    }
    return null;
  }
  function storedConversationId(key) {
    if (!key) return null;
    if (key.startsWith("url:")) return key.slice(4).split("?")[0];
    return key.startsWith("id:") ? key.slice(3) : key;
  }
  function createFlag(score, attribute) {
    const flag = document.createElement("span");
    flag.setAttribute(attribute, "true");
    flag.dataset.score = String(score);
    const root = flag.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ':host{display:inline-flex;align-items:center;gap:7px;min-height:28px;margin:2px 6px;padding:4px 9px 4px 5px;border:1px solid var(--risk-border);border-radius:999px;background:var(--risk-bg);color:var(--risk-color);font:600 11px/1.2 system-ui;white-space:nowrap;vertical-align:middle;flex:0 0 auto}.flag-badge{position:relative;display:inline-block;width:20px;height:20px;color:var(--risk-color);vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.12))}.flag-badge:before{content:"";position:absolute;top:2px;left:2px;width:2px;height:16px;border-radius:1px;background:currentColor}.flag-badge:after{content:"";position:absolute;top:3px;left:4px;width:11px;height:8px;border:0;border-radius:1px 1px 1px 0;background:currentColor;clip-path:polygon(0 0,100% 0,78% 50%,100% 100%,0 100%)}.flag-badge:focus-visible{outline:2px solid #192c28;outline-offset:3px}.badge-label{display:inline-block}';
    const badge = document.createElement("span");
    badge.className = "flag-badge";
    const badgeColor = globalThis.fsdRiskColor(score);
    const badgeLabel = globalThis.fsdDisplayRisk(score);
    flag.dataset.state = score === null ? "checking" : "checked";
    flag.style.setProperty("--risk-color", badgeColor);
    flag.style.setProperty(
      "--risk-border",
      score === null
        ? "#d0d5dd"
        : score > 60
          ? "#e2baba"
          : score > 20
            ? "#e6d1a5"
            : "#b9ddc7",
    );
    flag.style.setProperty(
      "--risk-bg",
      score === null
        ? "#f8f9fb"
        : score > 60
          ? "#fff4f4"
          : score > 20
            ? "#fffaf0"
            : "#f1fbf4",
    );
    badge.style.setProperty("--risk-color", badgeColor);
    badge.style.setProperty(
      "--risk-border",
      score > 60 ? "#e2baba" : score > 20 ? "#e6d1a5" : "#b9ddc7",
    );
    badge.style.setProperty(
      "--risk-bg",
      score > 60 ? "#fff4f4" : score > 20 ? "#fffaf0" : "#f1fbf4",
    );
    badge.title =
      badgeLabel + ". This is a local pattern check, not proof of a scam.";
    badge.setAttribute("role", "img");
    badge.tabIndex = 0;
    badge.setAttribute("aria-label", badgeLabel + " conversation status.");
    const label = document.createElement("span");
    label.className = "badge-label";
    label.textContent = badgeLabel;
    root.append(style, badge, label);
    return flag;
  }
  function flagConversation(row, score) {
    const previous = flags.get(row);
    if (previous?.isConnected && previous.dataset.score === String(score))
      return;
    previous?.remove();
    const flag = createFlag(score, "data-fsd-flag");
    const target =
      row.querySelector(".user-info") ||
      row.querySelector('a[href*="/inbox/"]') ||
      row;
    target.append(flag);
    flags.set(row, flag);
  }
  function updateChatFlag(score) {
    if (chatFlag?.isConnected && chatFlag.dataset.score === String(score))
      return;
    chatFlag?.remove();
    chatFlag = undefined;
    if (!/^\/inbox\/[^/]+/.test(location.pathname)) return;
    const root =
      globalThis.fsdConversationDetector?.conversationRoot?.() || document.body;
    const avatar = root.querySelector('[data-track-tag="avatar"]');
    const target =
      root.querySelector('header,[role="banner"]') ||
      avatar?.parentElement?.parentElement?.parentElement ||
      root;
    if (!target) return;
    chatFlag = createFlag(score, "data-fsd-chat-flag");
    target.append(chatFlag);
  }
  function startExtensionHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (running && scannedPath !== location.pathname) {
        conversationScanVersion++;
        currentResults.clear();
        visibleMessages.clear();
        conversationStatus = null;
        chatFlag?.remove();
        chatFlag = undefined;
        scan();
      }
      try {
        const result = chrome.runtime.sendMessage({ type: "FSD_HEARTBEAT" });
        result?.catch(() => {
          document
            .querySelectorAll("[data-fsd-flag],[data-fsd-chat-flag]")
            .forEach((flag) => flag.remove());
          clearInterval(heartbeatTimer);
        });
      } catch {
        document
          .querySelectorAll("[data-fsd-flag],[data-fsd-chat-flag]")
          .forEach((flag) => flag.remove());
        clearInterval(heartbeatTimer);
      }
    }, 1000);
  }
  async function scanConversations(
    messageResults,
    candidates = document.querySelectorAll(rowSelector),
  ) {
    const version = ++conversationScanVersion;
    const path = location.pathname;
    clearTimeout(expiryTimer);
    const now = Date.now();
    for (const [key, record] of conversationScores) {
      if (record.expiresAt <= now) conversationScores.delete(key);
    }
    const rows = new Map();
    for (const candidate of new Set([...candidates, ...knownRows])) {
      if (!candidate.isConnected) continue;
      const row = candidate.closest(rowContainerSelector) || candidate;
      if (row.querySelector(rowContainerSelector)) continue;
      if (row.querySelector(selector) && !row.querySelector(previewSelector))
        continue;
      rows.set(row, conversationKey(row));
      knownRows.add(row);
    }
    const activeId = globalThis.fsdConversationDetector.conversationId();
    const ids = [
      ...new Set(
        [...rows.values()]
          .map(storedConversationId)
          .concat(activeId)
          .filter(Boolean),
      ),
    ];
    let storedScores = {};
    let storedRecords = {};
    if (ids.length) {
      try {
        // Bound each request without dropping conversations in a large inbox.
        for (let offset = 0; offset < ids.length; offset += 500) {
          const response = await chrome.runtime.sendMessage({
            type: "FSD_CONVERSATION_RISK",
            conversationIds: ids.slice(offset, offset + 500),
          });
          Object.assign(storedScores, response?.scores || {});
          Object.assign(storedRecords, response?.records || {});
        }
      } catch {
        /* Fresh local analysis remains available. */
      }
    }
    if (
      !running ||
      version !== conversationScanVersion ||
      path !== location.pathname
    )
      return;
    const freshScores = new Map();
    const currentScore = messageResults.length
      ? conversationRiskScore(messageResults)
      : null;
    let activeScore = currentScore;
    if (activeId && currentScore !== null)
      freshScores.set(activeId, currentScore);
    if (storedScores[activeId] !== undefined)
      activeScore = Math.max(activeScore || 0, storedScores[activeId]);
    for (const [row, key] of rows) {
      if (!row.isConnected || key !== conversationKey(row)) continue;
      if (rowKeys.get(row) !== key) {
        flags.get(row)?.remove();
        flags.delete(row);
        rowKeys.set(row, key);
      }
      let score = 0;
      let checked = false;
      const preview = rowPreview(row);
      if (
        preview &&
        !preview.node.closest(
          '[data-direction="outgoing"],[data-is-own="true"],.outgoing',
        )
      ) {
        const { text, links } = preview;
        if (text || links.length) {
          const linkKey = JSON.stringify(links);
          let cached = previewCache.get(preview.node);
          if (cached?.text !== text || cached?.linkKey !== linkKey) {
            cached = {
              text,
              linkKey,
              result:
                unavailableResult(text) || globalThis.fsdAnalyze(text, links),
            };
            previewCache.set(preview.node, cached);
          }
          score = cached.result.score;
          checked = preview.confirmed || score > 0;
        }
      }
      const active =
        (key && storedConversationId(key) === activeId) ||
        row.matches(
          '[aria-current="page"],[aria-selected="true"],.selected,.active,.active-contact',
        ) ||
        !!row.querySelector('[aria-current="page"],[aria-selected="true"]');
      if (active && currentScore !== null) {
        checked = true;
        score = Math.max(score, currentScore);
      }
      if (key) {
        const id = storedConversationId(key);
        if (checked) {
          freshScores.set(id, score);
          const retained = conversationScores.get(key);
          if (!retained || score >= retained.score)
            conversationScores.set(key, {
              score,
              expiresAt: now + riskRetentionMs,
            });
        }
        const restored = storedRecords[id];
        const retained = conversationScores.get(key);
        if (
          restored?.expiresAt > now &&
          (!retained || restored.score > retained.score)
        )
          conversationScores.set(key, restored);
        checked ||=
          conversationScores.has(key) || storedScores[id] !== undefined;
        score = Math.max(
          score,
          conversationScores.get(key)?.score || 0,
          storedScores[id] || 0,
        );
        if (conversationScores.size > 500)
          conversationScores.delete(conversationScores.keys().next().value);
        flagConversation(row, checked ? score : null);
      } else if (checked && score > 0) flagConversation(row, score);
      if (active && checked) activeScore = Math.max(activeScore || 0, score);
    }
    updateChatFlag(activeScore);
    const entries = [...freshScores];
    for (let offset = 0; offset < entries.length; offset += 500) {
      const batch = entries.slice(offset, offset + 500);
      chrome.runtime
        .sendMessage({
          type: "FSD_CONVERSATION_RISK",
          conversationIds: batch.map(([id]) => id),
          scores: batch.map(([, score]) => score),
        })
        .catch(() => {});
    }
    const expirations = [
      ...conversationScores.values(),
      ...Object.values(storedRecords),
    ]
      .map((record) => record.expiresAt)
      .filter((value) => value > Date.now());
    if (expirations.length)
      expiryTimer = setTimeout(
        () => {
          if (running) void scanConversations(activeResults(), knownRows);
        },
        Math.max(1, Math.min(...expirations) - Date.now()),
      );
  }
  function warn(node, result, identity) {
    if (globalThis.fsdAlertUI) {
      const previous = alerts.get(node);
      if (
        previous?.isConnected &&
        previous.dataset.fsdLevel === result.level &&
        patternAlerts.get(node)?.score === result.score
      )
        return;
      previous?.remove();
      if (result.level !== "green" && result.score < threshold) {
        alerts.delete(node);
        return;
      }
      const host = globalThis.fsdAlertUI.show({
        node,
        result,
        onDismiss:
          result.level === "green"
            ? undefined
            : () => {
                dismissed.set(identity, true);
                if (dismissed.size > 1000)
                  dismissed.delete(dismissed.keys().next().value);
              },
      });
      if (host) alerts.set(node, host);
      return;
    }
    alerts.get(node)?.remove();
    if (result.score < threshold || dismissed.has(identity)) return;
    const host = document.createElement("aside");
    host.dataset.fsdWarning = "true";
    host.style.width = "420px";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ':host{display:block;max-width:100%;min-width:0;margin:8px 0;font:13px/1.5 system-ui;color:#343b38}*{box-sizing:border-box}section{max-width:100%;border:1px solid #d8dedb;border-left:3px solid var(--risk-color);background:#fff;border-radius:6px;padding:12px;overflow-wrap:anywhere}header{display:flex;gap:8px;align-items:center}strong{font-size:13px;color:var(--risk-color);text-transform:uppercase}strong:before{content:"";display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:currentColor}footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}button{font:600 12px/1.4 system-ui;border:1px solid #bfcac4;border-radius:4px;background:#fff;min-height:32px;padding:6px 10px;color:#343b38;cursor:pointer}button:hover{background:#f0f5f2}button:focus-visible{outline:2px solid #176348;outline-offset:2px}p{margin:6px 0}.summary{font-weight:600}.reasons{margin:10px 0 4px;font-weight:700}ul{padding-left:18px;margin:6px 0 8px}li{margin:4px 0}small{display:block;color:#637069}#details{border-top:1px solid #e0e6e2;margin-top:10px;padding-top:4px}[hidden]{display:none!important}';
    host.style.setProperty(
      "--risk-color",
      globalThis.fsdRiskColor(result.score),
    );
    const section = document.createElement("section");
    section.setAttribute("role", "alert");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = globalThis.fsdDisplayRisk(result.score) + " message";
    const hide = document.createElement("button");
    hide.type = "button";
    hide.textContent = "Dismiss";
    hide.title = "Dismiss this message warning";
    hide.addEventListener("click", () => {
      dismissed.set(identity, true);
      if (dismissed.size > 1000)
        dismissed.delete(dismissed.keys().next().value);
      host.remove();
    });
    header.append(title);
    const list = document.createElement("ul");
    if (result.externalCommunication) {
      const li = document.createElement("li");
      li.textContent =
        result.externalCommunication.explanation +
        " Channels: " +
        result.externalCommunication.channels.join(", ") +
        ".";
      list.append(li);
    }
    for (const request of result.sensitiveRequests) {
      const li = document.createElement("li");
      li.textContent = request.explanation + " " + request.action;
      list.append(li);
    }
    for (const signal of result.signals) {
      const li = document.createElement("li");
      li.textContent = signal + ". " + globalThis.fsdSignalAction(signal);
      list.append(li);
    }
    for (const detail of result.linkDetails) {
      const li = document.createElement("li");
      li.textContent = detail;
      li.style.overflowWrap = "anywhere";
      list.append(li);
    }
    const note = document.createElement("small");
    note.textContent =
      "Pattern-based risk score, not proof of a scam. Check the order on Fiverr before acting.";
    const categories = document.createElement("p");
    categories.textContent = globalThis
      .fsdCategoryLabels(result.signals)
      .join(". ");
    categories.style.fontWeight = "600";
    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = result.summary || riskSummary(result);
    const reasonsLabel = document.createElement("p");
    reasonsLabel.className = "reasons";
    reasonsLabel.textContent = "Reasons:";
    const preview = document.createElement("ul");
    for (const signal of result.signals.slice(0, 2)) {
      const li = document.createElement("li");
      li.textContent = signal;
      preview.append(li);
    }
    const details = document.createElement("div");
    details.id = "details";
    details.hidden = true;
    details.append(list, note);
    const expand = document.createElement("button");
    expand.type = "button";
    expand.textContent = "View details";
    expand.setAttribute("aria-expanded", "false");
    expand.setAttribute("aria-controls", "details");
    expand.addEventListener("click", () => {
      details.hidden = !details.hidden;
      expand.textContent = details.hidden ? "View details" : "Hide details";
      expand.setAttribute("aria-expanded", String(!details.hidden));
    });
    const footer = document.createElement("footer");
    footer.append(expand, hide);
    section.append(
      header,
      summary,
      categories,
      reasonsLabel,
      preview,
      details,
      footer,
    );
    root.append(style, section);
    node.after(host);
    alerts.set(node, host);
  }
  function scorePatternMessage(message) {
    if (!patternMatcher || !patternScorer) return null;
    const patternResult = patternMatcher.match({ text: message.text });
    patternResult.urlDetection = globalThis.fsdUrlDetector?.detect?.(
      message.text,
      message.linkMetadata || message.links || [],
    );
    return patternScorer.score(patternResult);
  }
  function displayResult(message, legacyResult) {
    const scoredResult = scorePatternMessage(message);
    const legacySignals = legacyResult.signals || [];
    const legacyCategoryText = legacySignals.some((signal) => /password|verification code|sensitive information|card|bank/i.test(signal))
      ? "Sensitive data request"
      : globalThis.fsdCategoryLabels(legacySignals).join(". ");
    const legacySummary = legacySignals.some((signal) => /password|verification code|phishing|login|identity/i.test(signal))
      ? "This message may be a phishing attempt."
      : riskSummary(legacyResult);
    if (!scoredResult) {
      return {
        ...legacyResult,
        level: legacyResult.score >= 60 ? "red" : legacyResult.score >= 30 ? "yellow" : "green",
        reasons: legacySignals,
        categories: globalThis.fsdCategoryLabels(legacyResult.signals),
        categoryText: legacyCategoryText,
        summary: legacySummary,
      };
    }
    const categoryLabels = {
      account_credentials: "Sensitive data request",
      personal_information: "Sensitive data request",
      external_contact: "External communication request",
      off_platform_communication: "External communication request",
      phishing: "Possible phishing",
      fake_support: "Possible fake support",
      payment_request: "Possible payment scam",
      off_platform_payment: "Possible payment scam",
      malicious_download: "Possible unsafe software",
      urgency: "Pressure tactics",
    };
    const legacyLabels = globalThis.fsdCategoryLabels(legacyResult.signals);
    const matchedLabels = scoredResult.categories.map((category) => categoryLabels[category]).filter(Boolean);
    return {
      ...scoredResult,
      categoryText: [...new Set([legacyCategoryText, ...legacyLabels, ...matchedLabels].filter(Boolean))].join(". "),
      summary: `${scoredResult.level === "red" ? "This message contains multiple suspicious indicators." : "This message contains potentially risky patterns."} ${legacySummary}`,
    };
  }
  function refreshPatternAlerts() {
    if (!running) return;
    for (const node of currentResults.keys()) {
      if (!node.isConnected) continue;
      const message = globalThis.fsdMessageExtractor.extractMessage(node);
      const result = message && displayResult(message, currentResults.get(node));
      if (!result) continue;
      patternAlerts.set(node, result);
      warn(node, result, warningIdentity(message));
    }
  }
  function scan(batch) {
    if (!running) return;
    let full = !batch;
    if (scannedPath !== location.pathname) {
      scannedPath = location.pathname;
      full = true;
      for (const node of currentResults.keys()) alerts.get(node)?.remove();
      currentResults.clear();
      visibleMessages.clear();
      conversationStatus = null;
      chatFlag?.remove();
      chatFlag = undefined;
      noticePath = location.pathname;
      clearPreviousNotice();
      visibilityVersion++;
    }
    const results = [];
    const evidence = [];
    const observations = [];
    const nodes = full
      ? new Set([
          ...currentResults.keys(),
          ...document.querySelectorAll(candidateSelector),
        ])
      : new Set(batch.messages);
    const rows = full ? document.querySelectorAll(rowSelector) : batch.rows;
    for (const node of currentResults.keys()) {
      if (!node.isConnected) {
        currentResults.delete(node);
        visibleMessages.delete(node);
        alerts.get(node)?.remove();
      }
    }
    for (const row of knownRows) if (!row.isConnected) knownRows.delete(row);
    for (const [node] of visibleMessages)
      if (!node.isConnected) visibleMessages.delete(node);
    for (const node of nodes) {
      currentResults.delete(node);
      visibleMessages.delete(node);
      const deletedId = globalThis.fsdMessageDetector.deletedId(node);
      if (deletedId) {
        const conversationId =
          globalThis.fsdConversationDetector.conversationId(node);
        observeMessage({ node, id: deletedId, conversationId });
        visibleMessages.get(node).deleted = true;
        alerts.get(node)?.remove();
        continue;
      }
      const message = globalThis.fsdMessageExtractor.extract(node);
      if (!message) {
        alerts.get(node)?.remove();
        seen.delete(node);
        continue;
      }
      const { text, linkMetadata: links } = message;
      observeMessage({ ...message, node });
      const linkKey = JSON.stringify(links);
      const cached = seen.get(node);
      const changed =
        cached?.text !== text ||
        cached?.linkKey !== linkKey ||
        cached?.id !== message.id ||
        cached?.conversationId !== message.conversationId;
      const result = changed
        ? globalThis.fsdAnalyzeMessage(message)
        : cached.result;
      currentResults.set(node, result);
      const alertResult = displayResult(message, result);
      patternAlerts.set(node, alertResult);
      // Refresh presentation independently of analysis and result persistence.
      // Ordinary DOM updates leave dismissed warnings hidden.
      if (
        changed ||
        cached.threshold !== threshold ||
        !alerts.get(node)?.isConnected
      ) {
        seen.set(node, {
          id: message.id,
          conversationId: message.conversationId,
          text,
          linkKey,
          result,
          threshold,
        });
        warn(node, alertResult, warningIdentity(message));
      }
      if (changed)
        results.push({
          score: result.score,
          signals: result.signals,
          checkedAt: Date.now(),
        }); // Metadata only, no link details.
      if (changed && message.conversationId)
        observations.push({
          id: message.id,
          conversationId: message.conversationId,
          sender: message.sender,
          senderType: "other",
          text: message.text,
          links: message.links,
          riskScore: result.score,
          riskLevel: result.risk,
          categories: result.categories,
          signals: result.signals,
          matches: result.matches,
        });
      if (changed && globalThis.fsdMessageHistory?.saveMessage) {
        globalThis.fsdMessageHistory.saveMessage({
          id: message.id,
          conversationId: message.conversationId,
          riskLevel: alertResult.level,
          score: alertResult.score,
          categories: alertResult.categories,
          detectedAt: Date.now(),
        }).catch(() => {});
      }
      if (changed && result.score >= 61)
        evidence.push({
          id: message.id,
          conversationId: message.conversationId,
          sender: message.sender,
          message: message.text,
          links: message.links,
          riskScore: result.score,
          categories: result.categories,
        });
    }
    const status = globalThis.fsdConversationDetector.isLoading()
      ? null
      : statusResult();
    const statusChanged =
      status &&
      (conversationStatus?.conversationId !== status.conversationId ||
        conversationStatus?.text !== status.text);
    conversationStatus = status;
    if (statusChanged) {
      results.push({
        score: status.result.score,
        signals: status.result.signals,
        checkedAt: Date.now(),
      });
    }
    messageCount = currentResults.size + (conversationStatus ? 1 : 0);
    if (!full && nodes.size) {
      for (const row of knownRows) {
        const key = conversationKey(row);
        if (
          row.matches(
            '[aria-current="page"],[aria-selected="true"],.selected,.active,.active-contact',
          ) ||
          row.querySelector('[aria-current="page"],[aria-selected="true"]') ||
          key === "url:" + location.pathname + location.search
        )
          rows.add(row);
      }
    }
    scanConversations(
      [
        ...activeResults(),
        ...(conversationStatus ? [conversationStatus.result] : []),
      ],
      rows,
    );
    if (results.length)
      chrome.runtime
        .sendMessage({ type: "FSD_RESULTS", results, evidence, observations })
        .catch(() => {});
    scheduleVisibility();
  }
  const hasMessageObserver = Boolean(globalThis.fsdMessageObserver?.create);
  const detector = globalThis.fsdMessageDetector.create({
    onBatch: scan,
    hasMessage: (node) => currentResults.has(node),
    hasRow: (node) => knownRows.has(node),
    observeMessages: true,
  });
  const messageObserver = hasMessageObserver
    ? globalThis.fsdMessageObserver.create({
        onMessageAdded: (message) =>
          scan({ messages: [message.element], rows: new Set() }),
        onMessageRemoved: (message) => {
          const node = message.element;
          currentResults.delete(node);
          visibleMessages.delete(node);
          alerts.get(node)?.remove();
          deletedMessageDetector?.inspect?.(message).catch(() => {});
          scheduleVisibility();
        },
      })
    : { start() {}, stop() {} };
  const draftGuard = globalThis.fsdDraftGuard.create();
  function setRunning(enabled) {
    if (running === enabled) return;
    running = enabled;
    conversationScanVersion++;
    detector.stop();
    messageObserver.stop();
    deletedMessageDetector?.reset?.();
    deletedMessageNotice?.remove();
    deletedMessageNotice = undefined;
    draftGuard.stop();
    currentResults.clear();
    visibleMessages.clear();
    conversationStatus = null;
    chatFlag?.remove();
    chatFlag = undefined;
    clearTimeout(visibilityTimer);
    visibilityTimer = undefined;
    visibilityVersion++;
    clearPreviousNotice();
    knownRows.clear();
    clearTimeout(expiryTimer);
    if (running) {
      seen = new WeakMap();
      dismissed.clear();
      detector.start();
      messageObserver.start();
      globalThis.fsdMessageHistory?.removeOldMessages?.().catch(() => {});
      draftGuard.start();
      setTimeout(() => {
        if (running) scan();
      }, 500);
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "FSD_STATUS") {
      if (noticePath !== location.pathname) {
        noticePath = location.pathname;
        clearPreviousNotice();
        visibilityVersion++;
        if (!/^\/inbox\/[^/]+/.test(location.pathname))
          conversationStatus = null;
        if (running) scheduleVisibility();
      }
      const selectedConversation = /^\/inbox\/[^/]+/.test(location.pathname);
      respond({
        running,
        supported: true,
        messageCount: running && selectedConversation ? messageCount : 0,
        conversationPage: /^\/inbox(?:\/|$)/.test(location.pathname),
        selectedConversation,
        conversation: globalThis.fsdConversationDetector?.inspect?.() || null,
      });
      return;
    }
    if (message?.type === "FSD_SCAN" && running) scan();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.fsd_cache_reset) {
      conversationScanVersion++;
      conversationScores.clear();
    }
    if (area === "local" && changes.fsd_threshold) {
      threshold = Number.isInteger(changes.fsd_threshold.newValue)
        ? Math.max(1, Math.min(100, changes.fsd_threshold.newValue))
        : 21;
      if (running) scan();
    }
    if (area === "local" && changes.fsd_enabled) {
      storageVersion++;
      setRunning(changes.fsd_enabled.newValue === true);
    }
    if (area === "local" && changes.fsd_vault_revision && running) {
      scheduleVisibility();
      void scanConversations(
        [
          ...activeResults(),
          ...(conversationStatus ? [conversationStatus.result] : []),
        ],
        knownRows,
      );
    }
  });
  const version = storageVersion;
  chrome.storage.local
    .get(["fsd_enabled", "fsd_threshold"])
    .then((data) => {
      threshold = Number.isInteger(data.fsd_threshold)
        ? Math.max(1, Math.min(100, data.fsd_threshold))
        : 21;
      if (version === storageVersion) setRunning(data.fsd_enabled !== false);
    })
    .catch(() => {});
  startExtensionHeartbeat();
})();
