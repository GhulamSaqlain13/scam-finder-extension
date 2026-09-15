/* global chrome */
(() => {
  let offset = 0;
  const notice = document.getElementById("vault-notice");
  const params = new URLSearchParams(location.search);
  const conversationId = params.get("conversation");
  function timeLabel(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : "Time unknown";
  }
  function reasonText(record) {
    const matches = Array.isArray(record.matches) ? record.matches : [];
    const reasons = matches.map(match => match.explanation).filter(Boolean);
    for (const signal of record.signals || []) if (!reasons.includes(signal)) reasons.push(signal);
    return reasons.slice(0, 8);
  }
  async function loadConversationEvidence() {
    const section = document.getElementById("conversation-evidence");
    if (!section || !conversationId) return;
    section.hidden = false;
    const status = document.getElementById("conversation-evidence-status");
    const records = document.getElementById("conversation-evidence-records");
    const note = document.getElementById("conversation-evidence-note");
    try {
      const response = await chrome.runtime.sendMessage({ type: "FSD_CONVERSATION_EVIDENCE", conversationId });
      if (!response?.ok) throw Error();
      const conversation = response.conversation || {};
      const messages = response.messages || [];
      const disappeared = messages.filter(message => message.disappearedAt);
      status.textContent = globalThis.fsdRiskLabel(conversation.conversationRiskScore || conversation.highestRiskScore || 0) + " risk";
      records.replaceChildren();
      const summary = document.createElement("article");
      const title = document.createElement("strong"); title.textContent = "Conversation: " + (conversation.participants?.[0] || conversation.conversationId || conversationId);
      const state = document.createElement("p"); state.textContent = "Status: " + status.textContent.toUpperCase();
      const count = document.createElement("p"); count.textContent = "Previously captured messages: " + messages.length;
      const current = document.createElement("p");
      current.textContent = disappeared.length
        ? "Current Fiverr status: previously detected suspicious messages are no longer visible in this conversation. They may have been removed by Fiverr, hidden by pagination, or affected by a Fiverr UI change."
        : "Current Fiverr status: no previously flagged message is marked as disappeared right now.";
      summary.append(title, state, count, current);
      records.append(summary);
      for (const message of messages) {
        const row = document.createElement("article");
        const heading = document.createElement("strong"); heading.textContent = timeLabel(message.capturedAt);
        const text = document.createElement("p"); text.textContent = '"' + message.text + '"'; text.style.whiteSpace = "pre-wrap";
        const risk = document.createElement("p"); risk.textContent = "Risk: " + globalThis.fsdRiskLabel(message.riskScore);
        const reasons = reasonText(message);
        const reason = document.createElement("p"); reason.textContent = reasons.length ? "Reason: " + reasons.join("; ") : "Reason: no stored rule details.";
        const visibility = document.createElement("small");
        visibility.textContent = message.disappearedAt ? "No longer visible since " + timeLabel(message.disappearedAt) : "Still visible in the latest snapshot.";
        row.style.overflowWrap = "anywhere";
        row.append(heading, text, risk, reason, visibility);
        records.append(row);
      }
      if (!messages.length) {
        const empty = document.createElement("p");
        empty.textContent = "No captured suspicious messages were found for this conversation.";
        records.append(empty);
      }
      note.textContent = "This viewer shows local evidence captured by the extension. It cannot prove Fiverr deleted a message; it can only show that a previously detected suspicious message is no longer visible.";
      section.scrollIntoView({ block: "start" });
    } catch {
      status.textContent = "Could not load";
      note.textContent = "Could not load conversation evidence.";
    }
  }
  async function load() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "FSD_VAULT_LIST", offset });
      if (!response?.ok) throw Error();
      if (offset && !response.rows.length) { offset = Math.max(0, offset - 25); return load(); }
      const container = document.getElementById("vault-records");
      container.replaceChildren();
      document.getElementById("vault-count").textContent = response.total + " records";
      for (const record of response.rows) {
        const row = document.createElement("article");
        const heading = document.createElement("strong"); heading.textContent = globalThis.fsdRiskLabel(record.riskScore) + " - " + (record.sender || "Unknown sender");
        const context = document.createElement("small"); context.textContent = (record.conversationId || "Unknown conversation") + " | " + record.capturedAt;
        const text = document.createElement("p"); text.textContent = record.message; text.style.whiteSpace = "pre-wrap";
        const categories = document.createElement("p"); categories.textContent = record.categories.join(", ");
        const links = document.createElement("p"); links.textContent = record.links.join("\n"); links.style.whiteSpace = "pre-wrap";
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "secondary"; remove.textContent = "Delete evidence";
        remove.addEventListener("click", async () => {
          remove.disabled = true;
          try {
            const result = await chrome.runtime.sendMessage({ type: "FSD_VAULT_DELETE", key: record.key });
            if (!result?.ok) throw Error();
            await load();
          } catch { notice.textContent = "Could not delete evidence."; remove.disabled = false; }
        });
        row.style.overflowWrap = "anywhere"; row.append(heading, context, text, categories, links, remove); container.append(row);
      }
      if (!response.total) container.textContent = "No saved evidence.";
      document.getElementById("vault-prev").disabled = offset === 0;
      document.getElementById("vault-next").disabled = offset + 25 >= response.total;
      const state = await chrome.storage.local.get("fsd_vault_error");
      notice.textContent = state.fsd_vault_error || "";
    } catch { notice.textContent = "Could not load the evidence vault."; }
  }
  document.getElementById("vault-prev").addEventListener("click", () => { offset = Math.max(0, offset - 25); void load(); });
  document.getElementById("vault-next").addEventListener("click", () => { offset += 25; void load(); });
  document.getElementById("vault-refresh").addEventListener("click", () => { void load(); });
  document.getElementById("vault-clear").addEventListener("click", async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: "FSD_VAULT_DELETE" });
      if (!result?.ok) throw Error();
      offset = 0; await load();
    } catch { notice.textContent = "Could not clear the evidence vault."; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.fsd_last_result || changes.fsd_vault_error)) void load();
  });
  void loadConversationEvidence();
  void load();
})();
