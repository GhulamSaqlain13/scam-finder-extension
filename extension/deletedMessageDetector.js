(() => {
  function create({ history = globalThis.fsdMessageHistory, onPreviouslyDetected } = {}) {
    const notified = new Set();

    async function inspect(message) {
      if (!message?.id || !history?.getMessage) return null;
      const record = await history.getMessage(message.id, message.conversationId ?? null);
      if (!record || !Number.isFinite(record.score) || record.score < 30) return null;
      const key = `${record.conversationId || ""}\u001f${record.id}`;
      if (notified.has(key)) return null;
      notified.add(key);
      const result = {
        ...record,
        level: record.score >= 60 ? "red" : "yellow",
        categories: [...(record.categories || [])],
      };
      onPreviouslyDetected?.(result, message);
      return result;
    }

    function reset() {
      notified.clear();
    }

    return { inspect, reset };
  }

  globalThis.fsdDeletedMessageDetector = { create };
})();