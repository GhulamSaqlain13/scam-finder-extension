// Structural adapters for already-delivered JSON/state. No endpoint guessing.
(() => {
  const own = (object, key) => {
    const descriptor = object && Object.getOwnPropertyDescriptor(object, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  };
  const first = (object, keys) => keys.map(key => own(object, key)).find(value => value !== undefined);
  const identifier = value => (typeof value === 'string' || Number.isSafeInteger(value)) &&
    String(value).length > 0 && String(value).length <= 512 ? String(value) : null;
  function route(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin && /^\/inbox\/[^/]+\/?$/.test(url.pathname)
        ? url.pathname.replace(/\/$/, '') : null;
    } catch { return null; }
  }
  function message(value) {
    if (!value || typeof value !== 'object') return null;
    if (first(value, ['is_own', 'isOwn', 'outgoing']) === true ||
        first(value, ['direction', 'sender_type']) === 'outgoing') return null;
    const text = first(value, ['text', 'body', 'content', 'message']);
    if (typeof text !== 'string' || !text.trim() || text.length > 12000) return null;
    // HTML bodies need a format-specific adapter; never treat markup as plain text.
    if (/<\/?[a-z][^>]*>/i.test(text)) return null;
    return { text: text.replace(/\r\n?/g, '\n').trim() };
  }
  function extract(root) {
    const records = new Map();
    const visited = new WeakSet();
    const stack = [{ value: root, key: '', depth: 0 }];
    let budget = 8000;
    while (stack.length && budget-- > 0 && records.size < 100) {
      const { value, key, depth } = stack.pop();
      if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) continue;
      visited.add(value);
      const messagesValue = own(value, 'messages');
      const edges = own(messagesValue, 'edges');
      const items = Array.isArray(messagesValue) ? messagesValue :
        Array.isArray(edges) ? edges.slice(-50).map(edge => own(edge, 'node')) : own(messagesValue, 'nodes');
      const preview = first(value, ['last_message', 'lastMessage', 'latest_message', 'latestMessage', 'snippet', 'preview']);
      let id = identifier(first(value, ['conversation_id', 'conversationId', 'thread_id', 'threadId']));
      if (!id && /^(conversations?|threads?)$/i.test(key)) id = identifier(own(value, 'id'));
      const path = route(first(value, ['conversation_url', 'conversationUrl', 'inbox_url', 'url']));
      if (id || path) {
        const single = id && first(value, ['message_id', 'messageId']) ? message(value) : null;
        const messages = Array.isArray(items) ? items.slice(-50).map(message).filter(Boolean) : single ? [single] : [];
        const snippet = typeof preview === 'string' ? message({ text: preview }) : message(preview);
        if (messages.length || snippet || id || path) {
          const record = { id: id ? 'id:' + id : 'url:' + path, path,
            kind: messages.length ? 'messages' : snippet ? 'preview' : 'metadata', messages: messages.length ? messages : snippet ? [snippet] : [] };
          if (record.messages.reduce((n, item) => n + item.text.length, 0) <= 32000)
            {
              const previous = records.get(record.id);
              if (previous?.kind === record.kind) {
                record.messages = [...previous.messages, ...record.messages].slice(-50);
                while (record.messages.reduce((n, item) => n + item.text.length, 0) > 32000) record.messages.shift();
              }
              if (!previous || record.kind === 'messages' || (previous.kind !== 'messages' && record.kind !== 'metadata')) records.set(record.id, record);
            }
        }
      }
      // Only data properties: never invoke getters, React methods, or page functions.
      const keys = Object.keys(value).slice(0, 500);
      for (const childKey of keys) {
        const child = own(value, childKey);
        if (!child || typeof child !== 'object') continue;
        const context = Array.isArray(value) || /^(edges|nodes|node)$/.test(childKey) ? key : childKey;
        if (stack.length < 8000) stack.push({ value: child, key: context, depth: depth + 1 });
      }
    }
    return [...records.values()];
  }
  globalThis.fsdPageData = { extract, own };
})();
