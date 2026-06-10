import assert from "node:assert/strict";
import test from "node:test";
import { resolveEffectiveApiKey } from "./accessControl.js";

test("resolveEffectiveApiKey prefers an enabled user's own API key", () => {
  const key = resolveEffectiveApiKey({
    userApiKey: " user-key ",
    globalApiKey: "global-key",
    envApiKey: "env-key",
    userApiKeysEnabled: true,
    canUseAdminApiKey: true,
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
    canUseAdminApiKey: true,
  });

  assert.equal(key.value, "global-key");
  assert.equal(key.source, "admin");
});

test("resolveEffectiveApiKey does not use admin or env keys when the user is not allowed", () => {
  assert.throws(
    () => resolveEffectiveApiKey({
      userApiKey: "",
      globalApiKey: "global-key",
      envApiKey: "env-key",
      userApiKeysEnabled: true,
      canUseAdminApiKey: false,
    }),
    /API Key/
  );
});

test("resolveEffectiveApiKey still prefers a user's own key when admin key access is disabled", () => {
  const key = resolveEffectiveApiKey({
    userApiKey: "user-key",
    globalApiKey: "global-key",
    envApiKey: "env-key",
    userApiKeysEnabled: true,
    canUseAdminApiKey: false,
  });

  assert.equal(key.value, "user-key");
  assert.equal(key.source, "user");
});

test("resolveEffectiveApiKey reports a missing key when neither user nor admin has one", () => {
  assert.throws(
    () => resolveEffectiveApiKey({
      userApiKey: "",
      globalApiKey: "",
      envApiKey: "",
      userApiKeysEnabled: true,
      canUseAdminApiKey: true,
    }),
    /请先配置 API Key/
  );
});
