import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectiveApiKey } from "./accessControl.js";

test("resolveEffectiveApiKey prefers an enabled user's own API key", () => {
  const key = resolveEffectiveApiKey({
    userApiKey: " user-key ",
    globalApiKey: "global-key",
    envApiKey: "env-key",
    userApiKeysEnabled: true,
  });

  assert.equal(key.value, "user-key");
  assert.equal(key.source, "user");
});

test("resolveEffectiveApiKey falls back to the admin key when user keys are disabled", () => {
  const key = resolveEffectiveApiKey({
    userApiKey: "user-key",
    globalApiKey: " global-key ",
    envApiKey: "env-key",
    userApiKeysEnabled: false,
  });

  assert.equal(key.value, "global-key");
  assert.equal(key.source, "admin");
});

test("resolveEffectiveApiKey reports a missing key when neither user nor admin has one", () => {
  assert.throws(
    () => resolveEffectiveApiKey({
      userApiKey: "",
      globalApiKey: "",
      envApiKey: "",
      userApiKeysEnabled: true,
    }),
    /请先配置 API Key/
  );
});
