(() => {
  const observed = new WeakMap();
  const messageSelector =
    '[data-testid="message"],[data-testid="message-bubble"],[data-message-id],[class*="message-bubble" i],[class*="messageBubble"],[class*="conversation-message" i]';
  const metadataSelector =
    '[data-testid="message-sender"],[data-testid="sender-name"],[data-testid="message-timestamp"],[data-testid="timestamp"],time,[class*="timestamp" i],[class*="message-meta" i]';
  const ignoredSelector =
    '[data-fsd-warning],[data-fsd-flag],[data-fsd-chat-flag],[data-fsd-previous],script,style,nav,header,footer,form,textarea,button,[role="button"],[contenteditable="true"]';
  const envelopeSelector =
    '[data-message-id],[data-testid="message"],[data-testid="message-bubble"],[class*="message-bubble" i],[class*="messageBubble"],[class*="conversation-message" i],[role="listitem"]';
  const stableIdAttributes = [
    "data-message-id",
    "data-id",
    "data-message-key",
    "data-testid",
  ];

  function closest(node, selector) {
    return node.closest(selector) || (node.matches(selector) ? node : null);
  }

  function links(node) {
    const anchors = [...node.querySelectorAll("a[href]")];
    if (node.matches("a[href]")) anchors.unshift(node);
    return anchors
      .filter((link) => !link.closest(metadataSelector + "," + ignoredSelector))
      .map((link) => ({
        href: link.href,
        text: (link.innerText || link.textContent || "").trim(),
      }));
  }
  function timestamp(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
      return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  function fingerprint(parts) {
    const input = parts.map((part) => part ?? "").join("\u001f");
    // Multiple lanes reduce accidental collisions; this is a DOM fallback,
    // not proof of identity. Persistent references are protected by HMAC.
    const lanes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35].map(
      (seed) => {
        let hash = seed;
        for (let i = 0; i < input.length; i++) {
          hash ^= input.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, "0");
      },
    );
    return "msg_" + lanes.join("");
  }
  function messageSource(node) {
    return (
      node.querySelector(
        '[data-testid="message-text"],[data-testid="message-content"],.message-text,.message-content,[class*="message-text" i],[class*="message-content" i]',
      ) || node
    );
  }
  function messageText(source) {
    const copy = source.cloneNode(true);
    for (const element of copy.querySelectorAll(
      metadataSelector + "," + ignoredSelector,
    ))
      element.remove();
    for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
    for (const block of copy.querySelectorAll("p,div,li")) block.append("\n");
    return copy.textContent
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
  function nativeId(envelope) {
    for (const attribute of stableIdAttributes) {
      const value = envelope.getAttribute(attribute)?.trim();
      if (value && attribute !== "data-testid") return value;
    }
    return null;
  }
  function extractMessage(node) {
    if (!(node instanceof Element) || !node.isConnected) return null;
    if (
      globalThis.fsdMessageDetector &&
      !globalThis.fsdMessageDetector.isMessage(node)
    )
      return null;
    if (
      node.closest(ignoredSelector) ||
      node.closest(
        '[data-testid="conversation-item"],.conversation-list-item,.conversation-item,.inbox-conversation',
      )
    )
      return null;
    const envelope = closest(node, envelopeSelector) || node;
    const senderNode = envelope.querySelector(
      '[data-testid="message-sender"],[data-testid="sender-name"],[class*="sender" i],[class*="user-name" i]',
    );
    const sender =
      envelope.getAttribute("data-sender")?.trim() ||
      senderNode?.textContent.trim() ||
      null;
    const timeNode = envelope.querySelector("time[datetime]");
    const sentAt = timestamp(
      envelope.getAttribute("data-timestamp") ||
        timeNode?.getAttribute("datetime"),
    );
    const conversationId =
      globalThis.fsdConversationDetector?.conversationId?.(node) || null;
    const source = messageSource(node);
    const text = messageText(source);
    const linkMetadata = links(source);
    if ((!text && !linkMetadata.length) || text.length > 12000) return null;
    const fallbackId = fingerprint([
      conversationId,
      sender,
      text,
      sentAt,
      linkMetadata.map((link) => link.href).join("|"),
    ]);
    const id = nativeId(envelope) || fallbackId;
    const identity = JSON.stringify([
      id,
      conversationId,
      sender,
      sentAt,
      text,
      linkMetadata.map((link) => link.href),
    ]);
    let state = observed.get(node);
    if (state?.identity !== identity) {
      state = { identity, id, detectedAt: new Date().toISOString() };
      observed.set(node, state);
    }
    return {
      id: state.id,
      sender,
      text,
      element: node,
      links: [...new Set(linkMetadata.map((link) => link.href))],
      timestamp: sentAt,
      detectedAt: state.detectedAt,
      conversationId,
      linkMetadata,
    };
  }
  function extractMessages(root = document) {
    const selector =
      globalThis.fsdMessageDetector?.candidateSelector || messageSelector;
    const candidates = root.querySelectorAll
      ? [...root.querySelectorAll(selector)]
      : [];
    if (root.matches?.(selector)) candidates.unshift(root);
    const messages = [];
    const ids = new Set();
    const fallbackOccurrences = new Map();
    for (const node of candidates) {
      const message = extractMessage(node);
      if (!message) continue;
      if (ids.has(message.id) && !message.id.startsWith("msg_")) continue;
      if (message.id.startsWith("msg_")) {
        const occurrence = (fallbackOccurrences.get(message.id) || 0) + 1;
        fallbackOccurrences.set(message.id, occurrence);
        if (occurrence > 1) message.id += "_" + occurrence;
      }
      ids.add(message.id);
      messages.push(message);
    }
    return messages;
  }
  globalThis.fsdMessageExtractor = {
    extract: extractMessage,
    extractMessage,
    extractMessages,
    links,
  };
})();
