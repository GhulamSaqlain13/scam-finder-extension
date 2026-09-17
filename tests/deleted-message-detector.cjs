const assert = require("node:assert/strict");
require("../extension/deletedMessageDetector.js");

(async () => {
  const records = new Map([
    ["red", { id: "red", conversationId: "chat", score: 82, categories: ["payment_request"] }],
    ["yellow", { id: "yellow", conversationId: "chat", score: 45, categories: ["external_contact"] }],
    ["safe", { id: "safe", conversationId: "chat", score: 0, categories: [] }],
  ]);
  const notifications = [];
  const detector = globalThis.fsdDeletedMessageDetector.create({
    history: { getMessage: async (id) => records.get(id) || null },
    onPreviouslyDetected: (result) => notifications.push(result),
  });
  assert.equal(await detector.inspect({ id: "safe", conversationId: "chat" }), null);
  assert.equal((await detector.inspect({ id: "red", conversationId: "chat" })).level, "red");
  assert.equal((await detector.inspect({ id: "yellow", conversationId: "chat" })).level, "yellow");
  assert.equal(await detector.inspect({ id: "red", conversationId: "chat" }), null);
  assert.equal(notifications.length, 2, "The same disappearance is notified once");
  detector.reset();
  assert.equal((await detector.inspect({ id: "red", conversationId: "chat" })).score, 82);
  console.log("PASS: suspicious-only disappearance detection and notification deduplication.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});