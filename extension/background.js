/* global chrome */
importScripts("evidence-vault.js");
let queue = Promise.resolve();
const contentScriptFiles = [
  "extension/link-scanner.js",
  "extension/sensitive-information.js",
  "extension/analyzer.js",
  "extension/message-detector.js",
  "extension/message-extractor.js",
  "extension/conversation-detector.js",
  "extension/draft-guard.js",
  "extension/content-script.js",
];
function injectIntoFiverrTabs() {
  chrome.tabs
    .query({ url: ["https://fiverr.com/*", "https://*.fiverr.com/*"] })
    .then((tabs) =>
      Promise.all(
        tabs
          .filter((tab) => Number.isInteger(tab.id))
          .map((tab) =>
            chrome.scripting
              .executeScript({
                target: { tabId: tab.id },
                files: contentScriptFiles,
              })
              .catch(() => {}),
          ),
      ),
    )
    .catch(() => {});
}
chrome.runtime.onInstalled.addListener(injectIntoFiverrTabs);
chrome.runtime.onStartup.addListener(injectIntoFiverrTabs);
function evidenceRecords(values) {
  if (!Array.isArray(values)) return [];
  const optionalText = (value) =>
    value === null || (typeof value === "string" && value.length <= 2048);
  return values
    .filter(
      (record) =>
        record &&
        typeof record.id === "string" &&
        record.id.length <= 2048 &&
        optionalText(record.sender) &&
        optionalText(record.conversationId) &&
        typeof record.message === "string" &&
        record.message.length <= 12000 &&
        Number.isInteger(record.riskScore) &&
        record.riskScore >= 61 &&
        record.riskScore <= 100 &&
        Array.isArray(record.links) &&
        record.links.length <= 100 &&
        record.links.every(
          (link) => typeof link === "string" && link.length <= 4096,
        ) &&
        Array.isArray(record.categories) &&
        record.categories.length <= 20 &&
        record.categories.every(
          (category) =>
            typeof category === "string" && /^[A-Z_]{1,50}$/.test(category),
        ),
    )
    .map((record) => ({
      id: record.id,
      conversationId: record.conversationId,
      sender: record.sender,
      message: record.message,
      links: record.links,
      riskScore: record.riskScore,
      categories: record.categories,
      capturedAt: new Date().toISOString(),
    }));
}
function observationRecords(values) {
  if (!Array.isArray(values)) return [];
  const optionalText = (value) =>
    value === null || (typeof value === "string" && value.length <= 2048);
  const riskLevel = (score) =>
    score <= 20
      ? "SAFE"
      : score <= 40
        ? "LOW"
        : score <= 60
          ? "SUSPICIOUS"
          : score <= 80
            ? "HIGH"
            : "CRITICAL";
  const validMatch = (match) =>
    match &&
    typeof match.ruleId === "string" &&
    match.ruleId.length <= 80 &&
    typeof match.category === "string" &&
    /^[A-Z_]{1,50}$/.test(match.category) &&
    Number.isInteger(match.score) &&
    match.score >= 0 &&
    match.score <= 100 &&
    typeof match.explanation === "string" &&
    match.explanation.length <= 200 &&
    typeof match.action === "string" &&
    match.action.length <= 300;
  const cleanMatch = (match) => ({
    ruleId: match.ruleId,
    category: match.category,
    score: match.score,
    explanation: match.explanation,
    action: match.action,
  });
  return values
    .filter(
      (record) =>
        record &&
        typeof record.id === "string" &&
        record.id.length <= 2048 &&
        typeof record.conversationId === "string" &&
        record.conversationId.length <= 2048 &&
        optionalText(record.sender) &&
        typeof record.text === "string" &&
        record.text.length <= 12000 &&
        (record.senderType === "other" || record.senderType === "system") &&
        Array.isArray(record.links) &&
        record.links.length <= 100 &&
        record.links.every(
          (link) => typeof link === "string" && link.length <= 4096,
        ) &&
        Number.isInteger(record.riskScore) &&
        record.riskScore >= 0 &&
        record.riskScore <= 100 &&
        Array.isArray(record.categories) &&
        record.categories.length <= 20 &&
        record.categories.every(
          (category) =>
            typeof category === "string" && /^[A-Z_]{1,50}$/.test(category),
        ) &&
        Array.isArray(record.signals) &&
        record.signals.length <= 20 &&
        record.signals.every(
          (signal) => typeof signal === "string" && signal.length <= 150,
        ) &&
        (!record.matches ||
          (Array.isArray(record.matches) &&
            record.matches.length <= 20 &&
            record.matches.every(validMatch))),
    )
    .slice(0, 1000)
    .map((record) => ({
      id: record.id,
      conversationId: record.conversationId,
      sender: record.sender,
      senderType: record.senderType,
      text: record.text,
      links: record.links,
      riskScore: record.riskScore,
      riskLevel: riskLevel(record.riskScore),
      categories: record.categories,
      signals: record.signals,
      matches: Array.isArray(record.matches)
        ? record.matches.map(cleanMatch)
        : [],
      seenAt: new Date().toISOString(),
    }));
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "FSD_HEARTBEAT") {
    respond({ ok: true });
    return;
  }
  const extensionPage =
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(chrome.runtime.getURL("extension/"));
  if (message?.type === "FSD_VISIBILITY" && sender.tab) {
    let url;
    try {
      url = new URL(sender.url);
    } catch {
      return;
    }
    const ids = (values) =>
      Array.isArray(values) &&
      values.length <= 10000 &&
      values.every(
        (value) => typeof value === "string" && value.length <= 2048,
      );
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com")
      ) ||
      !/^\/inbox\/[^/]+/.test(url.pathname) ||
      typeof message.conversationId !== "string" ||
      message.conversationId.length > 2048 ||
      !ids(message.visibleIds) ||
      !ids(message.observedIds)
    )
      return;
    queue = queue.then(async () => {
      const state = await chrome.storage.local.get("fsd_enabled");
      if (state.fsd_enabled === false) return { ok: false };
      return {
        ok: true,
        ...(await fsdEvidenceVault.missing(
          message.conversationId,
          message.visibleIds,
          message.observedIds,
        )),
      };
    });
  } else if (message?.type === "FSD_CONVERSATION_RISK" && sender.tab) {
    let url;
    try {
      url = new URL(sender.url);
    } catch {
      return;
    }
    const ids = (values) =>
      Array.isArray(values) &&
      values.length <= 500 &&
      values.every(
        (value) => typeof value === "string" && value.length <= 2048,
      );
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com")
      ) ||
      !ids(message.conversationIds)
    )
      return;
    queue = queue.then(async () => {
      const state = await chrome.storage.local.get("fsd_enabled");
      if (state.fsd_enabled === false) return { ok: false };
      const conversationIds = message.conversationIds.map((id) =>
        id.startsWith("url:") ? id.slice(4).split("?")[0] : id,
      );
      return { ok: true, scores: await fsdEvidenceVault.risk(conversationIds) };
    });
  } else if (message?.type === "FSD_OPEN_EVIDENCE" && sender.tab) {
    let url;
    try {
      url = new URL(sender.url);
    } catch {
      return;
    }
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com")
      ) ||
      typeof message.conversationId !== "string" ||
      message.conversationId.length > 2048
    )
      return;
    queue = queue.then(async () => {
      await chrome.tabs.create({
        url: chrome.runtime.getURL(
          "extension/options.html?conversation=" +
            encodeURIComponent(message.conversationId) +
            "#conversation-evidence",
        ),
      });
      return { ok: true };
    });
  } else if (message?.type === "FSD_VAULT_LIST" && extensionPage) {
    queue = queue.then(async () => ({
      ok: true,
      ...(await fsdEvidenceVault.list(
        Number.isInteger(message.offset) ? Math.max(0, message.offset) : 0,
      )),
    }));
  } else if (message?.type === "FSD_CONVERSATION_EVIDENCE" && extensionPage) {
    queue = queue.then(async () => {
      if (
        typeof message.conversationId !== "string" ||
        message.conversationId.length > 2048
      )
        throw Error("Invalid conversation");
      return {
        ok: true,
        ...(await fsdEvidenceVault.details(message.conversationId)),
      };
    });
  } else if (message?.type === "FSD_VAULT_DELETE" && extensionPage) {
    queue = queue.then(async () => {
      if (
        message.key !== undefined &&
        (typeof message.key !== "string" || !/^[a-f0-9]{64}$/.test(message.key))
      )
        throw Error("Invalid evidence key");
      await fsdEvidenceVault.remove(message.key);
      await chrome.storage.local.set({ fsd_vault_revision: Date.now() });
      return { ok: true };
    });
  } else if (message?.type === "FSD_CLEAR" && extensionPage) {
    queue = queue.then(async () => {
      await chrome.storage.local.remove([
        "fsd_history",
        "fsd_last_result",
        "fsd_highest_result",
      ]);
      await fsdEvidenceVault.remove();
      await chrome.storage.local.set({ fsd_vault_revision: Date.now() });
      return { ok: true };
    });
  } else if (message?.type === "FSD_RESULTS" && sender.tab) {
    let url;
    try {
      url = new URL(sender.url);
    } catch {
      return;
    }
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com"))
    )
      return;
    const results = Array.isArray(message.results)
      ? message.results
          .filter(
            (result) =>
              Number.isInteger(result?.score) &&
              result.score >= 0 &&
              result.score <= 100 &&
              Array.isArray(result.signals) &&
              result.signals.every(
                (signal) => typeof signal === "string" && signal.length <= 150,
              ),
          )
          .map((result) => ({
            score: result.score,
            signals: result.signals.slice(0, 12),
            checkedAt: Date.now(),
          }))
      : [];
    if (!results.length) return;
    queue = queue.then(async () => {
      const data = await chrome.storage.local.get([
        "fsd_enabled",
        "fsd_keep_history",
        "fsd_history",
        "fsd_last_result",
        "fsd_highest_result",
      ]);
      if (data.fsd_enabled === false) return { ok: false };
      try {
        const records = evidenceRecords(message.evidence);
        const observations = observationRecords(message.observations);
        await fsdEvidenceVault.observe(observations);
        await fsdEvidenceVault.save(records);
        await chrome.storage.local.remove("fsd_vault_error");
        if (records.length || observations.length)
          await chrome.storage.local.set({ fsd_vault_revision: Date.now() });
      } catch {
        await chrome.storage.local.set({
          fsd_vault_error:
            "Evidence could not be saved. Device storage may be full.",
        });
      }
      const update = { fsd_last_result: results[results.length - 1] };
      const candidates = [
        data.fsd_highest_result,
        data.fsd_last_result,
        ...results,
      ].filter(Boolean);
      update.fsd_highest_result = candidates.reduce((highest, result) =>
        result.score >= highest.score ? result : highest,
      );
      if (data.fsd_keep_history)
        update.fsd_history = [
          ...(Array.isArray(data.fsd_history) ? data.fsd_history : []),
          ...results,
        ].slice(-100);
      await chrome.storage.local.set(update);
      return { ok: true };
    });
  } else return;
  queue.then(respond, (error) => respond({ ok: false, error: error.message }));
  queue = queue.catch(() => {});
  return true;
});
