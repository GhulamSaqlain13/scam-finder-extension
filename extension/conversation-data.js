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
  // Temporary investigation build: enabled unless explicitly disabled.
  let debug = true;
  let onUpdate;
  let timer;
  let debugStableTimer;
  let debugBeforeSignature;
  let generation = 0;
  function log(label, value) { if (debug) console.debug('[ScamDetector] ' + label, value); }
  function text(node) {
    return (node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function debugRow(row) {
    if (!row) return null;
    const usernameNode = row.querySelector(
      '[data-testid="username"],[data-testid="conversation-name"],.user-info > p:first-child,[class*="username" i],[class*="user-name" i]',
    );
    const previewNode = row.querySelector(
      '[data-testid="message-preview"],[data-testid="last-message"],[class*="message-preview" i],[class*="last-message" i],.message-preview,.last-message,.message-snippet,.conversation-preview,.contact-excerpt,.user-info > p:not(:first-child)',
    );
    const attributes = Object.fromEntries(
      [...row.attributes]
        .filter(attribute => !attribute.name.startsWith('data-fsd-'))
        .slice(0, 30)
        .map(attribute => [attribute.name, attribute.value]),
    );
    const hrefNode = row.matches('a[href]') ? row : row.querySelector('a[href]');
    const timeNode = row.querySelector('time,[data-testid*="time" i],[class*="timestamp" i]');
    return {
      conversationId: key(row),
      username: text(usernameNode) || null,
      preview: text(previewNode) || null,
      href: hrefNode?.getAttribute('href') || null,
      timestamp: text(timeNode) || null,
      dataAttributes: Object.fromEntries([...row.attributes]
        .filter(attribute => attribute.name.startsWith('data-') && !attribute.name.startsWith('data-fsd-'))
        .map(attribute => [attribute.name, attribute.value])),
      ariaAttributes: Object.fromEntries([...row.attributes]
        .filter(attribute => attribute.name.startsWith('aria-'))
        .map(attribute => [attribute.name, attribute.value])),
      dom: {
        tag: row.tagName.toLowerCase(),
        attributes,
        text: text(row).slice(0, 2000),
      },
      availableMetadata: get(row),
      currentStatus: row.querySelector('[data-fsd-flag]')?.shadowRoot
        ?.querySelector('.badge-label')?.textContent || null,
    };
  }
  function scheduleBeforeReport() {
    if (!debug || !enabled) return;
    clearTimeout(debugStableTimer);
    debugStableTimer = setTimeout(() => {
      debugStableTimer = undefined;
      const selector = '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],[data-thread-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item,.ce05uz8.contact,.ce05uz0.contact,nav [role="listitem"],aside [role="listitem"]';
      const rows = [...document.querySelectorAll(selector)].filter(row => !row.querySelector(selector));
      const target = rows.find(row => /cosmicpuma/i.test(text(row))) ||
        rows.find(row => row.querySelector('[data-fsd-flag]')?.dataset.state === 'unavailable');
      if (!target) return;
      const snapshot = debugRow(target);
      const signature = JSON.stringify([snapshot.conversationId, snapshot.preview, snapshot.currentStatus, snapshot.dom.attributes]);
      if (signature === debugBeforeSignature) return;
      debugBeforeSignature = signature;
      console.group('[SCAM DEBUG] ===== BEFORE CLICK =====');
      console.debug('[SCAM DEBUG] Inbox initialized');
      console.debug('[SCAM DEBUG] Conversation:', snapshot.username);
      console.debug('[SCAM DEBUG] Conversation ID:', snapshot.conversationId);
      console.debug('[SCAM DEBUG] Preview:', snapshot.preview);
      console.debug('[SCAM DEBUG] DOM:', snapshot.dom);
      console.debug('[SCAM DEBUG] href:', snapshot.href);
      console.debug('[SCAM DEBUG] data attributes:', snapshot.dataAttributes);
      console.debug('[SCAM DEBUG] aria attributes:', snapshot.ariaAttributes);
      console.debug('[SCAM DEBUG] timestamp:', snapshot.timestamp);
      console.debug('[SCAM DEBUG] Data source:', snapshot.availableMetadata?.source || (snapshot.preview ? 'DOM' : 'UNKNOWN'));
      console.debug('[SCAM DEBUG] Message data:', snapshot.availableMetadata?.kind === 'messages' ? 'AVAILABLE' : 'NOT AVAILABLE');
      console.debug('[SCAM DEBUG] Moderation data:', 'NOT ESTABLISHED');
      console.debug('[SCAM DEBUG] Conversation metadata:', snapshot.availableMetadata || 'NOT AVAILABLE');
      console.debug('[SCAM DEBUG] Status:', snapshot.currentStatus || 'NO_PREVIEW');
      console.groupEnd();
      window.postMessage({ channel, type: 'debug-before',
        token: target.getAttribute('data-fsd-row-token'), conversationId: snapshot.conversationId,
        subject: { username: snapshot.username, preview: snapshot.preview, href: snapshot.href,
          timestamp: snapshot.timestamp, currentStatus: snapshot.currentStatus } }, location.origin);
    }, 1200);
  }
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
      clearTimeout(debugStableTimer); debugStableTimer = undefined; debugBeforeSignature = undefined;
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
      if (debug) {
        const snapshot = debugRow(row);
        console.groupCollapsed('[SCAM DEBUG] Inbox conversation found');
        console.debug('[SCAM DEBUG] Conversation ID:', snapshot.conversationId);
        console.debug('[SCAM DEBUG] Username:', snapshot.username);
        console.debug('[SCAM DEBUG] Preview:', snapshot.preview);
        console.debug('[SCAM DEBUG] DOM data:', snapshot.dom);
        console.debug('[SCAM DEBUG] Available conversation metadata:', snapshot.availableMetadata);
        console.debug('[SCAM DEBUG] Current status:', snapshot.currentStatus);
        console.groupEnd();
      }
    }
    for (const [token, row] of rowTokens) if (!row.isConnected) rowTokens.delete(token);
    bound(rowTokens);
    for (let i = 0; i < tokens.length; i += 100)
      window.postMessage({ channel, type: 'resolve', tokens: tokens.slice(i, i + 100) }, location.origin);
    scheduleBeforeReport();
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
  document.addEventListener('click', event => {
    if (!debug || !enabled || !(event.target instanceof Element)) return;
    const row = event.target.closest(
      '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],[data-thread-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item,.ce05uz8.contact,.ce05uz0.contact,nav [role="listitem"],aside [role="listitem"]',
    );
    if (!row) return;
    const snapshot = debugRow(row);
    console.group('[SCAM DEBUG] ===== BEFORE CLICK =====');
    console.debug('[SCAM DEBUG] Conversation ID:', snapshot.conversationId);
    console.debug('[SCAM DEBUG] Username:', snapshot.username);
    console.debug('[SCAM DEBUG] Preview:', snapshot.preview);
    console.debug('[SCAM DEBUG] Available data:', snapshot);
    console.groupEnd();
    window.postMessage({
      channel,
      type: 'debug-click',
      token: row.getAttribute('data-fsd-row-token'),
      conversationId: snapshot.conversationId,
      subject: { username: snapshot.username, preview: snapshot.preview, href: snapshot.href,
        timestamp: snapshot.timestamp, currentStatus: snapshot.currentStatus },
    }, location.origin);
  }, true);
  // Install the receiver at document_start so early page responses are not lost.
  let storageVersion = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.fsd_debug) {
      debug = changes.fsd_debug.newValue === true;
      window.postMessage({ channel, type: 'debug-control', debug }, location.origin);
      scheduleBeforeReport();
    }
    if (changes.fsd_enabled) { storageVersion++; control(changes.fsd_enabled.newValue !== false); }
    if (changes.fsd_cache_reset) { cache.clear(); pending.clear(); aliases.clear(); generation++; }
  });
  const version = storageVersion;
  chrome.storage.local.get(['fsd_enabled', 'fsd_debug']).then(settings => {
    debug = settings.fsd_debug !== false;
    window.postMessage({ channel, type: 'debug-control', debug }, location.origin);
    if (version === storageVersion) control(settings.fsd_enabled !== false);
  }).catch(() => control(false));
})();
