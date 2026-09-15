/* global chrome */
const button = document.getElementById("run");
const status = document.getElementById("status");
const notice = document.getElementById("notice");
let enabled = true;
let statusVersion = 0;
function setStatus(text, monitoring = false) {
  status.textContent = text;
  document.body.dataset.monitoring = String(monitoring);
  const ownVisible =
    "This conversation is open, but only your own replies or Fiverr system text are visible right now.";
  if (text === "No incoming messages detected") notice.textContent = ownVisible;
  else if (notice.textContent === ownVisible) notice.textContent = "";
}
function friendlySignal(signal) {
  if (
    signal === "Fiverr contact unavailable" ||
    signal === "Fiverr contact is no longer available"
  ) {
    return "This account is no longer available on Fiverr. Be careful if you were asked to continue elsewhere";
  }
  return signal;
}
function isFiverr(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "fiverr.com" ||
        parsed.hostname.endsWith(".fiverr.com"))
    );
  } catch {
    return false;
  }
}
async function refreshStatus() {
  const version = ++statusVersion;
  if (!enabled) {
    setStatus("Stopped");
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (version !== statusVersion) return;
    if (!isFiverr(tab?.url)) {
      setStatus("Open a Fiverr conversation");
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "FSD_STATUS",
    });
    if (version !== statusVersion) return;
    if (!response?.supported || !response.running)
      setStatus("Waiting for protection to connect");
    else if (response.messageCount > 0)
      setStatus("Monitoring this conversation", true);
    else if (response.selectedConversation)
      setStatus("No incoming messages detected");
    else
      setStatus(
        response.conversationPage
          ? "Select a Fiverr conversation"
          : "Open a Fiverr conversation",
      );
    renderConversation(response.conversation);
  } catch {
    if (version === statusVersion) setStatus("Cannot connect to this tab");
  }
}
function renderConversation(conversation) {
  const state = document.getElementById("conversation-state");
  const summary = document.getElementById("conversation-summary");
  if (!state || !summary) return;
  if (!conversation?.selected) {
    state.textContent = conversation?.foundConversationArea
      ? "Inbox list"
      : "Not open";
    summary.replaceChildren();
    return;
  }
  state.textContent = conversation.foundConversationArea
    ? "Chat found"
    : "Waiting";
  const items = [
    [
      "Chat with",
      conversation.participants?.length
        ? conversation.participants.join(", ")
        : "Participant not identified",
    ],
    ["Messages from them", String(conversation.counts?.incoming || 0)],
    ["Your messages", String(conversation.counts?.outgoing || 0)],
    ["Fiverr notices", String(conversation.counts?.system || 0)],
  ];
  summary.replaceChildren(
    ...items.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}
function render(data) {
  if ("fsd_enabled" in data || !document.body.dataset.running) {
    if ("fsd_enabled" in data) enabled = data.fsd_enabled !== false;
    setStatus(enabled ? "Checking this tab..." : "Stopped");
    document.body.dataset.running = String(enabled);
    button.textContent = enabled ? "Stop protection" : "Run protection";
    void refreshStatus();
  }
  for (const [key, prefix] of [
    ["fsd_last_result", ""],
    ["fsd_highest_result", "highest-"],
  ]) {
    if (!(key in data)) continue;
    const result = data[key];
    const risk = document.getElementById(prefix + "risk");
    risk.textContent = result
      ? globalThis.fsdRiskLabel(result.score)
      : "No messages checked";
    risk.style.color = result ? globalThis.fsdRiskColor(result.score) : "";
    let categories = document.getElementById(prefix + "categories");
    if (!categories) {
      categories = document.createElement("p");
      categories.id = prefix + "categories";
      categories.className = "category-summary";
      risk.after(categories);
    }
    categories.textContent = globalThis
      .fsdCategoryLabels(result?.signals || [])
      .join(". ");
    categories.hidden = !categories.textContent;
    document.getElementById(prefix + "signals").replaceChildren(
      ...(result?.signals || []).map((signal) => {
        const li = document.createElement("li");
        li.textContent =
          friendlySignal(signal) + ". " + globalThis.fsdSignalAction(signal);
        return li;
      }),
    );
    document.getElementById(prefix + "checked-at").textContent = result
      ? new Date(result.checkedAt).toLocaleString()
      : "";
  }
}
chrome.storage.local
  .get(["fsd_enabled", "fsd_last_result", "fsd_highest_result"])
  .then((data) => {
    data.fsd_highest_result ??= data.fsd_last_result;
    render(data);
    button.disabled = false;
  })
  .catch(() => {
    notice.textContent =
      "Could not load protection state. Reopen the extension.";
  });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local")
    render(
      Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [key, value.newValue]),
      ),
    );
});
// The popup owns this timer; closing it ends polling. Counts never enter storage.
const statusTimer = setInterval(refreshStatus, 1000);
window.addEventListener("pagehide", () => clearInterval(statusTimer));
chrome.tabs.onActivated.addListener(() => {
  void refreshStatus();
});
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status || change.url) void refreshStatus();
});
button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    if (!enabled) {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const url = new URL(tab?.url || "about:blank");
      if (
        url.protocol !== "https:" ||
        !(url.hostname === "fiverr.com" || url.hostname.endsWith(".fiverr.com"))
      )
        throw Error("Open a Fiverr conversation, then press Run.");
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "FSD_STATUS",
        });
      } catch {
        /* An already-open tab may not have the content scripts yet. */
      }
      if (!response?.supported) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
              "extension/link-scanner.js",
              "extension/sensitive-information.js",
              "extension/analyzer.js",
              "extension/message-detector.js",
              "extension/message-extractor.js",
              "extension/conversation-detector.js",
              "extension/draft-guard.js",
              "extension/content-script.js",
            ],
          });
          response = await chrome.tabs.sendMessage(tab.id, {
            type: "FSD_STATUS",
          });
        } catch {
          throw Error(
            "Could not connect to this Fiverr tab. Wait for it to finish loading, then press Run again.",
          );
        }
      }
      if (!response?.supported)
        throw Error(
          "This Fiverr tab is still loading. Please press Run again when it is ready.",
        );
    }
    const nextEnabled = !enabled;
    await chrome.storage.local.set({ fsd_enabled: nextEnabled });
    render({ fsd_enabled: nextEnabled });
    notice.textContent = nextEnabled
      ? "Protection enabled for open Fiverr tabs."
      : "Protection stopped. Existing warnings remain visible.";
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
