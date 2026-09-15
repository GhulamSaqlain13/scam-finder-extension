(() => {
  const observed = new WeakMap();
  const metadataSelector = '[data-testid="message-sender"],[data-testid="sender-name"],[data-testid="message-timestamp"],time';
  function links(node) {
    const anchors = [...node.querySelectorAll("a[href]")];
    if (node.matches("a[href]")) anchors.unshift(node);
    return anchors.filter(link => !link.closest(metadataSelector)).map(link => ({
      href: link.href, text: (link.innerText || link.textContent || "").trim(),
    }));
  }
  function timestamp(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  function fingerprint(parts) {
    const input = parts.map(part => part ?? "").join("\u001f");
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return "msg_" + hash.toString(16).padStart(8, "0");
  }
  function extract(node) {
    if (!globalThis.fsdMessageDetector.isMessage(node)) return null;
    const envelope = node.closest('[data-message-id],[role="listitem"],[class*="message" i]') || node;
    const senderNode = envelope.querySelector('[data-testid="message-sender"],[data-testid="sender-name"],[class*="sender" i],[class*="user-name" i]');
    const fallbackSender = envelope !== node ? (envelope.firstElementChild?.textContent || "").trim() : "";
    const sender = envelope.getAttribute("data-sender") || senderNode?.textContent.trim() || (fallbackSender.length <= 80 ? fallbackSender : null) || null;
    const timeNode = envelope.querySelector("time[datetime]");
    const sentAt = timestamp(envelope.getAttribute("data-timestamp") || timeNode?.getAttribute("datetime"));
    const conversation = node.closest('[data-conversation-id]');
    const conversationId = conversation?.getAttribute("data-conversation-id") ||
      (/^\/inbox\/[^/]+/.test(location.pathname) ? location.pathname : null);
    const source = node.querySelector('[data-testid="message-text"],.message-text') || node;
    // Strip UI metadata without modifying Fiverr's DOM or returning its HTML.
    const copy = source.cloneNode(true);
    for (const element of copy.querySelectorAll(metadataSelector + ',[data-fsd-warning],[data-fsd-flag],[data-fsd-previous],script,style')) element.remove();
    for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
    for (const block of copy.querySelectorAll("p,div,li")) block.append("\n");
    const text = copy.textContent.trim();
    const linkMetadata = links(source);
    if ((!text && !linkMetadata.length) || text.length > 12000) return null;
    const nativeId = envelope.getAttribute("data-message-id") || null;
    const fallbackId = fingerprint([conversationId, sender, text, sentAt, linkMetadata.map(link => link.href).join("|")]);
    const identity = JSON.stringify([nativeId, fallbackId, conversationId, sender, sentAt]);
    let state = observed.get(node);
    if (state?.identity !== identity) {
      state = { identity, id: nativeId || fallbackId, detectedAt: new Date().toISOString() };
      observed.set(node, state);
    }
    return {
      id: state.id, sender, text,
      links: [...new Set(linkMetadata.map(link => link.href))],
      timestamp: sentAt, detectedAt: state.detectedAt, conversationId,
      linkMetadata,
    };
  }
  globalThis.fsdMessageExtractor = { extract, links };
})();
