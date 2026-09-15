(() => {
  let connection;
  function open() {
    if (!connection)
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open("fsd-evidence", 6);
        request.onupgradeneeded = () => {
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
    const db = await open();
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
    const db = await open();
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
            sender: record.sender,
            senderType: record.senderType || "other",
            text: record.text,
            links: record.links || [],
            capturedAt: previous.capturedAt || record.seenAt,
            lastSeenAt: record.seenAt,
            riskScore,
            riskLevel,
            categories,
            signals,
            matches,
            analysis: { riskScore, riskLevel, categories, signals, matches },
            suspicious: Boolean(previous.suspicious || record.riskScore >= 61),
            suspiciousKey:
              previous.suspicious || record.riskScore >= 61 ? 1 : 0,
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
            suspicious: Boolean(previous.suspicious || record.riskScore >= 61),
            suspiciousKey:
              previous.suspicious || record.riskScore >= 61 ? 1 : 0,
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
    const db = await open();
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
    const db = await open();
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
        sender: row.sender,
        senderType: row.senderType,
        text: row.text,
        links: row.links || [],
        capturedAt: row.capturedAt,
        lastSeenAt: row.lastSeenAt,
        disappearedAt: row.disappearedAt || null,
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
  async function risk(conversationIds) {
    const db = await open();
    const tx = db.transaction("conversations", "readonly");
    const done = complete(tx);
    const store = tx.objectStore("conversations");
    const scores = {};
    for (const conversationId of conversationIds) {
      const request = store.get(conversationId);
      request.onsuccess = () => {
        const conversation = request.result;
        if (conversation)
          scores[conversationId] =
            conversation.conversationRiskScore ||
            conversation.highestRiskScore ||
            0;
      };
    }
    await done;
    return scores;
  }
  async function remove(key) {
    const db = await open();
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
    if (key) tx.objectStore("evidence").delete(key);
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
  async function missing(conversationId, visibleIds, observedIds) {
    const visible = new Set(visibleIds);
    const observed = new Set(observedIds);
    const absent = new Set();
    let missingVisibleCount = 0;
    let maxRisk = 0;
    const db = await open();
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
          if (id && previousIds.has(id) && !visible.has(id)) {
            absent.add(id);
            maxRisk = Math.max(maxRisk, record.riskScore || 0);
            if (!record.disappearedAt)
              store.put(
                { ...record, disappearedAt: capturedAt },
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
          if (
            previousIds.has(record.id) &&
            (!record.id.startsWith("local_") || observed.has(record.id)) &&
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
    };
  }
  globalThis.fsdEvidenceVault = {
    save,
    observe,
    list,
    details,
    risk,
    remove,
    missing,
  };
})();
