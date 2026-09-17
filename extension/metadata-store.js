/* global chrome */
(() => {
  let keyPromise;
  function key() {
    if (!keyPromise) keyPromise = (async () => {
      const saved = await chrome.storage.local.get("fsd_identity_secret");
      let secret = saved.fsd_identity_secret;
      if (!Array.isArray(secret) || secret.length !== 32) {
        secret = [...crypto.getRandomValues(new Uint8Array(32))];
        await chrome.storage.local.set({ fsd_identity_secret: secret });
      }
      return crypto.subtle.importKey("raw", new Uint8Array(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    })().catch(error => { keyPromise = undefined; throw error; });
    return keyPromise;
  }
  async function reference(value) {
    if (value === null || value === undefined) return null;
    if (/^ref_[a-f0-9]{64}$/.test(value)) return value;
    const digest = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(String(value)));
    return "ref_" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  const fields = ["riskScore", "riskLevel", "categories", "signals", "matches", "senderType", "capturedAt", "seenAt", "lastSeenAt", "firstSeenAt", "firstObservedAt", "lastObservedAt", "highestRiskScore", "conversationRiskScore", "messageCount", "suspicious", "suspiciousKey", "disappearedAt", "deletedAt", "riskExpiresAt"];
  async function record(input) {
    const result = {};
    for (const field of fields) if (input[field] !== undefined) result[field] = input[field];
    for (const field of ["conversationId", "id", "messageId", "eventId"]) if (input[field] !== undefined) result[field] = await reference(input[field]);
    for (const field of ["messageIds", "observedIds", "previousMessageIds"]) if (input[field]) result[field] = await Promise.all(input[field].map(reference));
    if (input.messageRiskScores) result.messageRiskScores = Object.fromEntries(await Promise.all(Object.entries(input.messageRiskScores).map(async ([id, score]) => [await reference(id), score])));
    if (input.analysis) result.analysis = { riskScore: input.analysis.riskScore, riskLevel: input.analysis.riskLevel, categories: input.analysis.categories, signals: input.analysis.signals, matches: input.analysis.matches };
    return result;
  }
  function complete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error || Error("Metadata migration failed"));
    });
  }
  async function migrate(db) {
    const status = db.transaction("schema", "readonly");
    const statusDone = complete(status);
    const marker = status.objectStore("schema").get("metadata-only");
    await statusDone;
    if (marker.result) return;
    const names = [...db.objectStoreNames].filter(name => name !== "schema");
    const tx = db.transaction([...names, "schema"], "readonly");
    const done = complete(tx);
    const requests = names.map(name => ({ name, values: tx.objectStore(name).getAll(), keys: tx.objectStore(name).getAllKeys() }));
    await done;
    const converted = await Promise.all(requests.map(async ({name, values, keys}) => ({ name, rows: await Promise.all(values.result.map(async (value, index) => {
      const safe = await record(value);
      // Remove raw names/content from both values AND IndexedDB primary keys.
      const key = ["conversations", "conversationSnapshots"].includes(name) ? safe.conversationId :
        ["messages", "conversationMessages"].includes(name) ? safe.conversationId + "::" + (safe.messageId || safe.id) :
        name === "riskEvents" ? safe.eventId : keys.result[index];
      if (name === "messages" && !safe.riskExpiresAt) safe.riskExpiresAt = Date.parse(safe.lastSeenAt || safe.capturedAt) + 30 * 60 * 1000;
      return [key, safe];
    })) })));
    const update = db.transaction([...names, "schema"], "readwrite");
    const finished = complete(update);
    for (const {name, rows} of converted) {
      const store = update.objectStore(name);
      store.clear();
      for (const [key, value] of rows) store.put(value, key);
    }
    update.objectStore("schema").put(true, "metadata-only");
    await finished;
  }
  globalThis.fsdMetadata = { reference, record, migrate };
})();
