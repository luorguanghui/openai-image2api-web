import assert from "node:assert/strict";
import test from "node:test";
import {
  filterConversationsForViewer,
  groupHistoryRecordsIntoConversations,
} from "./conversationService.js";
import type { HistoryRecord } from "../types/image.js";

const baseRecord: HistoryRecord = {
  id: "img-1",
  userId: "user-a",
  username: "alice",
  conversationId: "conv-1",
  prompt: "first prompt",
  model: "gpt-image-2",
  size: "1:1",
  resolution: "1k",
  quality: "auto",
  output_format: "png",
  background: "auto",
  moderation: "auto",
  n: 1,
  image_urls: [],
  images: [
    { id: "img-1", b64_json: "MQ==", mimeType: "image/png", url: "/generated/1.png" },
  ],
  imageUrl: "/generated/1.png",
  createdAt: "2026-06-10T01:00:00.000Z",
};

test("groupHistoryRecordsIntoConversations stores multiple turns in one conversation record", () => {
  const conversations = groupHistoryRecordsIntoConversations([
    {
      ...baseRecord,
      id: "img-2",
      prompt: "second prompt",
      images: [{ id: "img-2", b64_json: "Mg==", mimeType: "image/png", url: "/generated/2.png" }],
      imageUrl: "/generated/2.png",
      createdAt: "2026-06-10T01:02:00.000Z",
    },
    baseRecord,
  ]);

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].id, "conv-1");
  assert.equal(conversations[0].turns.length, 2);
  assert.deepEqual(conversations[0].turns.map(turn => turn.prompt), ["first prompt", "second prompt"]);
  assert.equal(conversations[0].latestImageUrl, "/generated/2.png");
});

test("groupHistoryRecordsIntoConversations separates users even when conversation ids match", () => {
  const conversations = groupHistoryRecordsIntoConversations([
    baseRecord,
    { ...baseRecord, id: "img-3", userId: "user-b", username: "bob", prompt: "other user" },
  ]);

  assert.equal(conversations.length, 2);
  assert.deepEqual(conversations.map(conversation => conversation.userId).sort(), ["user-a", "user-b"]);
});

test("filterConversationsForViewer only returns own conversations for normal users", () => {
  const conversations = groupHistoryRecordsIntoConversations([
    baseRecord,
    { ...baseRecord, id: "img-3", userId: "user-b", username: "bob", conversationId: "conv-2" },
  ]);

  const visible = filterConversationsForViewer(conversations, { id: "user-a", role: "user" });

  assert.deepEqual(visible.map(conversation => conversation.id), ["conv-1"]);
});

test("filterConversationsForViewer allows admins to view every conversation", () => {
  const conversations = groupHistoryRecordsIntoConversations([
    baseRecord,
    { ...baseRecord, id: "img-3", userId: "user-b", username: "bob", conversationId: "conv-2" },
  ]);

  const visible = filterConversationsForViewer(conversations, { id: "admin", role: "admin" });

  assert.deepEqual(visible.map(conversation => conversation.id).sort(), ["conv-1", "conv-2"]);
});
