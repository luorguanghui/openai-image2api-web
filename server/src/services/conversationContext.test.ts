import assert from "node:assert/strict";
import test from "node:test";
import { createFollowUpReferenceUrls } from "./conversationContext.js";

test("createFollowUpReferenceUrls converts generated base64 images into data URLs", () => {
  const refs = createFollowUpReferenceUrls(
    [
      {
        id: "img-1",
        b64_json: "ZmFrZS1wbmc=",
        mimeType: "image/png",
        url: "/generated/img-1.png",
      },
    ],
    { supportsBase64ImageUrls: true, maxReferenceImages: 16 }
  );

  assert.deepEqual(refs, ["data:image/png;base64,ZmFrZS1wbmc="]);
});

test("createFollowUpReferenceUrls ignores generated images when the model cannot accept base64 references", () => {
  const refs = createFollowUpReferenceUrls(
    [
      {
        id: "img-1",
        b64_json: "ZmFrZS1wbmc=",
        mimeType: "image/png",
        url: "/generated/img-1.png",
      },
    ],
    { supportsBase64ImageUrls: false, maxReferenceImages: 16 }
  );

  assert.deepEqual(refs, []);
});

test("createFollowUpReferenceUrls respects the model reference image limit", () => {
  const refs = createFollowUpReferenceUrls(
    [
      { id: "img-1", b64_json: "MQ==", mimeType: "image/png", url: "/generated/1.png" },
      { id: "img-2", b64_json: "Mg==", mimeType: "image/png", url: "/generated/2.png" },
    ],
    { supportsBase64ImageUrls: true, maxReferenceImages: 1 }
  );

  assert.deepEqual(refs, ["data:image/png;base64,MQ=="]);
});
