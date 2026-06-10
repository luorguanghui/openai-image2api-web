import assert from "node:assert/strict";
import test from "node:test";
import { buildSelfRegistrationInput } from "./userService.js";

test("buildSelfRegistrationInput creates an enabled limited user", () => {
  const input = buildSelfRegistrationInput("Alice", "secret123");

  assert.deepEqual(input, {
    username: "Alice",
    password: "secret123",
    role: "user",
    enabled: true,
    canUseAdminApiKey: false,
  });
});
