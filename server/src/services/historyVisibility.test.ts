import assert from "node:assert/strict";
import test from "node:test";
import { filterHistoryForViewer } from "./historyService.js";
import type { HistoryRecord } from "../types/image.js";

const baseRecord: HistoryRecord = {
  id: "turn-1",
  userId: "user-a",
  conversationId: "conversation-1",
  prompt: "make it brighter",
  model: "gpt-image-2",
  size: "1:1",
  resolution: "1k",
  quality: "auto",
  output_format: "png",
  background: "auto",
  moderation: "auto",
  n: 1,
  images: [],
  imageUrl: "",
  createdAt: "2026-06-10T00:00:00.000Z",
};

test("filterHistoryForViewer only returns the current user's records", () => {
  const visible = filterHistoryForViewer(
    [
      baseRecord,
      { ...baseRecord, id: "turn-2", userId: "user-b", conversationId: "conversation-2" },
    ],
    { id: "user-a", role: "user" }
  );

  assert.deepEqual(visible.map(record => record.id), ["turn-1"]);
});

test("filterHistoryForViewer allows admins to view every user's records", () => {
  const visible = filterHistoryForViewer(
    [
      baseRecord,
      { ...baseRecord, id: "turn-2", userId: "user-b", conversationId: "conversation-2" },
    ],
    { id: "admin", role: "admin" }
  );

  assert.deepEqual(visible.map(record => record.id), ["turn-1", "turn-2"]);
});
