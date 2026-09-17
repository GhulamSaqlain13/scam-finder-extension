(() => {
  const icon = { green: "\u{1f7e2}", yellow: "\u{1f7e1}", red: "\u{1f534}" };
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

  function show({ node, result, onDismiss } = {}) {
    if (!node || !result) return null;
    const level =
      result.level ||
      (result.score >= 60 ? "red" : result.score >= 30 ? "yellow" : "green");
    const host = document.createElement(level === "green" ? "span" : "aside");
    host.dataset.fsdAlert = "true";
    if (level !== "green") host.dataset.fsdWarning = "true";
    host.dataset.fsdLevel = level;
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ':host{font:13px/1.5 system-ui,sans-serif;color:#26332d}*{box-sizing:border-box}.indicator{display:inline-flex;align-items:center;margin:0 6px;cursor:default}.indicator:focus-visible{outline:2px solid #176348;outline-offset:2px}section{width:min(420px,100%);max-width:100%;margin:8px 0;border:1px solid #d8dedb;border-left:4px solid var(--risk-color);border-radius:6px;background:#fff;padding:12px;overflow-wrap:anywhere;box-shadow:0 2px 8px rgba(20,40,30,.08)}header{display:flex;align-items:center;gap:7px}strong{color:var(--risk-color);font-size:13px;text-transform:uppercase}strong:before{content:"\\1F534";margin-right:7px}p{margin:7px 0}.summary{font-weight:600}.score{font-weight:700}.reasons{margin:10px 0 4px;font-weight:700}ul{margin:6px 0 8px;padding-left:20px}li{margin:4px 0}footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}button{min-height:32px;padding:6px 10px;border:1px solid #bfcac4;border-radius:4px;background:#fff;color:#26332d;font:600 12px/1.4 system-ui,sans-serif;cursor:pointer}button:hover{background:#f0f5f2}button:focus-visible{outline:2px solid #176348;outline-offset:2px}#details{border-top:1px solid #e0e6e2;margin-top:10px;padding-top:4px}[hidden]{display:none!important}@media(max-width:480px){section{margin:6px 0;padding:10px}footer button{flex:1 1 120px}}';
    const color =
      level === "red" ? "#b23b3b" : level === "yellow" ? "#b47716" : "#238052";
    host.style.setProperty("--risk-color", color);

    if (level === "green") {
      const indicator = document.createElement("span");
      indicator.className = "indicator";
      indicator.textContent = icon.green;
      indicator.title = "Safe message indicator";
      indicator.setAttribute("role", "img");
      indicator.setAttribute("aria-label", "Safe message");
      indicator.tabIndex = 0;
      root.append(style, indicator);
      node.after(host);
      return host;
    }

    const section = document.createElement("section");
    section.setAttribute("role", "alert");
    section.setAttribute("aria-live", "polite");
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent =
      level === "red" ? "High Risk message" : "Suspicious message";
    header.append(title);
    const summary = document.createElement("p");
    summary.className = "summary";
    const categoryText = result.categoryText || [...new Set((result.categories || []).map((category) => categoryLabels[category]).filter(Boolean))].join(". ");
    summary.textContent =
      (result.summary ||
        (level === "red"
          ? "This message contains multiple suspicious indicators."
          : "This message contains potentially risky patterns.")) +
      (categoryText ? ` ${categoryText}` : "");
    const score = document.createElement("p");
    score.className = "score";
    score.textContent = `Risk Score: ${result.score}`;
    const reasonsLabel = document.createElement("p");
    reasonsLabel.className = "reasons";
    reasonsLabel.textContent = "Reasons:";
    const preview = document.createElement("ul");
    const reasons = [...new Set(result.reasons || [])];
    for (const reason of reasons.slice(0, 3)) {
      const item = document.createElement("li");
      item.textContent = reason;
      preview.append(item);
    }
    const details = document.createElement("div");
    details.id = "details";
    details.hidden = true;
    const detailList = document.createElement("ul");
    for (const reason of reasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      detailList.append(item);
    }
    details.append(detailList);
    const view = document.createElement("button");
    view.type = "button";
    view.textContent = "View details";
    view.setAttribute("aria-expanded", "false");
    view.setAttribute("aria-controls", "details");
    view.addEventListener("click", () => {
      details.hidden = !details.hidden;
      view.textContent = details.hidden ? "View details" : "Hide details";
      view.setAttribute("aria-expanded", String(!details.hidden));
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => {
      onDismiss?.();
      host.remove();
    });
    const footer = document.createElement("footer");
    footer.append(view, dismiss);
      section.append(header, summary, score, reasonsLabel, preview, details, footer);
    root.append(style, section);
    node.after(host);
    return host;
  }

  function showPreviouslyDetected({ root = document.querySelector("main,[role=main]"), result, onDismiss } = {}) {
    if (!root || !result) return null;
    const host = document.createElement("aside");
    host.dataset.fsdPrevious = "true";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:block;max-width:420px;margin:12px 0;font:13px/1.5 system-ui,sans-serif;color:#3f3218}section{border:1px solid #d8b75d;border-left:4px solid #b23b3b;border-radius:6px;background:#fff9e9;padding:12px;box-shadow:0 2px 8px rgba(45,36,16,.08)}strong{display:block;color:#b23b3b;font-size:13px;text-transform:uppercase}p{margin:7px 0}.score{font-weight:700}ul{margin:6px 0;padding-left:20px}li{margin:4px 0}button{min-height:32px;padding:6px 10px;border:1px solid #9f812f;border-radius:4px;background:#fff;color:#3f3218;font:600 12px/1.4 system-ui,sans-serif;cursor:pointer}button:focus-visible{outline:2px solid #176348;outline-offset:2px}";
    const section = document.createElement("section");
    section.setAttribute("role", "status");
    const title = document.createElement("strong");
    title.textContent = `${result.level === "red" ? icon.red : icon.yellow} PREVIOUSLY DETECTED MESSAGE IS NO LONGER VISIBLE`;
    const description = document.createElement("p");
    description.textContent = result.level === "red"
      ? "A previously detected high-risk message is no longer visible in this conversation."
      : "A previously detected suspicious message is no longer visible in this conversation.";
    const score = document.createElement("p");
    score.className = "score";
    score.textContent = `Risk Score: ${result.score}`;
    const list = document.createElement("ul");
    for (const category of result.categories || []) {
      const item = document.createElement("li");
      item.textContent = categoryLabels[category] || category;
      list.append(item);
    }
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => {
      onDismiss?.();
      host.remove();
    });
    section.append(title, description, score, list, dismiss);
    shadow.append(style, section);
    root.prepend(host);
    return host;
  }

  globalThis.fsdAlertUI = { show, showPreviouslyDetected };
})();
