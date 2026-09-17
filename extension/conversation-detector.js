(() => {
  const owned =
    "[data-fsd-warning],[data-fsd-flag],[data-fsd-previous],[data-fsd-draft-warning]";
  const candidates =
    '[data-message-id],[data-testid="message"],[data-testid="message-bubble"],[role="listitem"],[role="main"] p,[role="main"] [dir="auto"],[role="main"] [class*="message" i],[data-testid="conversation"] p,[data-testid="conversation-view"] p,[data-testid="messages"] p,body p,body [dir="auto"],body [class*="message-bubble" i],body [class*="messageBubble" i]';
  const senderSelector =
    '[data-testid="message-sender"],[data-testid="sender-name"],[class*="sender" i],[class*="user-name" i]';
  function textOf(node) {
    return (node?.innerText || node?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function visible(node) {
    return (
      node?.isConnected &&
      node.getClientRects().length &&
      getComputedStyle(node).visibility !== "hidden"
    );
  }
  function conversationId(node) {
    if (/^\/inbox\/[^/]+/.test(location.pathname)) return location.pathname;
    const explicit = node?.closest('[data-conversation-id]')?.getAttribute('data-conversation-id');
    return (
      explicit ||
      (/^\/inbox\/[^/]+/.test(location.pathname) ? location.pathname : null)
    );
  }
  function urlParticipant() {
    if (!/^\/inbox\/[^/]+/.test(location.pathname)) return null;
    const slug = location.pathname.split("/").filter(Boolean).at(-1);
    try {
      return decodeURIComponent(slug).replace(/[-_]+/g, " ").trim() || null;
    } catch {
      return slug || null;
    }
  }
  function conversationRoot() {
    return (
      document.querySelector('[data-testid="conversation-view"],[data-testid="messages"],[data-testid="conversation"]') ||
      document.querySelector('main,[role="main"]') || document.body
    );
  }
  function isLoading(root = conversationRoot()) {
    if (!root || !visible(root)) return true;
    const loadingSelector = '[aria-busy="true"],[data-loading="true"],[data-testid="loading"],[data-testid="skeleton"]';
    return root.matches(loadingSelector) || [...root.querySelectorAll(loadingSelector)].some(visible) ||
      /^(?:loading|loading (?:conversation|messages|chat))[.\s…]*$/i.test(textOf(root));
  }
  function classify(node, text) {
    if (
      node.closest(
        '[data-direction="outgoing"],[data-is-own="true"],.outgoing,.message--outgoing,[contenteditable="true"]',
      )
    )
      return "outgoing";
    if (
      /\b(?:only visible to you|can no longer be contacted|we have your back|this message relates to|will not affect)\b/i.test(
        text,
      )
    )
      return "system";
    if (globalThis.fsdMessageDetector.isOwnMessage(node)) return "outgoing";
    return "incoming";
  }
  function inspect() {
    const id = conversationId();
    const selected = /^\/inbox\/[^/]+/.test(location.pathname);
    const main = conversationRoot();
    const result = {
      conversationId: id,
      selected,
      foundConversationArea: Boolean(main && visible(main)),
      participants: [],
      messages: [],
      counts: { incoming: 0, outgoing: 0, system: 0, total: 0 },
      contactUnavailable: false,
    };
    if (!selected || !main || !visible(main)) return result;
    const participants = new Set([urlParticipant()].filter(Boolean));
    for (const node of main.querySelectorAll(candidates)) {
      if (
        !visible(node) ||
        node.closest(
          owned +
            ",form,textarea,button,[role='button'],nav,header,footer,[contenteditable='true']",
        )
      )
        continue;
      if (
        node.querySelector(
          '[data-message-id],[data-testid="message"],[data-testid="message-bubble"]',
        )
      )
        continue;
      const text = textOf(node);
      if ((text.length < 2 && !node.querySelector('a[href]')) || text.length > 12000) continue;
      if (
        /^(messages|saved|type a message|create an offer|date of last order|preferred service|all messages)$/i.test(
          text,
        )
      )
        continue;
      const direction = classify(node, text);
      const senderNode = node
        .closest('[data-message-id],[role="listitem"],[class*="message" i]')
        ?.querySelector(senderSelector);
      const sender =
        textOf(senderNode) || (direction === "outgoing" ? "Me" : null);
      if (sender && sender !== "Me") participants.add(sender);
      result.contactUnavailable ||= /\bcan no longer be contacted\b/i.test(
        text,
      );
      result.counts[direction]++;
      result.counts.total++;
      result.messages.push({
        id:
          node.getAttribute("data-message-id") ||
          "visible_" + result.messages.length,
        direction,
        sender,
        textLength: text.length,
        hasLinks: Boolean(
          node.matches("a[href]") || node.querySelector("a[href]"),
        ),
      });
    }
    result.participants = [...participants].slice(0, 8);
    return result;
  }
  globalThis.fsdConversationDetector = { inspect, conversationRoot, conversationId, isLoading };
})();
