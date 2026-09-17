const assert = require("node:assert/strict");

(async () => {
  const state = {};
  global.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: state[key] };
        },
        async set(values) {
          Object.assign(state, values);
        },
      },
    },
  };
  require("../extension/messageHistory.js");
  const history = globalThis.fsdMessageHistory;

  const saved = await history.saveMessage({
    id: "message-1",
    conversationId: "conversation-1",
    text: "Send me your password",
    normalizedText: "send me your password",
    sender: "private-user",
    riskLevel: "red",
    score: 82,
    categories: ["account_credentials"],
    detectedAt: Date.now(),
  });
  assert.equal(saved.id, "message-1");
  assert.equal(Object.hasOwn(saved, "text"), false);
  assert.equal(Object.hasOwn(saved, "normalizedText"), false);
  assert.equal(Object.hasOwn(saved, "sender"), false);
  assert.equal(await history.hasMessage("message-1", "conversation-1"), true);
  assert.equal((await history.getConversationMessages("conversation-1")).length, 1);

  await history.saveMessage({ id: "message-1", conversationId: "conversation-1", score: 100 });
  assert.equal(state.fsd_message_history.length, 1, "Duplicate IDs are not stored twice");

  const old = Date.now() - history.limits.maxAgeMs - 1;
  state.fsd_message_history.push({ id: "old", conversationId: "conversation-1", detectedAt: old });
  assert.equal(await history.removeOldMessages(), 1);
  assert.equal(await history.getMessage("old"), null);

  for (let index = 0; index < history.limits.maxRecords + 10; index++)
    await history.saveMessage({ id: `message-${index + 2}`, conversationId: "conversation-2", score: 0 });
  assert.equal(state.fsd_message_history.length, history.limits.maxRecords);

  chrome.storage.local.get = async () => { throw new Error("storage unavailable"); };
  assert.equal(await history.getMessage("message-1"), null);
  assert.deepEqual(await history.getConversationMessages("conversation-1"), []);
  assert.equal(await history.hasMessage("message-1"), false);
  console.log("PASS: message history bounds, privacy filtering, deduplication, expiry, and storage error handling.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});