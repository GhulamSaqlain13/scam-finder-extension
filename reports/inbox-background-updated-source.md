# Complete updated source

Full current file contents for the inbox background detection change. See inbox-background-detection.md for architecture, supported formats, limitations and tests.

## manifest.json

```json
﻿{
  "manifest_version": 3,
  "name": "Scam Finder for Fiverr",
  "version": "1.0.0",
  "description": "Automatically check Fiverr messages locally and receive inline scam-risk alerts.",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://fiverr.com/*", "https://*.fiverr.com/*"],
  "action": {
    "default_title": "Scam Finder",
    "default_popup": "extension/home.html"
  },
  "background": { "service_worker": "extension/background.js" },
  "content_scripts": [
    {
      "matches": ["https://fiverr.com/*", "https://*.fiverr.com/*"],
      "js": ["extension/page-data.js", "extension/page-observer.js"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["https://fiverr.com/*", "https://*.fiverr.com/*"],
      "js": ["extension/conversation-data.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://fiverr.com/*", "https://*.fiverr.com/*"],
      "js": [
        "extension/link-scanner.js",
        "extension/urlDetector.js",
        "extension/sensitive-information.js",
        "extension/normalizer.js",
        "extension/patternMatcher.js",
        "extension/scorer.js",
        "extension/alertUI.js",
        "extension/messageHistory.js",
        "extension/deletedMessageDetector.js",
        "extension/analyzer.js",
        "extension/message-detector.js",
        "extension/message-extractor.js",
        "extension/conversation-detector.js",
        "extension/message-observer.js",
        "extension/draft-guard.js",
        "extension/content-script.js"
      ],
      "run_at": "document_end"
    }
  ],
  "options_page": "extension/options.html",
  "web_accessible_resources": [
    {
      "resources": ["data/scamPatterns.json"],
      "matches": ["https://fiverr.com/*", "https://*.fiverr.com/*"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

## extension/page-data.js

```javascript
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
```

## extension/page-observer.js

```javascript
(() => {
  if (globalThis.__fsdPageObserver) return;
  globalThis.__fsdPageObserver = true;
  const channel = 'fsd-page-data-v1';
  const { extract, own } = globalThis.fsdPageData;
  const maxBytes = 512 * 1024;
  let enabled = true;
  let stateTimer;
  let generation = 0;
  const pendingRows = new Set();
  const recent = new Map();
  const reported = new Set();
  function publish(value, source, rowToken) {
    if (!enabled || !/^\/inbox(?:\/|$)/.test(location.pathname)) return;
    try {
      const records = extract(value);
      if (!records.length && !reported.has(source)) {
        reported.add(source);
        window.postMessage({ channel, type: 'unsupported', source }, location.origin);
      }
      for (const record of records) {
        const token = records.length === 1 ? rowToken : undefined;
        const signature = JSON.stringify(record);
        const key = record.id + ':' + (rowToken || '');
        if (!rowToken && recent.get(key)?.signature === signature) continue;
        recent.delete(key);
        recent.set(key, { signature, record, source, rowToken: token, receivedAt: Date.now() });
        while (recent.size > 100) recent.delete(recent.keys().next().value);
        window.postMessage({ channel, type: 'record', record, source,
          rowToken: token }, location.origin);
      }
    } catch { /* Unsupported or hostile page objects must not break Fiverr. */ }
  }
  function supportedURL(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && /(?:inbox|conversation|message|thread|graphql)/i.test(url.pathname);
    } catch { return false; }
  }
  async function observeResponse(response, version) {
    if (!enabled || version !== generation || !response.ok || !supportedURL(response.url) ||
        !/json/i.test(response.headers.get('content-type') || '') ||
        Number(response.headers.get('content-length')) > maxBytes) return;
    // Read a bounded clone. The page receives its original response untouched.
    const reader = response.clone().body?.getReader();
    if (!reader) return;
    let size = 0;
    const parts = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes || !enabled || version !== generation) {
          void reader.cancel().catch(() => {});
          return;
        }
        parts.push(value);
      }
      if (!enabled || version !== generation) return;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
      publish(JSON.parse(new TextDecoder().decode(bytes)), 'fetch');
    } finally { reader.releaseLock(); }
  }
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const result = Reflect.apply(originalFetch, this, args);
    const version = generation;
    result.then(response => { void observeResponse(response, version).catch(() => {}); }, () => {});
    return result;
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    const version = generation;
    this.addEventListener('load', () => {
      if (!enabled || version !== generation || this.status < 200 || this.status >= 300 ||
          !supportedURL(this.responseURL) || !/json/i.test(this.getResponseHeader('content-type') || '')) return;
      try {
        if (this.responseType === 'json') {
          const size = Number(this.getResponseHeader('content-length'));
          if (size <= maxBytes) publish(this.response, 'XHR');
        } else if (!this.responseType || this.responseType === 'text') {
          if (this.responseText.length <= maxBytes) publish(JSON.parse(this.responseText), 'XHR');
        }
      } catch { /* Ignore non-JSON, inaccessible and oversized responses. */ }
    }, { once: true });
    return Reflect.apply(originalSend, this, args);
  };
  function scanState() {
    stateTimer = undefined;
    if (!enabled) return;
    for (const key of ['__INITIAL_STATE__', '__PRELOADED_STATE__', '__NEXT_DATA__']) {
      const value = own(window, key);
      if (value && typeof value === 'object') publish(value, 'state');
    }
    for (const node of document.querySelectorAll('script#__NEXT_DATA__,script[type="application/json"][data-state]')) {
      if (node.textContent.length <= maxBytes) {
        try { publish(JSON.parse(node.textContent), 'state'); } catch { /* Not a supported state snapshot. */ }
      }
    }
    for (const token of pendingRows) {
      const row = document.querySelector('[data-fsd-row-token="' + token + '"]');
      // Read only props attached to this row, never crawl the React Fiber graph.
      if (row) for (const key of Object.keys(row).filter(key => key.startsWith('__reactProps$'))) {
        publish(own(row, key), 'state', token);
      }
    }
    pendingRows.clear();
  }
  const stateObserver = new MutationObserver(records => {
    if (!enabled || stateTimer !== undefined) return;
    const selector = 'script#__NEXT_DATA__,script[type="application/json"][data-state]';
    if (records.some(record => record.target.parentElement?.matches(selector) ||
      record.target.matches?.(selector) || [...record.addedNodes].some(node => node.matches?.(selector))))
      stateTimer = setTimeout(scanState, 100);
  });
  stateObserver.observe(document, { childList: true, subtree: true, characterData: true });
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== channel) return;
    if (event.data.type === 'control') {
      const nextEnabled = event.data.enabled === true;
      if (enabled !== nextEnabled) generation++;
      enabled = nextEnabled;
      reported.clear();
      if (!enabled) recent.clear();
      else for (const entry of recent.values()) {
        if (Date.now() - entry.receivedAt < 30 * 60 * 1000)
          window.postMessage({ channel, type: 'record', record: entry.record,
            source: entry.source, rowToken: entry.rowToken }, location.origin);
      }
      pendingRows.clear();
      clearTimeout(stateTimer);
      stateTimer = undefined;
    } else if (event.data.type !== 'resolve') return;
    if (!enabled) return;
    for (const token of (Array.isArray(event.data.tokens) ? event.data.tokens : []).slice(0, 100))
      if (typeof token === 'string' && /^fsd-\d+$/.test(token)) pendingRows.add(token);
    if (stateTimer === undefined) stateTimer = setTimeout(scanState, 100);
  });
})();
```

## extension/conversation-data.js

```javascript
/* global chrome */
(() => {
  if (globalThis.fsdConversationData) return;
  const channel = 'fsd-page-data-v1';
  const ttl = 30 * 60 * 1000;
  const cache = new Map();
  const pending = new Map();
  const aliases = new Map();
  let rowIds = new WeakMap();
  let rowSignatures = new WeakMap();
  const rowTokens = new Map();
  const revisions = new Map();
  const dirty = new Set();
  let counter = 0;
  let enabled = false;
  let debug = false;
  let onUpdate;
  let timer;
  let generation = 0;
  function log(label, value) { if (debug) console.debug('[ScamDetector] ' + label, value); }
  function pathOf(row) {
    const link = row.matches('a[href]') ? row : row.querySelector('a[href*="/inbox/"]');
    if (!link) return null;
    try {
      const url = new URL(link.href, location.href);
      return url.origin === location.origin && /^\/inbox\/[^/]+\/?$/.test(url.pathname)
        ? 'url:' + url.pathname.replace(/\/$/, '') : null;
    } catch { return null; }
  }
  function key(row) {
    for (const name of ['data-conversation-id', 'data-thread-id']) {
      const value = row.getAttribute(name);
      if (value && value.length <= 512) return 'id:' + value;
    }
    const path = pathOf(row);
    return (path && (aliases.get(path) || path)) || rowIds.get(row) || null;
  }
  function bound(map, limit = 500) {
    while (map.size > limit) map.delete(map.keys().next().value);
  }
  async function hash(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function valid(record) {
    return record && typeof record.id === 'string' && /^(id:|url:\/inbox\/).+/.test(record.id) &&
      record.id.length <= 520 && ['messages', 'preview', 'metadata'].includes(record.kind) &&
      Array.isArray(record.messages) && (record.messages.length > 0 || record.kind === 'metadata') && record.messages.length <= 50 &&
      record.messages.every(item => item && typeof item.text === 'string' && item.text.trim() && item.text.length <= 12000) &&
      record.messages.reduce((sum, item) => sum + item.text.length, 0) <= 32000 &&
      (record.path == null || (typeof record.path === 'string' && /^\/inbox\/[^/?#]+$/.test(record.path)));
  }
  function changed(id) {
    if (id) dirty.add(id);
    if (timer === undefined) timer = setTimeout(() => {
      timer = undefined;
      const ids = new Set(dirty);
      dirty.clear();
      if (enabled) onUpdate?.(ids);
    }, 50);
  }
  async function analyze(record, source) {
    const version = generation;
    const revision = (revisions.get(record.id) || 0) + 1;
    revisions.set(record.id, revision);
    bound(revisions);
    const texts = record.messages.map(item =>
      (globalThis.fsdMessageNormalizer?.normalize(item.text)?.normalizedText || item.text.normalize('NFKC'))
        .replace(/\s+/g, ' ').trim());
    const messageHash = await hash(JSON.stringify([record.kind, texts]));
    if (!enabled || version !== generation || revisions.get(record.id) !== revision) return;
    const previous = cache.get(record.id);
    if (previous?.messageHash === messageHash && previous.expiresAt > Date.now()) return;
    const results = texts.map(text => globalThis.fsdAnalyze(text, []));
    const scores = results.map(result => result.score).filter(score => score > 0).sort((a, b) => b - a);
    let score = scores.length ? Math.min(100, scores[0] + Math.round(scores.slice(1).reduce((a, b) => a + b, 0) * 0.5)) : 0;
    // Preserve stronger recent evidence when a response contains only a later page/snippet.
    if (previous?.expiresAt > Date.now()) score = Math.max(score, previous.score || 0);
    const sufficient = record.kind === 'messages' || score > 20;
    const result = { score: sufficient ? score : null, status: sufficient ? globalThis.fsdDisplayRisk(score) : 'No preview',
      analyzedAt: Date.now(), expiresAt: Date.now() + ttl, messageHash, source, kind: record.kind, count: texts.length };
    cache.delete(record.id);
    cache.set(record.id, result);
    bound(cache);
    if (debug) log('Conversation ID:', (await hash(record.id)).slice(0, 12));
    log('Data source:', source);
    log('Message data found:', true);
    log('Messages analyzed:', texts.length);
    log('Risk result:', result.status);
    if (enabled && generation === version) changed(record.id);
  }
  function flush() {
    if (!enabled || !onUpdate || !globalThis.fsdAnalyze) return;
    for (const [id, entry] of pending) {
      pending.delete(id);
      void analyze(entry.record, entry.source).catch(() => log('Data error:', 'Unsupported conversation data'));
    }
  }
  window.addEventListener('message', event => {
    if (!enabled || event.source !== window || event.origin !== location.origin ||
        event.data?.channel !== channel) return;
    if (event.data.type === 'unsupported' && ['state', 'fetch', 'XHR'].includes(event.data.source)) {
      log('Data source:', event.data.source);
      log('Message data found:', false);
      log('Data error:', 'No supported conversation IDs/message fields found; waiting for new data.');
      return;
    }
    if (event.data.type !== 'record' ||
        !['state', 'fetch', 'XHR'].includes(event.data.source) || !valid(event.data.record)) return;
    const { record, source, rowToken } = event.data;
    if (record.path && aliases.get('url:' + record.path) !== record.id) {
      aliases.set('url:' + record.path, record.id); bound(aliases); changed(record.id);
    }
    const row = rowTokens.get(rowToken);
    if (row?.isConnected && rowIds.get(row) !== record.id) { rowIds.set(row, record.id); changed(record.id); }
    if (record.kind === 'metadata') return;
    pending.set(record.id, { record, source });
    bound(pending, 100);
    flush();
  });
  function control(value) {
    enabled = value;
    generation++;
    if (!enabled) {
      pending.clear(); cache.clear(); aliases.clear(); revisions.clear(); rowTokens.clear(); dirty.clear();
      rowIds = new WeakMap(); rowSignatures = new WeakMap();
      clearTimeout(timer); timer = undefined;
    }
    window.postMessage({ channel, type: 'control', enabled }, location.origin);
  }
  function request(rows) {
    if (!enabled) return;
    const tokens = [];
    for (const row of rows) {
      if (!row.isConnected) continue;
      const signature = (row.getAttribute('data-conversation-id') || row.getAttribute('data-thread-id') || pathOf(row) || '') + ':' + row.textContent;
      if (rowSignatures.get(row) === signature) continue;
      rowIds.delete(row);
      rowSignatures.set(row, signature);
      let token = row.getAttribute('data-fsd-row-token');
      if (!token || rowTokens.get(token) !== row) {
        token = 'fsd-' + (++counter);
        row.setAttribute('data-fsd-row-token', token);
      }
      rowTokens.set(token, row);
      tokens.push(token);
      log('Conversation detected', { identified: Boolean(key(row)) });
      log('Message data found:', Boolean(get(row)));
    }
    for (const [token, row] of rowTokens) if (!row.isConnected) rowTokens.delete(token);
    bound(rowTokens);
    for (let i = 0; i < tokens.length; i += 100)
      window.postMessage({ channel, type: 'resolve', tokens: tokens.slice(i, i + 100) }, location.origin);
  }
  function get(row) {
    const result = cache.get(key(row));
    return result?.expiresAt > Date.now() ? result : null;
  }
  globalThis.fsdConversationData = {
    key, get, request, log,
    start(callback) { onUpdate = callback; if (!enabled) control(true); flush(); },
    stop() { onUpdate = undefined; control(false); },
  };
  // Install the receiver at document_start so early page responses are not lost.
  let storageVersion = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.fsd_debug) debug = changes.fsd_debug.newValue === true;
    if (changes.fsd_enabled) { storageVersion++; control(changes.fsd_enabled.newValue !== false); }
    if (changes.fsd_cache_reset) { cache.clear(); pending.clear(); aliases.clear(); generation++; }
  });
  const version = storageVersion;
  chrome.storage.local.get(['fsd_enabled', 'fsd_debug']).then(settings => {
    debug = settings.fsd_debug === true;
    if (version === storageVersion) control(settings.fsd_enabled !== false);
  }).catch(() => control(false));
})();
```

## extension/content-script.js

```javascript
﻿/* global chrome */
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
  const previewResults = new Map();
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
    const preview = row.querySelector(previewSelector) ||
      row.querySelector('.user-info > p:not(:first-child):not([data-fsd-flag])');
    if (preview)
      return {
        node: preview,
        confirmed: true,
        text: compactText(preview),
        links: messageLinks(preview),
      };
    // Contact rows can contain only an avatar, a name and a timestamp.
    // Those are not message evidence and must never produce a green flag.
    const copy = (row.querySelector('.user-info') || row).cloneNode(true);
    for (const element of copy.querySelectorAll(
      '[data-fsd-flag],.user-info > p:first-child,time,[data-testid="conversation-name"],[data-testid="username"],[class*="timestamp" i],[class*="avatar" i],button,svg',
    ))
      element.remove();
    for (const link of copy.querySelectorAll('a[href*="/inbox/"]'))
      if (!link.childElementCount) link.remove();
    const text = compactText(copy);
    if (!text || text.length > 12000) return null;
    // A bare row label has no identifiable preview container; it may be a name.
    if (!copy.childElementCount && !unavailablePattern.test(text)) return null;
    // A loaded fallback preview is still analyzable, even when no rule matches.
    // Previously a zero score stayed "Checking" until the chat was opened.
    return { node: row, text, links: messageLinks(row), confirmed: true };
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
    const dataKey = globalThis.fsdConversationData?.key(row);
    if (dataKey) return dataKey;
    if (row.dataset.conversationId) return "id:" + row.dataset.conversationId;
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
    return null;
  }
  function storedConversationId(key) {
    if (!key) return null;
    if (key.startsWith("url:")) return key.slice(4).split("?")[0];
    return key.startsWith("id:") ? key.slice(3) : key;
  }
  function createFlag(score, attribute, pendingLabel) {
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
    const badgeLabel = pendingLabel || globalThis.fsdDisplayRisk(score);
    flag.dataset.state = score === null ? (pendingLabel ? "unavailable" : "checking") : "checked";
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
    const pendingLabel = score === null && !globalThis.fsdConversationDetector.isLoading(row)
      ? "No preview" : undefined;
    const previous = flags.get(row);
    const available = globalThis.fsdConversationData?.get(row);
    if (previous?.isConnected && previous.dataset.score === String(score) &&
        previous.dataset.source === (available?.source || "DOM") &&
        previous.dataset.coverage === (available?.kind || "preview") &&
        previous.dataset.state === (score === null ? (pendingLabel ? "unavailable" : "checking") : "checked"))
      return;
    previous?.remove();
    // SPA clones can copy our light-DOM host without its shadow root or WeakMap entry.
    for (const stale of row.querySelectorAll('[data-fsd-flag]')) stale.remove();
    const flag = createFlag(score, "data-fsd-flag", pendingLabel);
    if (pendingLabel) flag.title = "Insufficient message data to determine risk. Waiting for available conversation data.";
    const target =
      row.querySelector(".user-info") ||
      row.querySelector('a[href*="/inbox/"]') ||
      row;
    target.append(flag);
    flags.set(row, flag);
    flag.dataset.source = available?.source || "DOM";
    flag.dataset.coverage = available?.kind || "preview";
    if (available?.kind === "messages") flag.title = "Based on available messages, not a guarantee of safety.";
    else if (score !== null) flag.title = "Based on preview or retained risk evidence; full conversation may not be available.";
    globalThis.fsdConversationData?.log("UI updated:", { score, source: flag.dataset.source });
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
    restoredRisk = null,
    includeKnown = true,
  ) {
    const version = ++conversationScanVersion;
    const path = location.pathname;
    clearTimeout(expiryTimer);
    const now = Date.now();
    for (const [key, record] of conversationScores) {
      if (record.expiresAt <= now) conversationScores.delete(key);
    }
    const rows = new Map();
    for (const candidate of new Set([...candidates, ...(includeKnown ? knownRows : [])])) {
      if (!candidate.isConnected) continue;
      const row = candidate.closest(rowContainerSelector) || candidate;
      if (row.querySelector(rowContainerSelector)) continue;
      if (row.querySelector(selector) && !row.querySelector(previewSelector))
        continue;
      rows.set(row, conversationKey(row));
      knownRows.add(row);
    }
    globalThis.fsdConversationData?.request(rows.keys());
    const activeId = globalThis.fsdConversationDetector.conversationId();
    const ids = [
      ...new Set(
        [...rows.values()]
          .map(storedConversationId)
          .concat(activeId)
          .filter(Boolean),
      ),
    ];
    const storedScores = restoredRisk?.scores || {};
    const storedRecords = restoredRisk?.records || {};
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
            const signature = JSON.stringify([text, linkKey]);
            let result = previewResults.get(signature);
            if (!result) {
              result = unavailableResult(text) || globalThis.fsdAnalyze(text, links);
              globalThis.fsdConversationData?.log("Data source:", "DOM");
              globalThis.fsdConversationData?.log("Message data found:", true);
              globalThis.fsdConversationData?.log("Messages analyzed:", 1);
              globalThis.fsdConversationData?.log("Risk result:", result.score > 20 ? globalThis.fsdDisplayRisk(result.score) : "No preview (preview only)");
              previewResults.set(signature, result);
              if (previewResults.size > 100) previewResults.delete(previewResults.keys().next().value);
            }
            cached = {
              text,
              linkKey,
              result,
            };
            previewCache.set(preview.node, cached);
          }
          score = cached.result.score;
          // Benign snippets cannot establish that the available conversation is safe.
          checked = score > 20;
        }
      }
      const active =
        (key && storedConversationId(key) === activeId) ||
        row.querySelector('a[href*="/inbox/"]')?.pathname === activeId ||
        row.matches(
          '[aria-current="page"],[aria-selected="true"],.selected,.active,.active-contact',
        ) ||
        !!row.querySelector('[aria-current="page"],[aria-selected="true"]');
      if (active && currentScore !== null) {
        checked = true;
        score = Math.max(score, currentScore);
      }
      const available = globalThis.fsdConversationData?.get(row);
      if (available?.score !== null && available?.score !== undefined) {
        checked = true;
        score = Math.max(score, available.score);
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
              coverage: (active && currentScore !== null) || available?.kind === "messages" ? "messages" : "preview",
            });
        }
        const restored = storedRecords[id];
        const retained = conversationScores.get(key);
        if (
          restored?.expiresAt > now &&
          (!retained || restored.score > retained.score)
        )
          conversationScores.set(key, restored);
        // Legacy zero-score preview caches do not prove message coverage.
        checked ||= conversationScores.get(key)?.coverage === "messages" ||
          (conversationScores.get(key)?.score || 0) > 20 || (storedScores[id] || 0) > 20;
        score = Math.max(
          score,
          conversationScores.get(key)?.score || 0,
          storedScores[id] || 0,
        );
        if (conversationScores.size > 500)
          conversationScores.delete(conversationScores.keys().next().value);
        flagConversation(row, checked ? score : null);
      } else flagConversation(row, checked ? score : null);
      if (active && checked) activeScore = Math.max(activeScore || 0, score);
    }
    updateChatFlag(activeScore);
    const entries = restoredRisk ? [] : [...freshScores];
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
    // Paint local results before waiting for the service worker/storage queue.
    // A newer DOM scan always takes priority over an older lookup response.
    if (!restoredRisk && ids.length) {
      const restored = { scores: {}, records: {} };
      try {
        for (let offset = 0; offset < ids.length; offset += 500) {
          const response = await chrome.runtime.sendMessage({
            type: "FSD_CONVERSATION_RISK",
            conversationIds: ids.slice(offset, offset + 500),
          });
          if (!running || version !== conversationScanVersion || path !== location.pathname) return;
          Object.assign(restored.scores, response?.scores || {});
          Object.assign(restored.records, response?.records || {});
        }
        if (Object.keys(restored.scores).length || Object.keys(restored.records).length)
          void scanConversations(messageResults, rows.keys(), restored, includeKnown);
      } catch {
        /* Local flags remain usable while the background worker is unavailable. */
      }
    }
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
      const alertResult = !changed && patternAlerts.has(node)
        ? patternAlerts.get(node)
        : displayResult(message, result);
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
        // The primary detector owns added/edited message analysis. This
        // observer only remembers removed messages for history lookup.
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
      globalThis.fsdConversationData?.start(ids => {
        const affected = [...knownRows].filter(row => ids.has(conversationKey(row)));
        if (running && affected.length) void scanConversations(activeResults(), affected, null, false);
      });
      detector.start();
      messageObserver.start();
      globalThis.fsdMessageHistory?.removeOldMessages?.().catch(() => {});
      draftGuard.start();
    } else globalThis.fsdConversationData?.stop();
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
```

## extension/message-detector.js

```javascript
(() => {
  const selector =
    '[data-testid="message"],[data-testid="message-bubble"],[data-testid="deleted-message"],[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="conversation-message"]';
  const fallbackSelector =
    '[role="main"] [class*="message" i],[role="main"] [aria-label*="message" i],[role="main"] [role="listitem"],[role="main"] p,[role="main"] [dir="auto"],[data-testid="conversation"] [class*="message" i],[data-testid="conversation-view"] [class*="message" i],[data-testid="messages"] [class*="message" i],body [data-message-id],body [data-testid="message"],body [data-testid="message-bubble"],body [class*="message-bubble" i],body [class*="messageBubble" i],body p,body [dir="auto"]';
  const candidateSelector = selector + "," + fallbackSelector;
  const rowContainerSelector =
    '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],[data-thread-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item,.ce05uz8.contact,.ce05uz0.contact,nav [role="listitem"],aside [role="listitem"],[class*="inbox" i] [role="listitem"],[class*="conversation" i] [role="listitem"]';
  const rowSelector = rowContainerSelector + ',a[href*="/inbox/"]';
  const previewSelector =
    '[data-testid="message-preview"],[data-testid="last-message"],[class*="message-preview"],[class*="last-message"],.message-preview,.last-message,.message-snippet,.conversation-preview,.contact-excerpt';
  const owned =
    "[data-fsd-alert],[data-fsd-warning],[data-fsd-flag],[data-fsd-chat-flag],[data-fsd-previous],[data-fsd-draft-warning]";
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
      const queued = new Map();
      const collect = (node, descendants = false) => {
        queued.set(node, descendants || queued.get(node) || false);
      };
      for (const record of records) {
        if (record.type === "childList") {
          const changed = [...record.addedNodes, ...record.removedNodes].filter(
            (node) => !(node.nodeType === 1 && node.matches(owned)),
          );
          if (!changed.length) continue;
          collect(record.target);
          for (const node of record.addedNodes) collect(node, true);
          removed ||= record.removedNodes.length > 0;
        } else collect(record.target, record.type === "attributes");
      }
      for (const [node, descendants] of queued) queue(node, descendants);
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
            "data-thread-id",
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
```

## extension/background.js

```javascript
﻿/* global chrome */
importScripts("metadata-store.js", "evidence-vault.js");
let queue = Promise.resolve();
queue = queue.then(() => fsdEvidenceVault.initialize()).catch(() => {});
const contentScriptFiles = [
  "extension/conversation-data.js",
  "extension/link-scanner.js",
  "extension/urlDetector.js",
  "extension/sensitive-information.js",
  "extension/normalizer.js",
  "extension/patternMatcher.js",
  "extension/scorer.js",
  "extension/alertUI.js",
  "extension/messageHistory.js",
  "extension/deletedMessageDetector.js",
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
                world: "MAIN",
                files: ["extension/page-data.js", "extension/page-observer.js"],
              })
              .then(() => chrome.scripting
              .executeScript({
                target: { tabId: tab.id },
                files: contentScriptFiles,
              }))
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
      !ids(message.observedIds) ||
      (message.deletedIds !== undefined && !ids(message.deletedIds))
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
          message.deletedIds || [],
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
      !ids(message.conversationIds) ||
      (message.scores !== undefined &&
        (!Array.isArray(message.scores) ||
          message.scores.length !== message.conversationIds.length ||
          !message.scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 100)))
    )
      return;
    queue = queue.then(async () => {
      const state = await chrome.storage.local.get("fsd_enabled");
      if (state.fsd_enabled === false) return { ok: false };
      const conversationIds = message.conversationIds.map((id) =>
        id.startsWith("url:") ? id.slice(4).split("?")[0] : id,
      );
      // Session storage survives page reloads and worker suspension. Never store
      // raw conversation references, participant names, or preview contents here.
      const now = Date.now();
      const data = await chrome.storage.session.get("fsd_flag_scores");
      const retained = Object.fromEntries(Object.entries(data.fsd_flag_scores || {})
        .filter(([, record]) => record.expiresAt > now));
      const hashes = await Promise.all(conversationIds.map(fsdMetadata.reference));
      if (message.scores) hashes.forEach((hash, index) => {
        const score = message.scores[index];
        if (!retained[hash] || score >= retained[hash].score)
          retained[hash] = { score, expiresAt: now + 30 * 60 * 1000 };
      });
      const bounded = Object.fromEntries(Object.entries(retained)
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt).slice(0, 500));
        if (message.scores)
          await chrome.storage.session.set({ fsd_flag_scores: bounded });
      const records = await fsdEvidenceVault.riskState(conversationIds);
      const scores = {};
      conversationIds.forEach((id, index) => {
        const cached = bounded[hashes[index]];
        if (cached && (!records[id] || cached.score >= records[id].score)) records[id] = cached;
        if (records[id]) scores[id] = records[id].score;
      });
      return { ok: true, scores, records };
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
      await chrome.storage.session.remove("fsd_flag_scores");
      await chrome.storage.local.set({ fsd_vault_revision: Date.now(), fsd_cache_reset: Date.now() });
      return { ok: true };
    });
  } else if (message?.type === "FSD_CLEAR" && extensionPage) {
    queue = queue.then(async () => {
      await chrome.storage.session.remove("fsd_flag_scores");
      await chrome.storage.local.remove([
        "fsd_history",
        "fsd_last_result",
        "fsd_highest_result",
      ]);
      await fsdEvidenceVault.remove();
      await chrome.storage.local.set({ fsd_vault_revision: Date.now(), fsd_cache_reset: Date.now() });
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
```

## package.json

```json
{
  "name": "scam-finder",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "build:extension": "node scripts/build.cjs",
    "check:extension": "node scripts/check.cjs",
    "qa": "node tests/qa-dataset.cjs",
    "test": "node tests/analyzer.cjs && node tests/pattern-matcher.cjs && node tests/scorer.cjs && node tests/url-detector.cjs && node tests/message-history.cjs && node tests/deleted-message-detector.cjs && node tests/extension-monitor.cjs && node tests/inbox-data.cjs && node tests/state-regressions.cjs && node tests/installed-extension.cjs"
  },
  "dependencies": {
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "playwright": "1.61.1"
  }
}
```

## tests/inbox-data.cjs

```javascript
/* eslint-disable @typescript-eslint/no-require-imports -- Browser integration fixture. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let requests = 0;
    let response = { conversations: [{ id: 'a', messages: [{ text: 'Send your password immediately.' }] }] };
    await page.route('https://www.fiverr.com/**', route => {
      if (route.request().url().includes('/api/')) {
        requests++;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      }
      return route.fulfill({ contentType: 'text/html', body: '<nav>' + ['a', 'b', 'c', 'd', 'e'].map(id =>
        `<div data-testid="conversation-item" data-conversation-id="${id}"><span data-testid="username">Buyer ${id}</span></div>`).join('') + '</nav><main><header>Current chat</header></main>' });
    });
    await page.goto('https://www.fiverr.com/inbox/reading');
    await page.evaluate(() => {
      window.clicks = 0;
      window.sent = [];
      window.listeners = [];
      document.addEventListener('click', () => window.clicks++);
      window.chrome = {
        storage: { local: { get: async () => ({}) }, onChanged: { addListener: fn => window.listeners.push(fn) } },
        runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
          window.sent.push(message); return { ok: true, scores: {} };
        } },
      };
      window.__INITIAL_STATE__ = { conversations: [
        { id: 'b', messages: [{ text: 'Thanks for the logo.' }] },
        { id: 'c', last_message: { text: 'Thanks for the logo.' } },
        { id: 'e', messages: [{ text: 'Thanks for the logo.' }] },
      ] };
    });
    const add = async name => page.addScriptTag({ path: path.resolve('extension/' + name + '.js') });
    for (const file of ['page-data', 'page-observer', 'conversation-data']) await add(file);
    await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(async () => (await fetch('/api/inbox/conversations')).json()), response,
      'The page still receives the original response');
    for (const file of ['link-scanner', 'sensitive-information', 'analyzer', 'message-detector', 'message-extractor', 'conversation-detector', 'draft-guard']) await add(file);
    await page.evaluate(() => {
      const analyze = fsdAnalyze;
      window.analyses = 0;
      window.fsdAnalyze = (...args) => { window.analyses++; return analyze(...args); };
    });
    await add('content-script');
    const score = id => page.locator(`[data-conversation-id="${id}"] [data-fsd-flag]`).getAttribute('data-score');
    const waitScore = (id, expected) => page.waitForFunction(({ id, expected }) =>
      document.querySelector(`[data-conversation-id="${id}"] [data-fsd-flag]`)?.dataset.score === expected,
      { id, expected }, { timeout: 5000 });
    await waitScore('a', '100');
    await waitScore('b', '0');
    await waitScore('e', '0');
    assert.equal(await score('c'), 'null', 'Benign preview is insufficient for Safe');
    assert.equal(await score('d'), 'null', 'Missing data is not Safe');
    const calls = await page.evaluate(() => window.analyses);
    await page.evaluate(() => {
      const nav = document.querySelector('nav');
      for (const row of [...nav.children]) row.replaceWith(row.cloneNode(true));
    });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.analyses), calls, 'Equivalent rerenders reuse per-ID content hashes');
    assert.equal(await score('b'), '0');
    await page.evaluate(() => {
      const row = document.createElement('div');
      row.dataset.testid = 'conversation-item';
      row.id = 'scrolled-row';
      row.textContent = 'A new buyer';
      row.__reactProps$fixture = { conversation: { id: 'f', messages: [{ text: 'Thanks for the logo.' }] } };
      document.querySelector('nav').append(row);
    });
    await page.waitForFunction(() => document.querySelector('#scrolled-row [data-fsd-flag]')?.dataset.score === '0');
    assert.equal(await page.evaluate(() => fsdConversationData.key(document.querySelector('#scrolled-row'))), 'id:f');
    const beforeRename = await page.evaluate(() => window.analyses);
    await page.locator('#scrolled-row').evaluate(row => { row.firstChild.data = 'Updated display name'; });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#scrolled-row [data-fsd-flag]').getAttribute('data-score'), '0');
    assert.equal(await page.evaluate(() => window.analyses), beforeRename, 'Display-name changes preserve ID association without reanalysis');
    response = { data: { conversations: { edges: [{ node: { id: 'b', messages: { nodes: [{ text: 'Send your password immediately.' }] } } }] } } };
    await page.evaluate(() => fetch('/api/graphql', { method: 'POST', body: '{}' }).then(result => result.json()));
    await waitScore('b', '100');
    response = { conversation_id: 'e', message_id: 'new-e', text: 'Send your password immediately.' };
    assert.deepEqual(await page.evaluate(() => new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/messages');
      xhr.onload = () => resolve(JSON.parse(xhr.responseText));
      xhr.send();
    })), response);
    await waitScore('e', '100');
    // State snapshot hydration, including a conversation previously lacking data.
    await page.evaluate(() => {
      const node = document.createElement('script');
      node.type = 'application/json';
      node.dataset.state = 'inbox';
      node.textContent = JSON.stringify({ conversations: [{ id: 'd', messages: [{ text: 'Thanks for the delivery.' }] }] });
      document.body.append(node);
    });
    await waitScore('d', '0');
    assert.equal(requests, 3, 'Observer never generates additional network requests');
    assert.equal(await page.evaluate(() => window.clicks), 0);
    assert.equal(new URL(page.url()).pathname, '/inbox/reading');
    assert.equal(await page.locator('main header').textContent(), 'Current chat');
    const payload = await page.evaluate(() => JSON.stringify(window.sent));
    assert.ok(!payload.includes('Thanks for the logo') && !payload.includes('password'), 'Background data text is never forwarded to storage/worker');
    const beforeStop = await page.evaluate(() => window.analyses);
    await page.evaluate(() => window.listeners.forEach(fn => fn({ fsd_enabled: { newValue: false } }, 'local')));
    response = { conversations: [{ id: 'd', messages: [{ text: 'Send your OTP.' }] }] };
    await page.evaluate(() => fetch('/api/messages').then(result => result.json()));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.analyses), beforeStop, 'Disabled monitoring does not analyze responses');
    await page.locator('#scrolled-row').evaluate(row => {
      row.__reactProps$fixture.conversation.messages = [{ text: 'Send your password immediately.' }];
    });
    await page.evaluate(() => window.listeners.forEach(fn => fn({ fsd_enabled: { newValue: true } }, 'local')));
    await page.waitForFunction(() => document.querySelector('#scrolled-row [data-fsd-flag]')?.dataset.score === '100');
    console.log('PASS: unopened rows, early fetch, state, XHR, GraphQL, dynamic rows, rerenders, per-ID hashes, new messages, missing data, privacy, Stop, and no clicks/navigation/extra requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
```

## tests/extension-monitor.cjs

```javascript
﻿/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser fixture runner. */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<main><div data-testid="message" data-message-id="1">Send me your password immediately.</div></main>',
    );
    await page.evaluate(() => {
      const inbox = document.createElement("nav");
      inbox.innerHTML =
        '<div data-testid="conversation-item" data-conversation-id="old"><span>Existing chat</span><p data-testid="message-preview">Send me your password.</p></div><div data-testid="conversation-item" data-conversation-id="new"><span>Another chat</span><p data-testid="message-preview">Thanks for the delivery.</p></div>';
      document.body.prepend(inbox);
      const nested = document.createElement("div");
      nested.className = "conversation-list-item";
      nested.innerHTML =
        '<a href="/inbox/nested">Nested link chat</a><p class="message-preview">Send your password immediately.</p>';
      inbox.append(nested);
      const fallbackRow = document.createElement("div");
      fallbackRow.className = "conversation-list-item";
      fallbackRow.innerHTML =
        '<a href="/inbox/preview-scam">Preview fallback</a><span>Please verify your payment here.</span>';
      inbox.append(fallbackRow);
      const removedRow = document.createElement("div");
      removedRow.className = "conversation-list-item";
      removedRow.innerHTML =
        '<a href="/inbox/removed-account">Removed account</a><span>This user can no longer be contacted.</span>';
      inbox.append(removedRow);
    });
    await page.evaluate(() => {
      window.saved = {};
      window.resultBatches = 0;
      window.resultPayloads = [];
      window.changeListeners = [];
      window.pendingRiskLookups = [];
      window.holdRiskLookups = true;
      window.chrome = {
        storage: {
          local: {
            get: async () => ({ ...window.saved }),
            set: async (values) => {
              Object.assign(window.saved, values);
              for (const fn of window.changeListeners)
                fn(
                  Object.fromEntries(
                    Object.entries(values).map(([key, value]) => [
                      key,
                      { newValue: value },
                    ]),
                  ),
                  "local",
                );
            },
          },
          onChanged: { addListener: (fn) => window.changeListeners.push(fn) },
        },
        runtime: {
          onMessage: {
            addListener(fn) {
              window.runtimeListener = fn;
            },
          },
          sendMessage: async (message) => {
            if (message.type === "FSD_HEARTBEAT") return { ok: true };
            if (message.type === "FSD_VISIBILITY")
              return { ok: true, missingCount: 0 };
            if (message.type === "FSD_CONVERSATION_RISK" && !message.scores && window.holdRiskLookups)
              return new Promise(resolve => window.pendingRiskLookups.push(resolve));
            if (message.type === "FSD_CONVERSATION_RISK")
              return { ok: true, scores: {} };
            window.resultBatches++;
            window.resultPayloads.push(message);
            window.saved.fsd_last_result = message.results.at(-1);
            return { ok: true };
          },
        },
      };
    });
    await page.addScriptTag({ path: path.resolve("extension/analyzer.js") });
    await page.addScriptTag({
      path: path.resolve("extension/link-scanner.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/sensitive-information.js"),
    });
    await page.addScriptTag({ path: path.resolve("extension/draft-guard.js") });
    await page.addScriptTag({
      path: path.resolve("extension/message-detector.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/message-extractor.js"),
    });
    await page.addScriptTag({
      path: path.resolve("extension/conversation-detector.js"),
    });
    const extracted = await page.evaluate(() => {
      const conversation = document.createElement("div");
      conversation.dataset.conversationId = "private-conversation";
      conversation.innerHTML =
        '<div data-message-id="msg_123" data-sender="private-sender"><span data-testid="message-sender">private-sender</span><div data-testid="message-text">Please review<br>this <a href="https://example.com/reference">reference</a></div><time datetime="2026-09-12T17:00:00+05:00">5 PM</time></div>';
      document.body.append(conversation);
      const node = conversation.firstChild;
      const first = globalThis.fsdMessageExtractor.extract(node);
      const second = globalThis.fsdMessageExtractor.extract(node);
      node.removeAttribute("data-message-id");
      node.dataset.testid = "message";
      node.removeAttribute("data-sender");
      node.querySelector("span").remove();
      node.querySelector("time").setAttribute("datetime", "5 PM");
      const fallback = globalThis.fsdMessageExtractor.extract(node);
      const again = globalThis.fsdMessageExtractor.extract(node);
      conversation.dataset.conversationId = "different-conversation";
      const recycled = globalThis.fsdMessageExtractor.extract(node);
      const clone = node.cloneNode(true);
      conversation.append(clone);
      const cloneResult = globalThis.fsdMessageExtractor.extract(clone);
      conversation.remove();
      return { first, second, fallback, again, recycled, cloneResult };
    });
    assert.equal(extracted.first.id, "msg_123");
    assert.equal(extracted.first.sender, "private-sender");
    assert.equal(extracted.first.text, "Please review\nthis reference");
    assert.deepEqual(extracted.first.links, ["https://example.com/reference"]);
    assert.equal(extracted.first.timestamp, "2026-09-12T12:00:00.000Z");
    assert.equal(extracted.first.conversationId, "private-conversation");
    assert.ok(Number.isFinite(Date.parse(extracted.first.detectedAt)));
    assert.deepEqual(
      extracted.first,
      extracted.second,
      "Unchanged extraction preserves identity and first-detected time",
    );
    assert.equal(extracted.fallback.sender, null);
    assert.equal(extracted.fallback.timestamp, null);
    assert.match(extracted.fallback.id, /^msg_[a-f0-9]{32}$/);
    assert.equal(extracted.fallback.id, extracted.again.id);
    assert.notEqual(
      extracted.fallback.id,
      extracted.recycled.id,
      "Reused DOM nodes in different conversations get a new fallback ID",
    );
    assert.equal(
      extracted.recycled.id,
      extracted.cloneResult.id,
      "Fingerprint IDs are stable across equivalent DOM nodes",
    );
    const understood = await page.evaluate(() =>
      globalThis.fsdConversationDetector.inspect(),
    );
    assert.equal(understood.selected, false);
    assert.equal(understood.foundConversationArea, true);
    const extractionCases = await page.evaluate(() => {
      const wrapper = document.createElement("section");
      wrapper.innerHTML = '<div data-testid="message">You must send me your password.</div><div data-testid="message"><a href="https://fiverr-login.example"><img alt="Verify account"></a></div><div data-testid="message"><span data-testid="sender-name">You</span>Send your password.</div><div data-testid="message"><p>Send your OTP.</p></div>';
      document.querySelector("main").append(wrapper);
      const messages = [...wrapper.children].map(node => Boolean(globalThis.fsdMessageExtractor.extract(node)));
      const nested = globalThis.fsdMessageDetector.isMessage(wrapper.lastChild.firstChild);
      wrapper.remove();
      return { messages, nested };
    });
    assert.deepEqual(extractionCases.messages, [true, true, false, true], "Incoming You text and image-only links are checked; sender metadata excludes own messages");
    assert.equal(extractionCases.nested, false, "Nested paragraphs must not count the same native bubble twice");
    await page.addScriptTag({
      path: path.resolve("extension/content-script.js"),
    });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-conversation-id="old"] [data-fsd-flag]').getAttribute('data-state'), 'checked',
      'Risky previews render before background lookups complete');
    assert.equal(await page.locator('[data-conversation-id="new"] [data-fsd-flag]').getAttribute('data-score'), 'null',
      'Benign previews remain unknown without sufficient message data');
    await page.evaluate(() => {
      window.holdRiskLookups = false;
      window.pendingRiskLookups.splice(0).forEach(resolve => resolve({ ok: true, scores: {} }));
    });
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      1,
      "Starts monitoring automatically",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const fixtures = document.createElement('aside');
      fixtures.id = 'preview-regression';
      fixtures.innerHTML = '<div class="conversation-list-item" data-conversation-id="fallback-safe"><a href="/inbox/fallback-safe">Buyer</a><span>Thanks for the delivery.</span></div><div class="contact ce05uz8" data-conversation-id="contact-safe"><div class="user-info"><p>Buyer Two</p><p>Thanks for the logo.</p></div></div><div class="conversation-list-item" data-conversation-id="loading-preview" aria-busy="true"><a href="/inbox/loading-preview">Buyer Three</a><span>Loading...</span></div>';
      document.body.append(fixtures);
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-conversation-id="fallback-safe"] [data-fsd-flag]')?.dataset.state === 'unavailable' &&
      document.querySelector('[data-conversation-id="contact-safe"] [data-fsd-flag]')?.dataset.state === 'unavailable');
    assert.equal(await page.locator('[data-conversation-id="loading-preview"] [data-fsd-flag]').getAttribute('data-state'), 'checking');
    await page.locator('[data-conversation-id="loading-preview"]').evaluate(node => {
      node.removeAttribute('aria-busy');
      node.querySelector(':scope > span').firstChild.data = 'Thanks for the delivery.';
    });
    await page.waitForFunction(() => document.querySelector('[data-conversation-id="loading-preview"] [data-fsd-flag]')?.dataset.state === 'unavailable',
      null, { timeout: 1500 });
    await page.evaluate(() => {
      const row = document.createElement('div');
      row.className = 'contact ce05uz8';
      row.dataset.conversationId = 'no-preview';
      row.innerHTML = '<span class="avatar">A</span><div class="user-info"><p>Buyer Name</p></div><time>4 weeks</time>';
      document.querySelector('#preview-regression').append(row);
    });
    await page.waitForFunction(() => document.querySelector('[data-conversation-id="no-preview"] [data-fsd-flag]')?.dataset.state === 'unavailable');
    await page.locator('[data-conversation-id="no-preview"] .user-info').evaluate(node => {
      const preview = document.createElement('p');
      preview.textContent = 'Send your password immediately.';
      node.append(preview);
    });
    await page.waitForFunction(() => Number(document.querySelector('[data-conversation-id="no-preview"] [data-fsd-flag]')?.dataset.score) >= 61);
    await page.locator('[data-conversation-id="fallback-safe"] > span').evaluate(node => { node.textContent = 'Send your password immediately.'; });
    await page.waitForFunction(() => Number(document.querySelector('[data-conversation-id="fallback-safe"] [data-fsd-flag]')?.dataset.score) >= 61);
    await page.locator('#preview-regression').evaluate(node => node.remove());
    await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-fsd-warning]").count(), 1);
    assert.equal(
      await page
        .locator('[data-conversation-id="old"] [data-fsd-flag]')
        .count(),
      1,
      "Existing suspicious preview gets a flag",
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "Benign preview gets an unknown status flag",
    );
    await page
      .locator('[data-conversation-id="new"] [data-testid="message-preview"]')
      .evaluate((node) => {
        node.textContent = "Send your verification code immediately.";
      });
    await page.waitForTimeout(300);
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "New suspicious preview gets a flag",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/preview-scam"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Already visible suspicious chat rows are flagged",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/removed-account"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Fiverr unavailable contact rows are flagged",
    );
    assert.equal(
      await page.locator("[data-fsd-warning]").locator("strong").textContent(),
      "High Risk message",
    );
    const firstWarning = page.locator("[data-fsd-warning]").first();
    assert.equal(await firstWarning.locator("#details").isVisible(), false);
    assert.match(
      await firstWarning.locator("section").textContent(),
      /This message may be a phishing attempt/,
    );
    assert.match(
      await firstWarning.locator("section").textContent(),
      /Reasons:/,
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="old"] [data-fsd-flag]')
        .getByRole("img")
        .getAttribute("aria-label"),
      "High Risk conversation status.",
    );
    await fs.promises.mkdir(path.resolve("test-results"), { recursive: true });
    await firstWarning.screenshot({
      path: path.resolve("test-results/warning-desktop.png"),
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await firstWarning
      .getByRole("button", { name: "View details", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await firstWarning.locator("#details").isVisible(),
      true,
      "Details can be opened by keyboard",
    );
    await firstWarning.screenshot({
      path: path.resolve("test-results/warning-mobile.png"),
    });
    assert.equal(
      await firstWarning.evaluate((node) => {
        const section = node.shadowRoot.querySelector("section");
        return (
          section.scrollWidth <= section.clientWidth &&
          node.getBoundingClientRect().right <= innerWidth
        );
      }),
      true,
      "Expanded warning must fit a narrow viewport",
    );
    await firstWarning
      .getByRole("button", { name: "Hide details", exact: true })
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
    const append = async (text, outgoing = false) =>
      page.evaluate(
        ({ text, outgoing }) => {
          const node = document.createElement("div");
          node.dataset.testid = "message";
          if (outgoing) node.dataset.direction = "outgoing";
          node.textContent = text;
          document.querySelector("main").append(node);
        },
        { text, outgoing },
      );
    await append("Please send your verification code.");
    await append("Send me your password.", true);
    await append("Do not share your password or verification code.");
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "New incoming only; safe advice and outgoing ignored",
    );
    await page.evaluate(() =>
      document.body.append(document.createElement("span")),
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "No duplicates",
    );
    assert.equal(
      await page.locator('a[href="/inbox/nested"] [data-fsd-flag]').count(),
      1,
      "Nested links retain their conversation status flag",
    );
    assert.equal(
      await page.locator("[data-fsd-flag]").count(),
      5,
      "Flags do not duplicate on DOM updates",
    );
    const batches = await page.evaluate(() => window.resultBatches);
    await page.evaluate(() => {
      const analyze = globalThis.fsdAnalyze;
      window.messageAnalyses = 0;
      globalThis.fsdAnalyze = (text, links) => {
        if (text === "Please send your verification code.")
          window.messageAnalyses++;
        return analyze(text, links);
      };
    });
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 97 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 1,
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 96 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    await page
      .locator("[data-fsd-warning]")
      .last()
      .getByRole("button", { name: "Dismiss", exact: true })
      .click();
    await page.evaluate(() =>
      document.body.append(document.createElement("span")),
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      1,
      "DOM updates must preserve Hide",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_threshold: 30 }));
    await page.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.resultBatches),
      batches,
      "Threshold updates must not persist duplicate results",
    );
    assert.equal(
      await page.evaluate(() => window.messageAnalyses),
      0,
      "Threshold updates must reuse cached message analysis",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: false }));
    await append("Install AnyDesk and send your access code.");
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      2,
      "Stop disables monitoring",
    );
    await page.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-fsd-warning]").count(),
      3,
      "Restart scans pending messages without duplicate warnings",
    );
    await page.clock.install();
    const oldRow = page.locator('[data-conversation-id="old"]');
    await oldRow.locator('[data-testid="message-preview"]').evaluate((node) => {
      node.textContent = "Thanks for the delivery.";
    });
    await page.clock.runFor(400);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Risk is retained briefly after evidence disappears",
    );
    await oldRow.evaluate((node) => {
      node.dataset.conversationId = "replacement";
    });
    await page.clock.runFor(400);
    assert.equal(
      await page
        .locator('[data-conversation-id="replacement"] [data-fsd-flag]')
        .count(),
      1,
      "An identity-only row change gets a fresh safe flag",
    );
    await page
      .locator('[data-conversation-id="replacement"]')
      .evaluate((node) => {
        node.dataset.conversationId = "old";
      });
    await page.clock.runFor(400);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Returning to the original conversation restores its unexpired risk",
    );
    await page
      .locator('a[href="/inbox/nested"] >> xpath=../p')
      .evaluate((node) => {
        node.textContent = "Thanks.";
      });
    await page.clock.runFor(400);
    await page.locator('a[href="/inbox/nested"]').evaluate((node) => {
      node.href = "/inbox/replacement";
    });
    await page.clock.runFor(400);
    assert.equal(
      await page.evaluate(
        () =>
          document
            .querySelector('a[href="/inbox/replacement"]')
            .parentElement.querySelectorAll("[data-fsd-flag]").length,
      ),
      1,
      "Changing only the conversation link resets a reused row to safe",
    );
    await page.clock.fastForward(31 * 60 * 1000);
    assert.equal(
      await oldRow.locator("[data-fsd-flag]").count(),
      1,
      "Old evidence expires to a safe flag without further DOM updates",
    );
    assert.equal(
      await page
        .locator('[data-conversation-id="new"] [data-fsd-flag]')
        .count(),
      1,
      "Currently suspicious previews remain flagged after expiration",
    );
    assert.equal(
      await page
        .locator('a[href="/inbox/removed-account"] >> xpath=..')
        .locator("[data-fsd-flag]")
        .count(),
      1,
      "Unavailable contact rows stay flagged while visible",
    );
    let linkRequests = 0;
    page.on("request", () => {
      linkRequests++;
    });
    await page.evaluate(() => {
      const node = document.createElement("div");
      node.dataset.testid = "message";
      node.id = "link-message";
      const link = document.createElement("a");
      link.textContent = "https://example.org/design";
      link.href = "https://example.org/design";
      node.append(link);
      document.querySelector("main").append(node);
    });
    await page.clock.runFor(400);
    const linkWarning = page.locator("#link-message + [data-fsd-warning]");
    assert.equal(
      await linkWarning.count(),
      0,
      "Ordinary matching external links are not flagged",
    );
    await page.locator("#link-message a").evaluate((link) => {
      link.href =
        "https://destination.example/private-sender?token=private-token";
    });
    await page.clock.runFor(400);
    assert.equal(
      await linkWarning.count(),
      1,
      "An href-only change invalidates cached analysis",
    );
    await linkWarning
      .getByRole("button", { name: "View details", exact: true })
      .click();
    assert.equal(
      await linkWarning
        .getByRole("button", { name: "Hide details", exact: true })
        .getAttribute("aria-expanded"),
      "true",
    );
    assert.match(
      await linkWarning.locator("#details ul").textContent(),
      /destination.example.*example.org/,
    );
    await linkWarning
      .getByRole("button", { name: "Hide details", exact: true })
      .click();
    assert.equal(await linkWarning.locator("#details").isVisible(), false);
    await page.locator("#link-message a").evaluate((link) => {
      link.href = "https://example.org/design";
    });
    await page.clock.runFor(400);
    assert.equal(
      await linkWarning.count(),
      0,
      "Correcting the destination removes the warning",
    );
    await page.locator("#link-message").evaluate((node) => {
      node.dataset.direction = "outgoing";
      node.querySelector("a").href = "https://fiverr-login.example";
    });
    await page.clock.runFor(400);
    assert.equal(await linkWarning.count(), 0, "Outgoing links are excluded");
    assert.equal(linkRequests, 0, "Link checks must not make network requests");
    const payloads = await page.evaluate(() =>
      JSON.stringify(window.resultPayloads.map((batch) => batch.results)),
    );
    assert.equal(
      await page.evaluate(() =>
        window.resultPayloads
          .flatMap((batch) => batch.evidence || [])
          .every((record) => record.riskScore >= 61),
      ),
      true,
    );
    for (const value of [
      "destination.example",
      "example.org",
      "private-sender",
      "private-token",
      "linkDetails",
      "conversationId",
      "detectedAt",
      '"sender"',
      '"id"',
    ]) {
      assert.ok(
        !payloads.includes(value),
        "Link data must stay out of storage messages: " + value,
      );
    }
    const saved = await page.evaluate(() => window.saved);
    await page.evaluate(() => {
      window.analysisCalls = 0;
      window.documentScans = 0;
      const analyze = globalThis.fsdAnalyze;
      globalThis.fsdAnalyze = (...args) => {
        window.analysisCalls++;
        return analyze(...args);
      };
      const query = document.querySelectorAll.bind(document);
      document.querySelectorAll = (...args) => {
        window.documentScans++;
        return query(...args);
      };
      const noise = document.createElement("div");
      noise.id = "noise";
      document.body.append(noise);
    });
    for (let i = 0; i < 10; i++) {
      await page.evaluate((i) => {
        document.getElementById("noise").textContent = String(i);
      }, i);
      await page.clock.runFor(30);
    }
    await page.evaluate(() =>
      window.runtimeListener({ type: "FSD_STATUS" }, {}, () => {}),
    );
    assert.equal(
      await page.evaluate(() => window.analysisCalls),
      0,
      "Unrelated mutations and status requests do not analyze messages or previews",
    );
    assert.equal(
      await page.evaluate(() => window.documentScans),
      0,
      "Incremental updates never query the whole document",
    );
    await page.evaluate(() => {
      const node = document.createElement("div");
      node.id = "busy-message";
      node.dataset.testid = "message";
      node.textContent = "Send your password.";
      document.querySelector("main").append(node);
    });
    for (let i = 0; i < 8; i++) {
      await page.evaluate((i) => {
        document.getElementById("busy-message").firstChild.data =
          "Send your password. " + i;
      }, i);
      await page.clock.runFor(30);
    }
    assert.ok(
      await page.evaluate(() => window.analysisCalls > 0),
      "Continuous changes must be processed before the stream stops",
    );
    assert.equal(
      await page.locator("#busy-message + [data-fsd-warning]").count(),
      1,
    );
    await page.clock.runFor(300);
    const calls = await page.evaluate(() => window.analysisCalls);
    await page.clock.runFor(500);
    assert.equal(
      await page.evaluate(() => window.analysisCalls),
      calls,
      "Injected warnings must not cause rescans",
    );
    await page.locator("#busy-message").evaluate((node) => node.remove());
    await page.clock.runFor(300);
    assert.equal(await page.evaluate(() => window.documentScans), 0);
    await page.evaluate(() => {
      const wrapper = document.createElement("div");
      wrapper.id = "delayed-wrapper";
      wrapper.dataset.messageId = "delayed";
      wrapper.textContent = "Send your password.";
      const fragment = document.createDocumentFragment();
      fragment.append(wrapper);
      document.querySelector("main").append(fragment);
    });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper + [data-fsd-warning]").count(),
      1,
    );
    await page.locator("#delayed-wrapper").evaluate((node) => {
      const inner = document.createElement("div");
      inner.dataset.testid = "message-bubble";
      inner.textContent = "Send your password.";
      node.replaceChildren(inner);
    });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper + [data-fsd-warning]").count(),
      0,
      "A wrapper stops being a message when a nested bubble arrives",
    );
    assert.equal(
      await page.locator("#delayed-wrapper [data-fsd-warning]").count(),
      1,
    );
    await page
      .locator('#delayed-wrapper [data-testid="message-bubble"]')
      .evaluate((node) => {
        node.firstChild.data = "Thanks for your work.";
      });
    await page.clock.runFor(200);
    assert.equal(
      await page.locator("#delayed-wrapper [data-fsd-warning]").count(),
      0,
      "Text-node edits update the extracted message",
    );
    await page.locator("#delayed-wrapper").evaluate((node) => node.remove());
    await page.clock.runFor(200);
    assert.equal(
      JSON.stringify(saved).includes("password"),
      false,
      "No message text persisted",
    );
    console.log(
      "PASS: stopped by default, Run, incoming alerts, score, outgoing filter, safe advice, deduplication, Stop, restart, metadata-only storage.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## tests/installed-extension.cjs

```javascript
﻿const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scam-finder-test-"));
  const root = path.resolve(__dirname, "..");
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    const id = new URL(worker.url()).host;
    const protectedIds = await worker.evaluate(async () => ({ conversation: await fsdMetadata.reference('/inbox/test'), first: await fsdMetadata.reference('first') }));
    await context.route("https://www.fiverr.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body:
          '<html><body><main><div data-testid="message" data-message-id="first" data-sender="test-sender">Send me your password immediately. <a href="https://example.org/reference">Reference</a></div>' +
          '<div data-testid="message">Thanks for the logo.</div>'.repeat(105) +
          "</main></body></html>",
      }),
    );
    const chat = await context.newPage();
    await chat.goto("https://www.fiverr.com/inbox/test");
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/extension/home.html");
    await popup.waitForFunction(() => !document.getElementById("run").disabled);
    const popupSize = () =>
      popup.evaluate(() => ({
        width: document.documentElement.getBoundingClientRect().width,
        height: document.documentElement.getBoundingClientRect().height,
      }));
    assert.deepEqual(await popupSize(), { width: 392, height: 600 });
    const tabId = await popup.evaluate(
      async () =>
        (await chrome.tabs.query({ url: "https://www.fiverr.com/*" }))[0].id,
    );
    await popup.evaluate(
      (id) => chrome.tabs.update(id, { active: true }),
      tabId,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    assert.equal(
      await popup.locator("#run").textContent(),
      "Stop protection",
      "Protection starts automatically",
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("conversation-state").textContent ===
        "Chat found",
    );
    const conversationSummary = await popup
      .locator("#conversation-summary")
      .textContent();
    assert.match(conversationSummary, /Chat with/);
    assert.match(conversationSummary, /Messages from them/);
    assert.doesNotMatch(conversationSummary, /\/inbox\//);
    await chat.locator("[data-fsd-warning]").waitFor();
    assert.equal(
      await chat.locator("[data-fsd-warning]").locator("strong").textContent(),
      "High Risk message",
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /This message may be a phishing attempt/,
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /Reasons:/,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("risk").textContent === "Safe" &&
        document.getElementById("highest-risk").textContent === "High Risk",
    );
    assert.match(
      await popup.locator("#highest-signals").textContent(),
      /Do not share passwords or verification codes/,
    );
    assert.match(
      await popup.locator("#highest-categories").textContent(),
      /Sensitive data request/,
    );
    assert.match(
      await chat.locator("[data-fsd-warning]").locator("section").textContent(),
      /Sensitive data request/,
    );
    await chat.evaluate(() => {
      const editor = document.createElement("textarea");
      editor.id = "draft-editor";
      document.body.append(editor);
    });
    await chat.locator("#draft-editor").fill("OTP: 938271");
    await chat.locator("[data-fsd-draft-warning]").waitFor();
    assert.match(
      await chat
        .locator("[data-fsd-draft-warning]")
        .locator("section")
        .textContent(),
      /Never share authentication codes/,
    );
    const stored = await popup.evaluate(async () =>
      JSON.stringify(await chrome.storage.local.get(null)),
    );
    assert.ok(!stored.includes("938271"), "Draft contents never enter storage");
    await chat.locator("#draft-editor").fill("Thanks for your order.");
    assert.equal(await chat.locator("[data-fsd-draft-warning]").count(), 0);
    await chat.locator("#draft-editor").evaluate((node) => node.remove());
    await chat.evaluate(() => {
      const node = document.createElement("div");
      node.dataset.testid = "message";
      node.textContent = "Looks good.";
      document.querySelector("main").append(node);
    });
    await popup.waitForFunction(async () => {
      const data = await chrome.storage.local.get([
        "fsd_last_result",
        "fsd_highest_result",
      ]);
      return (
        data.fsd_last_result?.score === 0 &&
        data.fsd_highest_result?.score === 100 &&
        data.fsd_last_result.checkedAt > data.fsd_highest_result.checkedAt
      );
    });
    const beforeFallbackCount = await popup.evaluate(
      (tabId) =>
        chrome.tabs
          .sendMessage(tabId, { type: "FSD_STATUS" })
          .then((response) => response.messageCount),
      tabId,
    );
    await chat.evaluate(() => {
      const row = document.createElement("section");
      row.setAttribute("role", "listitem");
      row.innerHTML =
        "<strong>hinda_metropoli</strong><p>Hi, your experience really impressed me - interested in discussing further.</p>";
      document.querySelector("main").append(row);
    });
    await popup.waitForFunction(
      async ({ tabId, beforeFallbackCount }) => {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "FSD_STATUS",
        });
        return response.messageCount > beforeFallbackCount;
      },
      { tabId, beforeFallbackCount },
    );
    assert.deepEqual(
      await popupSize(),
      { width: 392, height: 600 },
      "Scan results must not resize the popup document",
    );
    assert.equal(
      await popup.evaluate(
        () => document.body.scrollWidth > document.body.clientWidth,
      ),
      false,
      "Popup must not overflow horizontally",
    );
    await chat.evaluate(() => {
      const row = document.createElement("div");
      row.className = "ce05uz8 contact";
      row.innerHTML =
        '<a href="/inbox/test"><p>test-sender</p><span>Me: Thank you</span></a>';
      document.querySelector("main").append(row);
    });
    await chat.locator(".ce05uz8.contact [data-fsd-flag]").waitFor();
    assert.equal(
      await chat
        .locator(".ce05uz8.contact [data-fsd-flag]")
        .getByRole("img")
        .getAttribute("aria-label"),
      "High Risk conversation status.",
    );
    await fs.promises.mkdir(path.join(root, "test-results"), {
      recursive: true,
    });
    await popup.screenshot({
      path: path.join(root, "test-results/status-monitoring.png"),
    });
    await chat.evaluate(() => {
      document.querySelector("main").hidden = true;
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "No incoming messages detected",
    );
    assert.match(
      await popup.locator("#notice").textContent(),
      /only your own replies or Fiverr system text/,
    );
    assert.equal(
      await popup.evaluate(() => document.body.dataset.monitoring),
      "false",
    );
    await chat.evaluate(() => {
      document.querySelector("main").hidden = false;
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await chat.evaluate(() => {
      window.originalMain = [...document.querySelector("main").childNodes];
      document.querySelector("main").innerHTML =
        '<div data-testid="message" data-direction="outgoing">Thanks.</div><div data-testid="message-preview"><div data-testid="message">Preview only</div></div>';
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "No incoming messages detected",
    );
    await chat.evaluate(() => {
      document.querySelector("main").innerHTML =
        "<p>Fiverr Only visible to you</p><p>cosmicpuma635 can no longer be contacted.</p>";
    });
    await popup.waitForFunction(
      () => document.getElementById("risk").textContent === "High Risk",
    );
    assert.match(
      await popup.locator("#categories").textContent(),
      /Fiverr contact unavailable/,
    );
    assert.match(
      await popup.locator("#conversation-summary").textContent(),
      /Fiverr notices/,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/inbox");
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Select a Fiverr conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/categories/graphics-design");
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Open a Fiverr conversation",
    );
    await chat.evaluate(() => {
      history.pushState({}, "", "/inbox/test");
      document.querySelector("main").replaceChildren(...window.originalMain);
    });
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    const other = await context.newPage();
    await other.goto("about:blank");
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Open a Fiverr conversation",
    );
    await popup.evaluate(
      (id) => chrome.tabs.update(id, { active: true }),
      tabId,
    );
    await popup.waitForFunction(
      () =>
        document.getElementById("status").textContent ===
        "Monitoring this conversation",
    );
    await other.close();
    await popup.close(); // Monitoring must survive closing its UI.
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Send me the verification code.";
      document.querySelector("main").append(m);
    });
    await chat.waitForFunction(
      () => document.querySelectorAll("[data-fsd-warning]").length === 2,
    );
    const settings = await context.newPage();
    await settings.goto("chrome-extension://" + id + "/extension/options.html");
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    const evidence = await settings.evaluate(() =>
      chrome.runtime.sendMessage({ type: "FSD_VAULT_LIST" }),
    );
    assert.equal(
      evidence.total,
      2,
      "Only high-risk incoming messages are captured; rescans are deduplicated",
    );
    const firstEvidence = evidence.rows.find((record) => record.id === protectedIds.first);
    assert.equal(firstEvidence.sender, undefined);
    assert.equal(firstEvidence.conversationId, protectedIds.conversation);
    assert.equal(firstEvidence.message, undefined);
    assert.equal(firstEvidence.links, undefined);
    assert.equal(firstEvidence.riskScore, 100);
    assert.ok(firstEvidence.categories.includes("ACCOUNT_VERIFICATION"));
    assert.ok(Number.isFinite(Date.parse(firstEvidence.capturedAt)));
    assert.ok(
      !JSON.stringify(evidence).includes("938271"),
      "Drafts are excluded from evidence",
    );
    const localHistory = await worker.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const readAll = (storeName) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const rows = tx.objectStore(storeName).getAll();
          rows.onsuccess = () => resolve(rows.result);
          rows.onerror = () => reject(rows.error);
        });
      const stores = Array.from(db.objectStoreNames);
      const [conversations, messages, riskEvents, evidenceRows, snapshots] =
        await Promise.all([
          readAll("conversations"),
          readAll("messages"),
          readAll("riskEvents"),
          readAll("evidence"),
          readAll("conversationSnapshots"),
        ]);
      db.close();
      return {
        stores,
        conversations,
        messages,
        riskEvents,
        evidenceRows,
        snapshots,
      };
    });
    for (const store of [
      "conversations",
      "messages",
      "riskEvents",
      "evidence",
      "conversationSnapshots",
    ])
      assert.ok(localHistory.stores.includes(store), store + " store exists");
    assert.ok(
      localHistory.conversations.some(
        (row) =>
          row.conversationId === protectedIds.conversation && row.highestRiskScore === 100,
      ),
    );
    assert.ok(
      localHistory.conversations.some(
        (row) =>
          row.conversationId === protectedIds.conversation &&
          row.conversationRiskScore === 100 &&
          row.riskLevel === "CRITICAL",
      ),
    );
    const storedMessage = localHistory.messages.find(
      (row) =>
        row.conversationId === protectedIds.conversation && row.messageId === protectedIds.first,
    );
    assert.ok(
      storedMessage &&
        storedMessage.senderType === "other" &&
        storedMessage.text === undefined && storedMessage.sender === undefined,
    );
    assert.equal(storedMessage.analysis.riskLevel, "CRITICAL");
    assert.equal(storedMessage.analysis.riskScore, 100);
    assert.ok(
      storedMessage.analysis.signals.includes(
        "Account credentials or verification code requested",
      ),
    );
    assert.ok(
      storedMessage.analysis.matches.some(
        (match) => match.ruleId === "account_credentials",
      ),
    );
    const storedRiskEvent = localHistory.riskEvents.find(
      (row) =>
        row.conversationId === protectedIds.conversation && row.messageId === protectedIds.first,
    );
    assert.ok(storedRiskEvent && storedRiskEvent.riskLevel === "CRITICAL");
    assert.ok(
      storedRiskEvent.matches.some(
        (match) => match.ruleId === "account_credentials",
      ),
    );
    assert.ok(
      localHistory.evidenceRows.some(
        (row) => row.id === protectedIds.first && row.riskScore === 100,
      ),
    );
    assert.equal(
      (await worker.evaluate(() => fsdEvidenceVault.risk(["/inbox/test"])))[
        "/inbox/test"
      ],
      100,
    );
    await worker.evaluate(() =>
      fsdEvidenceVault.missing("/inbox/test", ["first"], ["first"]),
    );
    await chat.locator('[data-message-id="first"]').evaluate((node) => {
      window.removedFirstMessage = node;
      node.remove();
    });
    await chat.locator("[data-fsd-previous]").waitFor();
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Previously flagged message is not visible/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Suspicious messages from this conversation are no longer visible on Fiverr/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Previously detected:\s*1/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /Risk:\s*High Risk/,
    );
    assert.match(
      await chat
        .locator("[data-fsd-previous]")
        .locator("section")
        .textContent(),
      /only appears because the missing message was already suspicious/i,
    );
    assert.equal(
      await chat
        .locator("[data-fsd-previous]")
        .getByRole("button", { name: "View Evidence", exact: true })
        .count(),
      1,
    );
    const [evidenceViewer] = await Promise.all([
      context.waitForEvent("page"),
      chat
        .locator("[data-fsd-previous]")
        .getByRole("button", { name: "View Evidence", exact: true })
        .click(),
    ]);
    await evidenceViewer.waitForLoadState("domcontentloaded");
    await evidenceViewer.waitForURL(/\/extension\/options\.html/);
    await evidenceViewer.locator("#conversation-evidence").waitFor();
    await evidenceViewer.waitForFunction(
      () => !document.getElementById("conversation-evidence").hidden,
    );
    assert.match(evidenceViewer.url(), /conversation=%2Finbox%2Ftest/);
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Scam evidence/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Saved conversation/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Status: HIGH RISK/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Previously captured messages: 2/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Message content is not stored/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Risk: High Risk/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /Account credentials or verification code requested/,
    );
    assert.match(
      await evidenceViewer.locator("#conversation-evidence").textContent(),
      /cannot prove Fiverr deleted a message/i,
    );
    await evidenceViewer.close();
    assert.equal(
      await chat
        .locator('[data-message-id="first"] + [data-fsd-warning]')
        .count(),
      0,
      "Removed messages lose their live warning",
    );
    await chat.evaluate(() => {
      document.querySelector("main").prepend(window.removedFirstMessage);
    });
    await chat.waitForFunction(
      () => document.querySelectorAll("[data-fsd-previous]").length === 0,
    );
    await chat
      .locator('[data-message-id="first"] + [data-fsd-warning]')
      .waitFor();
    const denied = await settings.evaluate(async (tabId) => {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          chrome.runtime
            .sendMessage({ type: "FSD_VAULT_LIST" })
            .catch(() => null),
      });
      return injection.result;
    }, tabId);
    assert.ok(!denied?.ok, "Fiverr content scripts cannot read the vault");
    await settings.reload();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    await settings.locator("#keep-history").check();
    await settings.locator("#save").click();
    await settings.waitForFunction(
      () => document.getElementById("notice").textContent === "Settings saved.",
    );
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Install AnyDesk immediately.";
      document.querySelector("main").append(m);
    });
    await settings.waitForFunction(
      () => document.getElementById("count").textContent === "1 records",
    );
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "3 records",
    );
    await settings
      .locator("#vault-records article")
      .first()
      .getByRole("button", { name: "Delete evidence", exact: true })
      .click();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "2 records",
    );
    await worker.evaluate(async () => {
      const records = Array.from({ length: 30 }, (_, index) => ({
        id: "page-test-" + index,
        conversationId: "pagination",
        sender: "fixture",
        message: "Synthetic evidence " + index,
        links: [],
        riskScore: 70,
        categories: ["PAYMENT_SCAM"],
        capturedAt: new Date().toISOString(),
      }));
      await fsdEvidenceVault.save([...records, records[0]]);
      await fsdEvidenceVault.observe([
        {
          id: "safe-observed",
          conversationId: "memory",
          riskScore: 0,
          categories: [],
          seenAt: new Date().toISOString(),
        },
        {
          id: "risky-observed",
          conversationId: "memory",
          riskScore: 90,
          categories: ["PHISHING"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-1",
          conversationId: "cumulative",
          riskScore: 5,
          categories: ["COERCION"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-2",
          conversationId: "cumulative",
          riskScore: 20,
          categories: ["EXTERNAL_COMMUNICATION"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-3",
          conversationId: "cumulative",
          riskScore: 30,
          categories: ["PAYMENT_SCAM"],
          seenAt: new Date().toISOString(),
        },
        {
          id: "cumulative-4",
          conversationId: "cumulative",
          riskScore: 35,
          categories: ["PAYMENT_SCAM"],
          seenAt: new Date().toISOString(),
        },
      ]);
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("conversationSnapshots", "readwrite");
          tx.objectStore("conversationSnapshots").delete("memory");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      });
      const initialMissing = await fsdEvidenceVault.missing(
        "memory",
        ["safe-observed", "risky-observed"],
        ["safe-observed", "risky-observed"],
      );
      if (initialMissing.missingCount !== 0)
        throw new Error(
          "First conversation snapshot should not report missing messages",
        );
      const missing = await fsdEvidenceVault.missing(
        "memory",
        ["safe-observed"],
        ["safe-observed", "risky-observed"],
      );
      if (
        missing.suspiciousMissingCount !== 1 ||
        missing.ignoredMissingCount !== 0 ||
        missing.maxRisk !== 90 ||
        missing.suspiciousMissingIds[0] !== await fsdMetadata.reference("risky-observed")
      )
        throw new Error(
          "Conversation memory did not detect missing suspicious state",
        );
      await fsdEvidenceVault.observe([
        {
          id: "safe-removed",
          conversationId: "safe-missing",
          riskScore: 0,
          categories: [],
          seenAt: new Date().toISOString(),
        },
        {
          id: "still-visible",
          conversationId: "safe-missing",
          riskScore: 90,
          categories: ["PHISHING"],
          seenAt: new Date().toISOString(),
        },
      ]);
      await fsdEvidenceVault.missing(
        "safe-missing",
        ["safe-removed", "still-visible"],
        ["safe-removed", "still-visible"],
      );
      const ignored = await fsdEvidenceVault.missing(
        "safe-missing",
        ["still-visible"],
        ["safe-removed", "still-visible"],
      );
      if (
        ignored.suspiciousMissingCount !== 0 ||
        ignored.ignoredMissingCount !== 1
      ) {
        throw new Error("Safe disappeared messages should be ignored");
      }
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const cumulativeKey = await fsdMetadata.reference("cumulative");
      const conversation = await new Promise((resolve, reject) => {
        const request = db
          .transaction("conversations", "readonly")
          .objectStore("conversations")
          .get(cumulativeKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (
        conversation.highestRiskScore !== 35 ||
        conversation.conversationRiskScore !== 63 ||
        conversation.riskLevel !== "HIGH"
      ) {
        throw new Error("Cumulative conversation risk was not saved as HIGH");
      }
    });
    await settings.locator("#vault-refresh").click();
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "32 records",
    );
    assert.equal(await settings.locator("#vault-records article").count(), 25);
    await settings.locator("#vault-next").click();
    await settings.waitForFunction(
      () => document.querySelectorAll("#vault-records article").length === 7,
    );
    await settings.locator("#vault-prev").click();
    await settings.waitForFunction(
      () => document.querySelectorAll("#vault-records article").length === 25,
    );
    const tester = await context.newPage();
    await tester.goto("chrome-extension://" + id + "/extension/tester.html");
    await tester.locator("#message").fill("Send me your password immediately.");
    await tester.locator("#tester > button").click();
    assert.equal(await tester.locator("#risk").textContent(), "High Risk");
    assert.match(
      await tester.locator("#categories").textContent(),
      /Sensitive data request/,
    );
    await tester.locator("#message").fill("Please pay outside Fiverr.");
    assert.equal(await tester.locator("#categories").textContent(), "");
    await tester.locator("#tester > button").click();
    assert.equal(
      await tester.locator("#categories").textContent(),
      "Possible payment scam",
    );
    assert.equal(
      await settings.locator("#history article strong").textContent(),
      "High Risk",
    );
    await settings.locator("#clear").click();
    await settings.waitForFunction(
      () => document.getElementById("count").textContent === "0 records",
    );
    await settings.waitForFunction(
      () => document.getElementById("vault-count").textContent === "0 records",
    );
    const popup2 = await context.newPage();
    await popup2.goto("chrome-extension://" + id + "/extension/home.html");
    await popup2.waitForFunction(
      () => !document.getElementById("run").disabled,
    );
    assert.equal(
      await popup2.locator("#highest-risk").textContent(),
      "No messages checked",
    );
    assert.equal(
      await popup2.locator("#risk").textContent(),
      "No messages checked",
    );
    await popup2.locator("#run").click();
    await popup2.waitForFunction(
      () => document.getElementById("status").textContent === "Stopped",
    );
    const count = await chat.locator("[data-fsd-warning]").count();
    await chat.evaluate(() => {
      const m = document.createElement("div");
      m.dataset.testid = "message";
      m.textContent = "Enter your card number.";
      document.querySelector("main").append(m);
    });
    await chat.waitForTimeout(400);
    assert.equal(await chat.locator("[data-fsd-warning]").count(), count);
    await fs.promises.mkdir(path.join(root, "test-results"), {
      recursive: true,
    });
    await popup2.screenshot({
      path: path.join(root, "test-results/popup.png"),
    });
    await popup2.evaluate(() => chrome.storage.local.set({ fsd_enabled: true }));
    const reloadChat = await context.newPage();
    let loading = false;
    await reloadChat.route("https://www.fiverr.com/inbox/reload-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<html><body><nav><div data-testid="conversation-item" data-conversation-id="reload-private-reference"><p data-testid="message-preview">' +
          (loading ? "" : "Send me your password immediately.") +
          '</p></div></nav><main>Loading conversation...</main></body></html>',
      }),
    );
    await reloadChat.goto("https://www.fiverr.com/inbox/reload-fixture");
    const reloadFlag = reloadChat.locator("[data-fsd-flag]");
    await reloadFlag.waitFor();
    const originalScore = await reloadFlag.getAttribute("data-score");
    assert.ok(Number(originalScore) > 60);
    await popup2.waitForFunction(async () => {
      const data = await chrome.storage.session.get("fsd_flag_scores");
      return Object.values(data.fsd_flag_scores || {}).some((record) => record.score === 100);
    });
    // Wait for the specific conversation to finish its queued cache write.
    const reloadHash = await worker.evaluate(() => fsdMetadata.reference("reload-private-reference"));
    await popup2.evaluate(hash => { window.reloadHash = hash; }, reloadHash);
    await popup2.waitForFunction(async () =>
      (await chrome.storage.session.get("fsd_flag_scores")).fsd_flag_scores?.[window.reloadHash],
    );
    loading = true;
    await reloadChat.reload();
    // Local status paints immediately; retained risk arrives asynchronously.
    await reloadChat.waitForFunction(score =>
      document.querySelector('[data-fsd-flag]')?.dataset.score === score,
      originalScore, { timeout: 5000 });
    assert.equal(await reloadFlag.getAttribute("data-score"), originalScore,
      "Reload restores the previous flag while the preview and messages are still loading");
    const flagCache = await popup2.evaluate(async () =>
      JSON.stringify(await chrome.storage.session.get("fsd_flag_scores")),
    );
    assert.ok(!flagCache.includes("reload-private-reference"));
    assert.ok(!flagCache.includes("password"));
    await reloadChat.close();
    // Exercise the real MAIN -> ISOLATED bridge, not only same-world fixtures.
    await context.route('https://www.fiverr.com/api/inbox/fixture', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [{ id: 'network-risk', messages: [{ text: 'Send your password immediately.' }] }] }),
    }));
    await context.route('https://www.fiverr.com/inbox/background-fixture', route => route.fulfill({
      contentType: 'text/html',
      body: '<html><head><script>window.__INITIAL_STATE__={conversations:[{id:"state-safe",messages:[{text:"Thanks for the logo."}]}]};fetch("/api/inbox/fixture").then(r=>r.json()).then(value=>window.pageResponse=value);</script></head><body><nav><div data-testid="conversation-item" data-conversation-id="network-risk">Network buyer</div><div data-testid="conversation-item" data-conversation-id="state-safe">State buyer</div><div data-testid="conversation-item" data-conversation-id="unknown">Unknown buyer</div></nav><main><header>Selected chat</header></main></body></html>',
    }));
    const backgroundChat = await context.newPage();
    const bridgeLogs = [];
    backgroundChat.on('console', message => bridgeLogs.push(message.text()));
    await popup2.evaluate(() => chrome.storage.local.set({ fsd_debug: true }));
    await backgroundChat.goto('https://www.fiverr.com/inbox/background-fixture');
    await backgroundChat.waitForFunction(() =>
      document.querySelector('[data-conversation-id="network-risk"] [data-fsd-flag]')?.dataset.score === '100' &&
      document.querySelector('[data-conversation-id="state-safe"] [data-fsd-flag]')?.dataset.score === '0').catch(async error => {
        console.error('Bridge diagnostics:', bridgeLogs, await backgroundChat.locator('nav').innerHTML());
        throw error;
      });
    assert.equal(await backgroundChat.locator('[data-conversation-id="unknown"] [data-fsd-flag]').getAttribute('data-score'), 'null');
    assert.equal(await backgroundChat.evaluate(() => window.pageResponse.conversations[0].id), 'network-risk');
    assert.equal(new URL(backgroundChat.url()).pathname, '/inbox/background-fixture');
    await backgroundChat.close();
    console.log(
      "PASS: real installed MV3 extension: Run, live alert, worker result, popup close, history opt-in, shared tester, delete data, Stop.",
    );
  } finally {
    await context.close();
    // This is an isolated test profile created above, never a user's browser profile.
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```
