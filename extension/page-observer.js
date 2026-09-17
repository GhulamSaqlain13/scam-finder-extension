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
  // Temporary investigation build: start before inbox bootstrap requests.
  let debug = true;
  let trace;
  let traceTimer;
  const xhrDetails = new WeakMap();
  const networkHistory = [];
  const responseHistory = [];
  function boundedPush(list, value, limit = 200) {
    list.push(value);
    while (list.length > limit) list.shift();
  }
  function cleanURL(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin + url.pathname;
    } catch { return String(value).split('?')[0].slice(0, 1000); }
  }
  function jsonSummary(value) {
    const ids = [];
    const messageFields = [];
    const moderationFields = [];
    const senderFields = [];
    const visited = new WeakSet();
    function walk(input, path = '$', depth = 0) {
      if (depth > 7) return '[max depth]';
      if (input == null || typeof input === 'boolean' || typeof input === 'number') return input;
      if (typeof input === 'string') return { type: 'string', present: input.length > 0, length: input.length };
      if (typeof input !== 'object') return '[' + typeof input + ']';
      if (visited.has(input)) return '[circular]';
      visited.add(input);
      if (Array.isArray(input)) return { type: 'array', length: input.length,
        sample: input.length ? walk(input[0], path + '[0]', depth + 1) : null };
      const result = {};
      for (const key of Object.keys(input).slice(0, 150)) {
        const fieldPath = path + '.' + key;
        if (/(?:authorization|cookie|csrf|xsrf|token|secret|password|session)/i.test(key)) {
          result[key] = '[REDACTED]';
          continue;
        }
        const child = own(input, key);
        if (/(?:conversation|thread).*(?:id)|^(?:conversation_id|conversationId|thread_id|threadId)$/i.test(key) &&
            (typeof child === 'string' || typeof child === 'number')) ids.push({ field: fieldPath, value: String(child).slice(0, 512) });
        if (/(?:message|body|content|preview|snippet|last_message|latest_message)/i.test(key)) messageFields.push(fieldPath);
        if (/(?:deleted|removed|blocked|unavailable|restricted|moderation|contactable|suspicious|status)/i.test(key)) moderationFields.push(fieldPath);
        if (/(?:sender|participant|username|user_name)/i.test(key)) senderFields.push(fieldPath);
        result[key] = walk(child, fieldPath, depth + 1);
      }
      return result;
    }
    return {
      fields: walk(value),
      conversationIds: ids.slice(0, 30),
      messageFields: [...new Set(messageFields)].slice(0, 100),
      moderationFields: [...new Set(moderationFields)].slice(0, 100),
      senderFields: [...new Set(senderFields)].slice(0, 100),
      messageDataAvailable: messageFields.length > 0,
      moderationDataAvailable: moderationFields.length > 0,
    };
  }
  function safeValue(value, depth = 0) {
    if (depth > 5) return '[max depth]';
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.slice(0, 4000);
    if (Array.isArray(value)) return value.slice(0, 50).map(item => safeValue(item, depth + 1));
    if (typeof value !== 'object') return '[' + typeof value + ']';
    const result = {};
    for (const key of Object.keys(value).slice(0, 100)) {
      if (/(?:authorization|cookie|csrf|xsrf|token|secret|password)/i.test(key)) result[key] = '[redacted]';
      else result[key] = safeValue(own(value, key), depth + 1);
    }
    return result;
  }
  function requestBody(value) {
    if (value == null) return null;
    if (typeof value === 'string') {
      try { return jsonSummary(JSON.parse(value)); } catch { return { type: 'text', length: value.length }; }
    }
    if (value instanceof URLSearchParams) return jsonSummary(Object.fromEntries(value));
    if (value instanceof FormData) return jsonSummary(Object.fromEntries(value));
    return '[' + (value.constructor?.name || typeof value) + ']';
  }
  function stateSnapshot(token) {
    const result = {};
    for (const key of ['__INITIAL_STATE__', '__PRELOADED_STATE__', '__NEXT_DATA__']) {
      const value = own(window, key);
      if (value && typeof value === 'object') result[key] = {
        extractedConversations: extract(value),
        data: jsonSummary(value),
      };
    }
    const row = token && document.querySelector('[data-fsd-row-token="' + token + '"]');
    if (row) for (const key of Object.keys(row).filter(key => key.startsWith('__reactProps$')))
      result.rowProps = {
        extractedConversations: extract(own(row, key)),
        data: jsonSummary(own(row, key)),
      };
    return result;
  }
  function domSnapshot(token) {
    const row = token && document.querySelector('[data-fsd-row-token="' + token + '"]');
    const main = document.querySelector('[data-testid="conversation-view"],[data-testid="messages"],[data-testid="conversation"],main,[role="main"]');
    const summarize = (node, includeText = false) => {
      if (!node) return null;
      const value = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        text: includeText ? value.slice(0, 500) : undefined,
        textAvailable: Boolean(value),
        textLength: value.length,
        moderationSignals: [...value.matchAll(/[^.!?]{0,80}\b(?:can no longer be contacted|deleted|removed|blocked|unavailable|restricted)\b[^.!?]{0,80}/gi)]
          .map(match => match[0].trim()).slice(0, 10),
        messageElementCount: node.querySelectorAll?.('[data-message-id],[data-testid="message"],[data-testid="message-bubble"]').length || 0,
        attributes: Object.fromEntries([...node.attributes].slice(0, 30).map(item => [item.name, item.value])),
      };
    };
    return { path: location.pathname, row: summarize(row, true), conversationArea: summarize(main) };
  }
  function recordNetwork(entry) {
    if (!debug) return;
    const safe = { at: Date.now(), ...entry, url: entry.url ? cleanURL(entry.url) : undefined };
    boundedPush(networkHistory, safe);
    if (trace) trace.network.push(safe);
  }
  function recordResponse(transport, url, value) {
    if (!debug) return;
    const summary = { at: Date.now(), transport, url: cleanURL(url), ...jsonSummary(value) };
    boundedPush(responseHistory, summary, 100);
    if (trace) trace.responses.push(summary);
  }
  function finishTrace() {
    clearTimeout(traceTimer);
    traceTimer = undefined;
    const current = trace;
    trace = undefined;
    if (!current) return;
    const row = current.token && document.querySelector('[data-fsd-row-token="' + current.token + '"]');
    const badge = row?.querySelector('[data-fsd-flag]');
    const risk = badge ? {
      score: badge.dataset.score,
      state: badge.dataset.state,
      source: badge.dataset.source,
      coverage: badge.dataset.coverage,
      label: badge.shadowRoot?.querySelector('.badge-label')?.textContent || null,
    } : null;
    console.group('[DEBUG] ===== AFTER CLICK =====');
    console.debug('[DEBUG] Conversation ID:', current.conversationId);
    current.afterDOM = domSnapshot(current.token);
    current.afterState = stateSnapshot(current.token);
    current.risk = risk;
    const has = (value, pattern) => pattern.test(JSON.stringify(value || {}));
    const beforeSource = [current.beforeResponses, current.beforeState, current.beforeDOM];
    const afterSource = [current.responses, current.records, current.afterState, current.afterDOM];
    current.diff = [
      { Data: 'Conversation ID', 'Before Click': current.subject?.conversationId || current.conversationId || 'NOT FOUND',
        'After Click': current.conversationId || 'NOT FOUND' },
      { Data: 'Username', 'Before Click': current.subject?.username || 'NOT FOUND',
        'After Click': current.subject?.username || 'NOT FOUND' },
      { Data: 'Message preview', 'Before Click': current.subject?.preview ? 'AVAILABLE' : 'NOT AVAILABLE',
        'After Click': current.subject?.preview ? 'AVAILABLE' : 'NOT AVAILABLE' },
      { Data: 'Full messages', 'Before Click': has(beforeSource, /messageDataAvailable[^}]*true|messageElementCount[^}]*[1-9]/) ? 'AVAILABLE' : 'NOT AVAILABLE',
        'After Click': has(afterSource, /messageDataAvailable[^}]*true|messageElementCount[^}]*[1-9]/) ? 'AVAILABLE' : 'NOT AVAILABLE' },
      { Data: 'Sender information', 'Before Click': has(beforeSource, /senderFields[^\]]+\$/) ? 'AVAILABLE' : 'NOT AVAILABLE',
        'After Click': has(afterSource, /senderFields[^\]]+\$/) ? 'AVAILABLE' : 'NOT AVAILABLE' },
      { Data: 'Moderation status', 'Before Click': has(beforeSource, /moderationDataAvailable[^}]*true|moderationSignals[^\]]+[A-Za-z]/) ? 'AVAILABLE' : 'NOT AVAILABLE',
        'After Click': has(afterSource, /moderationDataAvailable[^}]*true|moderationSignals[^\]]+[A-Za-z]/) ? 'AVAILABLE' : 'NOT AVAILABLE' },
      { Data: 'Deleted-message information', 'Before Click': has(beforeSource, /deleted|removed/i) ? 'FIELD OBSERVED' : 'NOT AVAILABLE',
        'After Click': has(afterSource, /deleted|removed/i) ? 'FIELD OBSERVED' : 'NOT AVAILABLE' },
      { Data: 'Conversation status', 'Before Click': current.subject?.currentStatus || 'NO_PREVIEW',
        'After Click': risk?.label || risk?.state || 'UNKNOWN' },
      { Data: 'Relevant API response', 'Before Click': current.beforeResponses.length ? 'YES' : 'NO',
        'After Click': current.responses.length ? 'YES' : 'NO' },
    ];
    window.__FSD_DEBUG_TRACE__ = current;
    console.debug('[SCAM DEBUG] AFTER CLICK');
    console.debug('[SCAM DEBUG] Conversation ID:', current.conversationId);
    console.debug('[SCAM DEBUG] New request(s):', current.network);
    console.debug('[SCAM DEBUG] New response fields:', current.responses);
    console.debug('[SCAM DEBUG] New DOM data:', current.afterDOM);
    console.debug('[SCAM DEBUG] New application-state data:', current.afterState);
    console.debug('[SCAM DEBUG] Messages:', current.records);
    console.debug('[SCAM DEBUG] Risk:', risk);
    console.debug('[SCAM DEBUG] ===== DIFF =====');
    console.table(current.diff);
    console.groupEnd();
  }
  function beginTrace(token, conversationId = null, subject = null) {
    finishTrace();
    trace = { token, conversationId, startedAt: Date.now(), network: [], responses: [], records: [],
      beforeNetwork: [...networkHistory], beforeResponses: [...responseHistory],
      subject: subject ? { ...subject, conversationId } : null };
    trace.beforeState = stateSnapshot(token);
    trace.beforeDOM = domSnapshot(token);
    console.group('[SCAM DEBUG] ===== BEFORE CLICK ===== (page context)');
    console.debug('[SCAM DEBUG] Conversation ID:', conversationId);
    console.debug('[SCAM DEBUG] Available data:', {
      dom: trace.beforeDOM,
      applicationState: trace.beforeState,
      relevantNetworkRequests: trace.beforeNetwork,
      relevantNetworkResponses: trace.beforeResponses,
    });
    console.groupEnd();
    traceTimer = setTimeout(finishTrace, 3000);
  }
  function publish(value, source, rowToken) {
    if (!enabled || !/^\/inbox(?:\/|$)/.test(location.pathname)) return;
    try {
      const records = extract(value);
      if (debug && trace && records.length)
        trace.records.push({ source, records: jsonSummary(records) });
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
    recordNetwork({ transport: 'fetch-response', url: response.url, status: response.status,
      contentType: response.headers.get('content-type') || null });
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
      const data = JSON.parse(new TextDecoder().decode(bytes));
      recordResponse('fetch', response.url, data);
      publish(data, 'fetch');
    } finally { reader.releaseLock(); }
  }
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const input = args[0];
    const init = args[1] || {};
    const request = input instanceof Request ? input : null;
    const requestEntry = {
      transport: 'fetch',
      url: cleanURL(request?.url || input),
      method: String(init.method || request?.method || 'GET').toUpperCase(),
      payload: requestBody(init.body),
    };
    recordNetwork(requestEntry);
    if (request && init.body === undefined)
      request.clone().text().then(body => {
        if (body) recordNetwork({ transport: 'fetch-request-body', url: request.url, payload: requestBody(body) });
      }).catch(() => {});
    const result = Reflect.apply(originalFetch, this, args);
    const version = generation;
    result.then(response => { void observeResponse(response, version).catch(() => {}); }, () => {});
    return result;
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    xhrDetails.set(this, { transport: 'XHR', method: String(method).toUpperCase(), url: String(url) });
    return Reflect.apply(originalOpen, this, [method, url, ...args]);
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    recordNetwork({ ...(xhrDetails.get(this) || { transport: 'XHR' }), payload: requestBody(args[0]) });
    const version = generation;
    this.addEventListener('load', () => {
      recordNetwork({ transport: 'XHR-response', ...(xhrDetails.get(this) || {}),
        url: this.responseURL || xhrDetails.get(this)?.url, status: this.status,
        contentType: this.getResponseHeader('content-type') || null });
      if (!enabled || version !== generation || this.status < 200 || this.status >= 300 ||
          !supportedURL(this.responseURL) || !/json/i.test(this.getResponseHeader('content-type') || '')) return;
      try {
        if (this.responseType === 'json') {
          const size = Number(this.getResponseHeader('content-length'));
          if (size <= maxBytes) {
            recordResponse('XHR', this.responseURL, this.response);
            publish(this.response, 'XHR');
          }
        } else if (!this.responseType || this.responseType === 'text') {
          if (this.responseText.length <= maxBytes) {
            const data = JSON.parse(this.responseText);
            recordResponse('XHR', this.responseURL, data);
            publish(data, 'XHR');
          }
        }
      } catch { /* Ignore non-JSON, inaccessible and oversized responses. */ }
    }, { once: true });
    return Reflect.apply(originalSend, this, args);
  };
  const NativeWebSocket = window.WebSocket;
  function ObservedWebSocket(...args) {
    const socket = Reflect.construct(NativeWebSocket, args, new.target || NativeWebSocket);
    recordNetwork({ transport: 'WebSocket', direction: 'connect', url: String(args[0]), protocols: safeValue(args[1]) });
    socket.addEventListener('message', event => recordNetwork({
      transport: 'WebSocket', direction: 'receive', url: socket.url,
      payload: typeof event.data === 'string' ? requestBody(event.data) : '[' + (event.data?.constructor?.name || 'binary') + ']',
    }));
    const nativeSend = socket.send;
    socket.send = function (data) {
      recordNetwork({ transport: 'WebSocket', direction: 'send', url: socket.url, payload: requestBody(data) });
      return Reflect.apply(nativeSend, this, [data]);
    };
    return socket;
  }
  Object.setPrototypeOf(ObservedWebSocket, NativeWebSocket);
  ObservedWebSocket.prototype = NativeWebSocket.prototype;
  for (const name of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'])
    Object.defineProperty(ObservedWebSocket, name, { value: NativeWebSocket[name] });
  window.WebSocket = ObservedWebSocket;
  document.addEventListener('click', event => {
    if (!debug || !(event.target instanceof Element)) return;
    const row = event.target.closest(
      '[data-testid="conversation-item"],[data-testid="inbox-conversation"],[data-conversation-id],[data-thread-id],.conversation-list-item,.conversation-item,.inbox-conversation,.inbox-list-item,.ce05uz8.contact,.ce05uz0.contact,nav [role="listitem"],aside [role="listitem"]',
    );
    if (!row) return;
    beginTrace(row.getAttribute('data-fsd-row-token'));
  }, true);
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
    if (event.data.type === 'debug-control') {
      debug = event.data.debug === true;
      if (!debug) {
        trace = undefined; clearTimeout(traceTimer); traceTimer = undefined;
        networkHistory.length = 0; responseHistory.length = 0;
      }
      return;
    }
    if (event.data.type === 'debug-before' && debug) {
      const token = typeof event.data.token === 'string' ? event.data.token : null;
      const before = {
        conversationId: typeof event.data.conversationId === 'string' ? event.data.conversationId : null,
        dom: domSnapshot(token),
        applicationState: stateSnapshot(token),
        relevantNetworkRequests: [...networkHistory],
        relevantNetworkResponses: [...responseHistory],
        subject: event.data.subject || null,
      };
      window.__FSD_DEBUG_BEFORE__ = before;
      console.debug('[SCAM DEBUG] Page/network BEFORE CLICK:', before);
      return;
    }
    if (event.data.type === 'debug-click' && debug) {
      const token = typeof event.data.token === 'string' ? event.data.token : null;
      const conversationId = typeof event.data.conversationId === 'string' ? event.data.conversationId : null;
      if (trace && trace.token === token) {
        trace.conversationId = conversationId;
        trace.subject = { ...(event.data.subject || {}), conversationId };
      } else beginTrace(token, conversationId, event.data.subject || null);
      return;
    }
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
