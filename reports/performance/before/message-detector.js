(() => {
  const selector =
    '[data-testid="message"],[data-testid="message-bubble"],[data-testid="deleted-message"],[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="conversation-message"]';
  const fallbackSelector =
    '[role="main"] [class*="message" i],[role="main"] [aria-label*="message" i],[role="main"] [role="listitem"],[role="main"] p,[role="main"] [dir="auto"],[data-testid="conversation"] [class*="message" i],[data-testid="conversation-view"] [class*="message" i],[data-testid="messages"] [class*="message" i],body [data-message-id],body [data-testid="message"],body [data-testid="message-bubble"],body [class*="message-bubble" i],body [class*="messageBubble" i],body p,body [dir="auto"]';
  const candidateSelector = selector + "," + fallbackSelector;
  const rowContainerSelector =
    '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item,.ce05uz8.contact,.ce05uz0.contact,nav [role="listitem"],aside [role="listitem"],[class*="inbox" i] [role="listitem"],[class*="conversation" i] [role="listitem"]';
  const rowSelector = rowContainerSelector + ',a[href*="/inbox/"]';
  const previewSelector =
    '[data-testid="message-preview"],[data-testid="last-message"],[class*="message-preview"],[class*="last-message"],.message-preview,.last-message,.message-snippet,.conversation-preview,.contact-excerpt';
  const owned =
    "[data-fsd-warning],[data-fsd-flag],[data-fsd-chat-flag],[data-fsd-previous],[data-fsd-draft-warning]";
  function textOf(node) {
    return (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function hasVisibleText(node) {
    const text = textOf(node);
    return (
      text.length <= 12000 &&
      (text.length >= 2 || Boolean(node.querySelector("a[href]")))
    );
  }
  function isUiText(node) {
    const text = textOf(node).toLowerCase();
    return (
      /^(messages|saved|type a message|create an offer|date of last order|preferred service|last seen\b|this message relates to:|united kingdom|all messages)$/i.test(
        text,
      ) ||
      text.includes("only visible to you") ||
      text.includes("can no longer be contacted")
    );
  }
  function isOwnMessage(node) {
    if (
      node.closest(
        '[data-direction="outgoing"],[data-is-own="true"],.outgoing,.message--outgoing,[contenteditable="true"]',
      )
    )
      return true;
    const envelope =
      node.closest(
        '[data-message-id],[class*="message" i],[role="listitem"]',
      ) || node;
    const label = textOf(
      envelope.querySelector(
        '[data-testid="message-sender"],[data-testid="sender-name"],[class*="sender" i],[class*="user-name" i]',
      ) || document.createElement("span"),
    )
      .slice(0, 40)
      .toLowerCase();
    return (
      /^(me|you)$/.test(label.trim()) ||
      /\bonly visible to you\b/i.test(textOf(envelope))
    );
  }
  function isMessage(node) {
    if (
      !node.isConnected ||
      !node.matches(candidateSelector) ||
      node.querySelector(selector) ||
      node.closest(
        owned +
          ',nav,header,footer,form,textarea,button,[role="button"],[contenteditable="true"]',
      ) ||
      node.closest(previewSelector) ||
      node.closest(
        '[data-testid="conversation-item"],[data-testid="inbox-conversation"],.contact,.conversation-list-item',
      ) ||
      !node.getClientRects().length ||
      getComputedStyle(node).visibility === "hidden" ||
      !hasVisibleText(node) ||
      isUiText(node) ||
      isOwnMessage(node)
    )
      return false;
    if (!node.matches(selector) && !/^\/inbox\/[^/]+/.test(location.pathname))
      return false;
    const root = globalThis.fsdConversationDetector?.conversationRoot();
    if (!node.matches(selector) && root && !root.contains(node)) return false;
    if (!node.matches(selector) && node.parentElement?.closest(selector))
      return false;
    if (
      !node.matches(selector) &&
      node.querySelector(fallbackSelector) &&
      textOf(node.querySelector(fallbackSelector)) === textOf(node)
    )
      return false;
    return true;
  }
  function deletedId(node) {
    const envelope = node.closest("[data-message-id]");
    if (!envelope || !node.isConnected) return null;
    return envelope.matches(
      '[data-deleted="true"],[data-testid="deleted-message"]',
    ) || envelope.querySelector('[data-testid="deleted-message"]')
      ? envelope.getAttribute("data-message-id")
      : null;
  }
  function create({ onBatch, hasMessage, hasRow, observeMessages = true }) {
    const messages = new Set();
    const rows = new Set();
    let timer;
    let running = false;
    function queue(node, descendants = false) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element || element.closest(owned)) return;
      // Queue every matching ancestor: adding an inner bubble invalidates its wrapper.
      for (let parent = element; parent; parent = parent.parentElement) {
        if (
          observeMessages &&
          (parent.matches(candidateSelector) || hasMessage(parent))
        )
          messages.add(parent);
        if (parent.matches(rowSelector) || hasRow(parent)) rows.add(parent);
      }
      if (descendants) {
        if (observeMessages)
          for (const child of element.querySelectorAll(candidateSelector))
            messages.add(child);
        for (const child of element.querySelectorAll(rowSelector))
          rows.add(child);
      }
    }
    function flush() {
      timer = undefined;
      const batch = { messages: [...messages], rows: new Set(rows) };
      messages.clear();
      rows.clear();
      if (running) onBatch(batch);
    }
    const observer = new MutationObserver((records) => {
      let removed = false;
      for (const record of records) {
        if (record.type === "childList") {
          const changed = [...record.addedNodes, ...record.removedNodes].filter(
            (node) => !(node.nodeType === 1 && node.matches(owned)),
          );
          if (!changed.length) continue;
          queue(record.target);
          for (const node of record.addedNodes) queue(node, true);
          removed ||= record.removedNodes.length > 0;
        } else queue(record.target, record.type === "attributes");
      }
      // The first mutation sets the deadline; later arrivals cannot postpone it.
      if (
        running &&
        timer === undefined &&
        (removed || messages.size || rows.size)
      )
        timer = setTimeout(flush, 150);
    });
    function stop() {
      running = false;
      observer.disconnect();
      clearTimeout(timer);
      timer = undefined;
      messages.clear();
      rows.clear();
    }
    return {
      start() {
        if (running) return;
        running = true;
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [
            "href",
            "data-conversation-id",
            "aria-current",
            "aria-selected",
            "aria-busy",
            "data-loading",
            "data-deleted",
            "class",
            "data-direction",
            "data-is-own",
            "hidden",
            "style",
            "contenteditable",
            "data-testid",
            "data-message-id",
            "data-sender",
            "data-timestamp",
            "datetime",
          ],
        });
        onBatch();
      },
      stop,
    };
  }
  globalThis.fsdMessageDetector = {
    create,
    isMessage,
    isOwnMessage,
    deletedId,
    selector,
    candidateSelector,
    rowContainerSelector,
    rowSelector,
    previewSelector,
  };
})();
