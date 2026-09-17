/* global chrome */
(() => {
  const storageKey = "fsd_message_history";
  const maxRecords = 100;
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  let writeQueue = Promise.resolve();
  let cachedRecords;
  let pendingRead;
  let cacheVersion = 0;
  const changes = globalThis.chrome?.storage?.onChanged;
  const cacheEnabled = Boolean(changes?.addListener);
  changes?.addListener((updates, area) => {
    if (area !== "local" || !Object.hasOwn(updates, storageKey)) return;
    cacheVersion++;
    cachedRecords = undefined;
    pendingRead = undefined;
  });

  function storage() {
    return chrome?.storage?.local;
  }

  function validId(value, fallback = null) {
    return typeof value === "string" && value.length > 0 && value.length <= 512
      ? value
      : fallback;
  }

  function sanitize(message) {
    const detectedAt = Number.isFinite(message?.detectedAt)
      ? message.detectedAt
      : Date.now();
    const score = Number.isFinite(message?.score)
      ? Math.max(0, Math.min(100, Math.round(message.score)))
      : null;
    const categories = Array.isArray(message?.categories)
      ? [...new Set(message.categories.filter((value) => typeof value === "string").slice(0, 20))]
      : [];
    const record = {
      id: validId(message?.id),
      conversationId: validId(message?.conversationId),
      riskLevel: typeof message?.riskLevel === "string" ? message.riskLevel.toLowerCase() : null,
      score,
      categories,
      detectedAt,
    };
    return record.id ? record : null;
  }

  function isRecent(record, now = Date.now()) {
    return Number.isFinite(record?.detectedAt) && now - record.detectedAt <= maxAgeMs;
  }

  async function read() {
    if (!cacheEnabled) {
      const result = await storage().get(storageKey);
      return Array.isArray(result?.[storageKey]) ? result[storageKey] : [];
    }
    if (cachedRecords) return cachedRecords;
    if (pendingRead) return pendingRead;
    const version = cacheVersion;
    const request = storage().get(storageKey).then((result) => {
      const records = Array.isArray(result?.[storageKey]) ? result[storageKey] : [];
      if (version === cacheVersion) cachedRecords = records;
      return records;
    });
    pendingRead = request;
    try {
      return await request;
    } finally {
      if (pendingRead === request) pendingRead = undefined;
    }
  }

  async function write(records) {
    await storage().set({ [storageKey]: records });
    // Invalidate even when the storage event arrives after this promise.
    cacheVersion++;
    cachedRecords = undefined;
    pendingRead = undefined;
  }

  function enqueue(task) {
    const operation = writeQueue.then(task, task);
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function removeOldMessages() {
    if (!storage()) return false;
    return enqueue(async () => {
      const now = Date.now();
      const current = await read();
      const retained = current.filter((record) => isRecent(record, now)).slice(0, maxRecords);
      if (retained.length !== current.length) await write(retained);
      return retained.length;
    }).catch(() => false);
  }

  async function saveMessage(message) {
    const record = sanitize(message);
    if (!record || !storage()) return null;
    return enqueue(async () => {
      const now = Date.now();
      const current = (await read()).filter((item) => isRecent(item, now));
      const duplicate = current.find(
        (item) => item.id === record.id && item.conversationId === record.conversationId,
      );
      if (duplicate) return duplicate;
      const retained = [record, ...current].slice(0, maxRecords);
      await write(retained);
      return record;
    }).catch(() => null);
  }

  async function getMessage(id, conversationId = null) {
    if (!storage() || !validId(id)) return null;
    try {
      const records = await read();
      return records.find((record) => record.id === id && (conversationId === null || record.conversationId === conversationId) && isRecent(record)) || null;
    } catch {
      return null;
    }
  }

  async function getConversationMessages(conversationId) {
    if (!storage() || !validId(conversationId)) return [];
    try {
      return (await read())
        .filter((record) => record.conversationId === conversationId && isRecent(record))
        .sort((a, b) => b.detectedAt - a.detectedAt);
    } catch {
      return [];
    }
  }

  async function hasMessage(id, conversationId = null) {
    return Boolean(await getMessage(id, conversationId));
  }

  globalThis.fsdMessageHistory = {
    saveMessage,
    getMessage,
    getConversationMessages,
    hasMessage,
    removeOldMessages,
    limits: { maxRecords, maxAgeMs },
  };
})();
