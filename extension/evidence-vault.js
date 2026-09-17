(() => {
  let connection;
  let migration;
  async function ready() {
    const db = await open();
    if (!migration) migration = globalThis.fsdMetadata.migrate(db).catch(error => { migration = undefined; throw error; });
    await migration;
    return db;
  }
  function open() {
    if (!connection)
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence", 7);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("schema")) request.result.createObjectStore("schema");
          const store = request.result.objectStoreNames.contains("evidence")
            ? request.transaction.objectStore("evidence")
            : request.result.createObjectStore("evidence");
          if (!store.indexNames.contains("capturedAt"))
            store.createIndex("capturedAt", "capturedAt");
          if (!store.indexNames.contains("conversationId"))
            store.createIndex("conversationId", "conversationId");
          const conversations = request.result.objectStoreNames.contains(
            "conversations",
          )
            ? request.transaction.objectStore("conversations")
            : request.result.createObjectStore("conversations");
          if (!conversations.indexNames.contains("lastObservedAt"))
            conversations.createIndex("lastObservedAt", "lastObservedAt");
          if (!conversations.indexNames.contains("highestRiskScore"))
            conversations.createIndex("highestRiskScore", "highestRiskScore");
          const messages = request.result.objectStoreNames.contains("messages")
            ? request.transaction.objectStore("messages")
            : request.result.createObjectStore("messages");
          if (!messages.indexNames.contains("conversationId"))
            messages.createIndex("conversationId", "conversationId");
          if (!messages.indexNames.contains("suspiciousConversationKey"))
            messages.createIndex("suspiciousConversationKey", [
              "conversationId",
              "suspiciousKey",
            ]);
          if (!messages.indexNames.contains("capturedAt"))
            messages.createIndex("capturedAt", "capturedAt");
          const riskEvents = request.result.objectStoreNames.contains(
            "riskEvents",
          )
            ? request.transaction.objectStore("riskEvents")
            : request.result.createObjectStore("riskEvents");
          if (!riskEvents.indexNames.contains("conversationId"))
            riskEvents.createIndex("conversationId", "conversationId");
          if (!riskEvents.indexNames.contains("capturedAt"))
            riskEvents.createIndex("capturedAt", "capturedAt");
          const snapshots = request.result.objectStoreNames.contains(
            "conversationSnapshots",
          )
            ? request.transaction.objectStore("conversationSnapshots")
            : request.result.createObjectStore("conversationSnapshots");
          if (!snapshots.indexNames.contains("capturedAt"))
            snapshots.createIndex("capturedAt", "capturedAt");
          const state = request.result.objectStoreNames.contains(
            "conversationMessages",
          )
            ? request.transaction.objectStore("conversationMessages")
            : request.result.createObjectStore("conversationMessages");
          if (!state.indexNames.contains("conversationId"))
            state.createIndex("conversationId", "conversationId");
          if (state.indexNames.contains("suspiciousConversation"))
            state.deleteIndex("suspiciousConversation");
          if (!state.indexNames.contains("suspiciousConversationKey"))
            state.createIndex("suspiciousConversationKey", [
              "conversationId",
              "suspiciousKey",
            ]);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            connection = undefined;
            migration = undefined;
          };
          resolve(db);
        };
        request.onerror = () => {
          connection = undefined;
          reject(request.error);
        };
      });
    return connection;
  }
  function complete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () =>
        reject(transaction.error || Error("Evidence transaction aborted"));
      transaction.onerror = () => reject(transaction.error);
    });
  }
  function riskLevel(score) {
    return score <= 20
      ? "SAFE"
      : score <= 40
        ? "LOW"
        : score <= 60
          ? "SUSPICIOUS"
          : score <= 80
            ? "HIGH"
            : "CRITICAL";
  }
  function conversationRiskScore(scores) {
    const values = scores
      .filter((score) => Number.isInteger(score) && score > 0)
      .sort((a, b) => b - a);
    if (!values.length) return 0;
    return Math.min(
      100,
      values[0] +
        Math.round(
          values.slice(1).reduce((sum, score) => sum + score, 0) * 0.5,
        ),
    );
  }
  async function save(records) {
    if (!records.length) return;
    const keyed = await Promise.all(
      records.map(async (record) => {
        const identity = [
          record.conversationId,
          record.id,
          record.sender,
          record.message,
          record.links,
          record.riskScore,
          record.categories,
        ];
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(identity)),
        );
        return {
          key: Array.from(new Uint8Array(digest), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join(""),
          record,
        };
      }),
    );
    const db = await ready();
    const tx = db.transaction("evidence", "readwrite");
    const done = complete(tx);
    const store = tx.objectStore("evidence");
    for (const [key, record] of new Map(
      keyed.map((item) => [item.key, item.record]),
    )) {
      const existing = store.get(key);
      existing.onsuccess = () => {
        if (!existing.result) store.add(record, key);
      };
    }
    await done;
  }
  async function observe(records) {
    if (!records.length) return;
    const db = await ready();
    const tx = db.transaction(
      ["conversations", "messages", "riskEvents", "conversationMessages"],
      "readwrite",
    );
    const done = complete(tx);
    const legacy = tx.objectStore("conversationMessages");
    const conversations = tx.objectStore("conversations");
    const messages = tx.objectStore("messages");
    const riskEvents = tx.objectStore("riskEvents");
    const conversationBatch = new Map();
    for (const record of records) {
      const key = record.conversationId + "::" + record.id;
      const aggregate = conversationBatch.get(record.conversationId) || {
        conversationId: record.conversationId,
        participants: new Set(),
        messageIds: new Set(),
        categories: new Set(),
        firstObservedAt: record.seenAt,
        lastObservedAt: record.seenAt,
        highestRiskScore: 0,
        messageRiskScores: new Map(),
      };
      if (record.sender) aggregate.participants.add(record.sender);
      aggregate.messageIds.add(record.id);
      aggregate.messageRiskScores.set(record.id, record.riskScore);
      for (const category of record.categories)
        aggregate.categories.add(category);
      aggregate.firstObservedAt =
        aggregate.firstObservedAt < record.seenAt
          ? aggregate.firstObservedAt
          : record.seenAt;
      aggregate.lastObservedAt =
        aggregate.lastObservedAt > record.seenAt
          ? aggregate.lastObservedAt
          : record.seenAt;
      aggregate.highestRiskScore = Math.max(
        aggregate.highestRiskScore,
        record.riskScore,
      );
      conversationBatch.set(record.conversationId, aggregate);
      const existingMessage = messages.get(key);
      existingMessage.onsuccess = () => {
        const previous = existingMessage.result || {};
        const riskScore = Math.max(previous.riskScore || 0, record.riskScore);
        const categories = [
          ...new Set([...(previous.categories || []), ...record.categories]),
        ].slice(0, 20);
        const signals = [
          ...new Set([...(previous.signals || []), ...(record.signals || [])]),
        ].slice(0, 20);
        const previousMatches =
          previous.matches || previous.analysis?.matches || [];
        const matches =
          riskScore === record.riskScore
            ? record.matches || []
            : previousMatches;
        const riskLevel =
          riskScore === record.riskScore
            ? record.riskLevel
            : previous.riskLevel || record.riskLevel;
        messages.put(
          {
            messageId: record.id,
            conversationId: record.conversationId,
            senderType: record.senderType || "other",
            capturedAt: previous.capturedAt || record.seenAt,
            lastSeenAt: record.seenAt,
            riskScore,
            riskExpiresAt: record.riskScore > 0 && record.riskScore >= (previous.riskScore || 0) ? Date.now() + 30 * 60 * 1000 : previous.riskExpiresAt || 0,
            riskLevel,
            categories,
            signals,
            matches,
            analysis: { riskScore, riskLevel, categories, signals, matches },
            suspicious: Boolean(previous.suspicious || record.riskScore >= 21),
            suspiciousKey:
              previous.suspicious || record.riskScore >= 21 ? 1 : 0,
            disappearedAt: null,
          },
          key,
        );
      };
      if (record.riskScore >= 21) {
        riskEvents.put(
          {
            eventId: key + "::" + record.riskScore + "::" + record.seenAt,
            conversationId: record.conversationId,
            messageId: record.id,
            riskScore: record.riskScore,
            riskLevel: record.riskLevel,
            categories: record.categories,
            signals: record.signals || [],
            matches: record.matches || [],
            capturedAt: record.seenAt,
          },
          key + "::" + record.riskScore + "::" + record.seenAt,
        );
      }
      const existing = legacy.get(key);
      existing.onsuccess = () => {
        const previous = existing.result || {};
        legacy.put(
          {
            id: record.id,
            conversationId: record.conversationId,
            riskScore: Math.max(previous.riskScore || 0, record.riskScore),
            categories: [
              ...new Set([
                ...(previous.categories || []),
                ...record.categories,
              ]),
            ].slice(0, 20),
            suspicious: Boolean(previous.suspicious || record.riskScore >= 21),
            suspiciousKey:
              previous.suspicious || record.riskScore >= 21 ? 1 : 0,
            firstSeenAt: previous.firstSeenAt || record.seenAt,
            lastSeenAt: record.seenAt,
            disappearedAt: null,
          },
          key,
        );
      };
    }
    for (const aggregate of conversationBatch.values()) {
      const request = conversations.get(aggregate.conversationId);
      request.onsuccess = () => {
        const previous = request.result || {};
        const highestRiskScore = Math.max(
          previous.highestRiskScore || 0,
          aggregate.highestRiskScore,
        );
        const messageRiskScores = { ...(previous.messageRiskScores || {}) };
        for (const [messageId, score] of aggregate.messageRiskScores) {
          messageRiskScores[messageId] = Math.max(
            messageRiskScores[messageId] || 0,
            score,
          );
        }
        const conversationRiskScoreValue = conversationRiskScore(
          Object.values(messageRiskScores),
        );
        conversations.put(
          {
            conversationId: aggregate.conversationId,
            participants: [
              ...new Set([
                ...(previous.participants || []),
                ...aggregate.participants,
              ]),
            ].slice(0, 20),
            firstObservedAt:
              previous.firstObservedAt &&
              previous.firstObservedAt < aggregate.firstObservedAt
                ? previous.firstObservedAt
                : aggregate.firstObservedAt,
            lastObservedAt:
              previous.lastObservedAt &&
              previous.lastObservedAt > aggregate.lastObservedAt
                ? previous.lastObservedAt
                : aggregate.lastObservedAt,
            messageIds: [
              ...new Set([
                ...(previous.messageIds || []),
                ...aggregate.messageIds,
              ]),
            ].slice(-5000),
            messageCount: new Set([
              ...(previous.messageIds || []),
              ...aggregate.messageIds,
            ]).size,
            highestRiskScore,
            conversationRiskScore: conversationRiskScoreValue,
            riskLevel: riskLevel(conversationRiskScoreValue),
            messageRiskScores,
            categories: [
              ...new Set([
                ...(previous.categories || []),
                ...aggregate.categories,
              ]),
            ].slice(0, 20),
          },
          aggregate.conversationId,
        );
      };
    }
    await done;
  }
  async function list(offset = 0) {
    const db = await ready();
    const tx = db.transaction("evidence", "readonly");
    const done = complete(tx);
    const store = tx.objectStore("evidence");
    const count = store.count();
    const rows = [];
    const cursor = store.index("capturedAt").openCursor(null, "prev");
    let skipped = false;
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      if (!skipped && offset) {
        skipped = true;
        current.advance(offset);
        return;
      }
      rows.push({ key: current.primaryKey, ...current.value });
      if (rows.length < 25) current.continue();
    };
    await done;
    return { rows, total: count.result };
  }
  async function details(conversationId) {
    const db = await ready();
    const tx = db.transaction(
      ["conversations", "messages", "conversationSnapshots"],
      "readonly",
    );
    const done = complete(tx);
    const conversationRequest = tx
      .objectStore("conversations")
      .get(conversationId);
    const messagesRequest = tx
      .objectStore("messages")
      .index("conversationId")
      .getAll(conversationId);
    const snapshotRequest = tx
      .objectStore("conversationSnapshots")
      .get(conversationId);
    await done;
    const rows = (messagesRequest.result || [])
      .filter((row) => (row.riskScore || 0) >= 21)
      .sort((a, b) =>
        String(a.capturedAt || "").localeCompare(String(b.capturedAt || "")),
      )
      .map((row) => ({
        messageId: row.messageId,
        senderType: row.senderType,
        capturedAt: row.capturedAt,
        lastSeenAt: row.lastSeenAt,
        disappearedAt: row.disappearedAt || null,
        deletedAt: row.deletedAt || null,
        riskScore: row.riskScore || 0,
        riskLevel: row.riskLevel || riskLevel(row.riskScore || 0),
        categories: row.categories || [],
        signals: row.signals || row.analysis?.signals || [],
        matches: row.matches || row.analysis?.matches || [],
      }));
    const conversation = conversationRequest.result || {
      conversationId,
      participants: [],
      conversationRiskScore: conversationRiskScore(
        rows.map((row) => row.riskScore),
      ),
      riskLevel: riskLevel(
        conversationRiskScore(rows.map((row) => row.riskScore)),
      ),
      messageCount: rows.length,
      categories: [],
    };
    return {
      conversation,
      messages: rows,
      snapshot: snapshotRequest.result || null,
      missingSuspiciousCount: rows.filter((row) => row.disappearedAt).length,
    };
  }
  async function riskState(conversationIds) {
    const db = await ready();
    const tx = db.transaction("messages", "readonly");
    const done = complete(tx);
    const requests = conversationIds.map(id => [id, tx.objectStore("messages").index("conversationId").getAll(id)]);
    await done;
    const result = {};
    for (const [id, request] of requests) {
      const records = request.result.filter(record => record.riskExpiresAt > Date.now());
      if (records.length) result[id] = { score: conversationRiskScore(records.map(record => record.riskScore)), expiresAt: Math.min(...records.map(record => record.riskExpiresAt)) };
    }
    return result;
  }
  async function remove(key) {
    const db = await ready();
    const tx = db.transaction(
      [
        "evidence",
        "conversationMessages",
        "conversations",
        "messages",
        "riskEvents",
        "conversationSnapshots",
      ],
      "readwrite",
    );
    const done = complete(tx);
    if (key) {
      const evidence = tx.objectStore("evidence");
      const request = evidence.get(key);
      request.onsuccess = () => {
        const record = request.result;
        if (!record) return;
        const identity = record.conversationId + "::" + record.id;
        tx.objectStore("messages").delete(identity);
        tx.objectStore("conversationMessages").delete(identity);
        for (const name of ["evidence", "riskEvents"]) {
          const store = tx.objectStore(name);
          const cursor = store.index("conversationId").openCursor(record.conversationId);
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            if ((item.value.id || item.value.messageId) === record.id) item.delete();
            item.continue();
          };
        }
        const conversations = tx.objectStore("conversations");
        const conversation = conversations.get(record.conversationId);
        conversation.onsuccess = () => {
          const value = conversation.result;
          if (!value) return;
          delete value.messageRiskScores?.[record.id];
          value.messageIds = (value.messageIds || []).filter(id => id !== record.id);
          value.messageCount = value.messageIds.length;
          value.conversationRiskScore = conversationRiskScore(Object.values(value.messageRiskScores || {}));
          value.highestRiskScore = Math.max(0, ...Object.values(value.messageRiskScores || {}));
          value.riskLevel = riskLevel(value.conversationRiskScore);
          conversations.put(value, record.conversationId);
        };
        const snapshots = tx.objectStore("conversationSnapshots");
        const snapshot = snapshots.get(record.conversationId);
        snapshot.onsuccess = () => {
          if (!snapshot.result) return;
          for (const field of ["messageIds", "observedIds", "previousMessageIds"]) snapshot.result[field] = (snapshot.result[field] || []).filter(id => id !== record.id);
          snapshots.put(snapshot.result, record.conversationId);
        };
      };
    }
    else {
      tx.objectStore("evidence").clear();
      tx.objectStore("conversationMessages").clear();
      tx.objectStore("conversations").clear();
      tx.objectStore("messages").clear();
      tx.objectStore("riskEvents").clear();
      tx.objectStore("conversationSnapshots").clear();
    }
    await done;
  }
  async function missing(conversationId, visibleIds, observedIds, deletedIds = []) {
    const visible = new Set(visibleIds);
    const observed = new Set(observedIds);
    const deleted = new Set(deletedIds);
    const confirmed = new Set();
    const absent = new Set();
    let missingVisibleCount = 0;
    let maxRisk = 0;
    const db = await ready();
    const tx = db.transaction(
      [
        "messages",
        "conversationMessages",
        "conversations",
        "conversationSnapshots",
      ],
      "readwrite",
    );
    const done = complete(tx);
    const store = tx.objectStore("messages");
    const legacy = tx.objectStore("conversationMessages");
    const conversations = tx.objectStore("conversations");
    const snapshots = tx.objectStore("conversationSnapshots");
    const capturedAt = new Date().toISOString();
    const snapshot = snapshots.get(conversationId);
    const conversation = conversations.get(conversationId);
    let snapshotResult;
    let conversationResult;
    let loaded = 0;
    const compare = () => {
      if (++loaded < 2) return;
      const previousIds = new Set([
        ...(snapshotResult?.messageIds || []),
        ...(conversationResult?.messageIds || []),
      ]);
      const missingIds = [...previousIds].filter((id) => !visible.has(id));
      missingVisibleCount = missingIds.length;
      const canCompare = previousIds.size > 0;
      if (canCompare) {
        const cursor = store
          .index("suspiciousConversationKey")
          .openCursor(IDBKeyRange.only([conversationId, 1]));
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          const record = current.value;
          const id = record.messageId || record.id;
          if (visible.has(id) && (record.disappearedAt || record.deletedAt)) store.put({ ...record, disappearedAt: null, deletedAt: null }, current.primaryKey);
          if (id && previousIds.has(id) && (observed.has(id) || deleted.has(id)) && !visible.has(id)) {
            absent.add(id);
            maxRisk = Math.max(maxRisk, record.riskScore || 0);
            if (deleted.has(id)) confirmed.add(id);
            if (!record.disappearedAt || (deleted.has(id) && !record.deletedAt))
              store.put(
                { ...record, disappearedAt: record.disappearedAt || capturedAt, deletedAt: deleted.has(id) ? record.deletedAt || capturedAt : null },
                current.primaryKey,
              );
          }
          current.continue();
        };
        const fallback = legacy
          .index("suspiciousConversationKey")
          .openCursor(IDBKeyRange.only([conversationId, 1]));
        fallback.onsuccess = () => {
          const current = fallback.result;
          if (!current) return;
          const record = current.value;
          if (visible.has(record.id) && record.disappearedAt) legacy.put({ ...record, disappearedAt: null }, current.primaryKey);
          if (
            previousIds.has(record.id) &&
            (observed.has(record.id) || deleted.has(record.id)) &&
            !visible.has(record.id)
          ) {
            absent.add(record.id);
            maxRisk = Math.max(maxRisk, record.riskScore || 0);
            if (!record.disappearedAt)
              legacy.put(
                { ...record, disappearedAt: capturedAt },
                current.primaryKey,
              );
          }
          current.continue();
        };
      }
      snapshots.put(
        {
          conversationId,
          messageIds: [...visible].slice(0, 10000),
          observedIds: [...observed].slice(0, 10000),
          previousMessageIds: [...previousIds].slice(0, 10000),
          capturedAt,
        },
        conversationId,
      );
    };
    snapshot.onsuccess = () => {
      snapshotResult = snapshot.result;
      compare();
    };
    conversation.onsuccess = () => {
      conversationResult = conversation.result;
      compare();
    };
    await done;
    return {
      missingCount: absent.size,
      suspiciousMissingCount: absent.size,
      ignoredMissingCount: Math.max(0, missingVisibleCount - absent.size),
      suspiciousMissingIds: [...absent].slice(0, 100),
      maxRisk,
      deletedCount: confirmed.size,
    };
  }
  let lastPrunedAt = 0;
  async function prune() {
    if (Date.now() - lastPrunedAt < 60000) return;
    const db = await ready();
    const names = [...db.objectStoreNames].filter(name => name !== "schema");
    const tx = db.transaction(names, "readwrite");
    const done = complete(tx);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const name of names) {
      const store = tx.objectStore(name);
      const index = name === "conversations" ? "lastObservedAt" : store.indexNames.contains("capturedAt") ? "capturedAt" : null;
      const cursor = index ? store.index(index).openCursor(null, "prev") : store.openCursor();
      let count = 0;
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        const date = item.value.lastObservedAt || item.value.lastSeenAt || item.value.capturedAt || item.value.firstSeenAt;
        if (++count > (name === "conversations" || name === "conversationSnapshots" ? 500 : 10000) || (date && date < cutoff)) item.delete();
        item.continue();
      };
    }
    await done;
    lastPrunedAt = Date.now();
  }
  async function records(values) { return Promise.all(values.map(globalThis.fsdMetadata.record)); }
  async function protectedRisk(ids) {
    await prune();
    const protectedIds = await Promise.all(ids.map(globalThis.fsdMetadata.reference));
    const values = await riskState(protectedIds);
    return Object.fromEntries(ids.flatMap((id, index) => values[protectedIds[index]] ? [[id, values[protectedIds[index]]]] : []));
  }
  globalThis.fsdEvidenceVault = {
    initialize: async () => { await ready(); await prune(); },
    save: async values => { await save(await records(values)); await prune(); },
    observe: async values => { await observe(await records(values)); await prune(); },
    list: async offset => { await prune(); return list(offset); },
    details: async id => { await prune(); return details(await globalThis.fsdMetadata.reference(id)); },
    riskState: protectedRisk,
    risk: async ids => Object.fromEntries(Object.entries(await protectedRisk(ids)).map(([id, record]) => [id, record.score])),
    remove,
    missing: async (id, visible, observed, deleted = []) => missing(await globalThis.fsdMetadata.reference(id), await Promise.all(visible.map(globalThis.fsdMetadata.reference)), await Promise.all(observed.map(globalThis.fsdMetadata.reference)), await Promise.all(deleted.map(globalThis.fsdMetadata.reference))),
  };
})();
