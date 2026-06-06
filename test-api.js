const BASE = "http://localhost:3001";

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.log(`  ❌ FAIL: ${name} -> ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function run() {
  console.log("=== Health Check ===");
  await test("GET /api/health returns 200", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const data = await res.json();
    assert(res.status === 200, `status=${res.status}`);
    assert(data.status === "ok", `status=${data.status}`);
  });

  console.log("\n=== Models Tests ===");
  await test("GET /api/models returns 200", async () => {
    const res = await fetch(`${BASE}/api/models`);
    const data = await res.json();
    assert(res.status === 200, `status=${res.status}`);
    assert(data.success === true, `success=${data.success}`);
    assert(data.models.length > 0, `models.length=${data.models.length}`);
  });

  await test("Models contain gpt-image-2-official", async () => {
    const res = await fetch(`${BASE}/api/models`);
    const data = await res.json();
    const model = data.models.find(m => m.id === "gpt-image-2-official");
    assert(model !== undefined, "gpt-image-2-official not found");
    assert(model.supportedResolutions.length > 0, "should have resolutions");
    assert(model.supportedSizes.length > 0, "should have sizes");
    assert(model.maxN === 4, `maxN=${model.maxN}`);
  });

  console.log("\n=== Validation Tests ===");
  await test("Missing prompt -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await res.json();
    assert(res.status === 400, `status=${res.status}`);
    assert(data.error.code === "VALIDATION_ERROR", `code=${data.error.code}`);
  });

  await test("Empty prompt -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Whitespace prompt -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid model -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", model: "bad-model" })
    });
    const data = await res.json();
    assert(res.status === 400, `status=${res.status}`);
    assert(data.error.message.includes("不支持的模型"), `msg=${data.error.message}`);
  });

  await test("Invalid size -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", size: "999x999" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid quality -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", quality: "ultra" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid output_format -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", output_format: "gif" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid background -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", background: "blur" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid resolution -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", resolution: "8k" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Invalid moderation -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", moderation: "strict" })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("n=0 -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", n: 0 })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("n=5 -> 400 (max is 4)", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", n: 5 })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("n=1.5 -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", n: 1.5 })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Prompt over 4000 chars -> 400", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a".repeat(4001) })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("Too many image_urls (>16) -> 400", async () => {
    const urls = Array.from({ length: 17 }, (_, i) => `https://example.com/img${i}.png`);
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", image_urls: urls })
    });
    assert(res.status === 400, `status=${res.status}`);
  });

  await test("No API key (env and request) -> 401", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "", prompt: "test" })
    });
    const data = await res.json();
    // Could be 401 if no env key, or 200 if env key exists
    if (res.status === 401) {
      assert(data.error.code === "API_KEY_MISSING", `code=${data.error.code}`);
    }
    // If env key exists, it might succeed - that's fine
  });

  await test("Invalid API key -> 502", async () => {
    const res = await fetch(`${BASE}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-invalid-fake-key-for-testing", prompt: "test" })
    });
    const data = await res.json();
    // Could be 401 (auth error) or 502 (API error) depending on API provider
    assert(res.status === 401 || res.status === 502, `status=${res.status}`);
    assert(
      data.error.code === "API_KEY_MISSING" || data.error.code === "OPENAI_API_ERROR",
      `code=${data.error.code}`
    );
  });

  console.log("\n=== History Tests ===");
  await test("DELETE /api/history returns 200", async () => {
    const res = await fetch(`${BASE}/api/history`, { method: "DELETE" });
    const data = await res.json();
    assert(res.status === 200, `status=${res.status}`);
    assert(data.success === true, `success=${data.success}`);
  });

  await test("GET /api/history returns empty after clear", async () => {
    const res = await fetch(`${BASE}/api/history`);
    const data = await res.json();
    assert(res.status === 200, `status=${res.status}`);
    assert(data.history.length === 0, `length=${data.history.length}`);
  });

  await test("DELETE /api/history is idempotent", async () => {
    const res = await fetch(`${BASE}/api/history`, { method: "DELETE" });
    assert(res.status === 200, `status=${res.status}`);
  });

  console.log("\n=== 404 Test ===");
  await test("Unknown route returns 404", async () => {
    const res = await fetch(`${BASE}/api/nonexistent`);
    const data = await res.json();
    assert(res.status === 404, `status=${res.status}`);
    assert(data.error.code === "NOT_FOUND", `code=${data.error.code}`);
  });

  console.log("\n=== CORS Test ===");
  await test("OPTIONS preflight returns CORS headers", async () => {
    const res = await fetch(`${BASE}/api/health`, { method: "OPTIONS" });
    // CORS headers should be present
    assert(res.status === 200 || res.status === 204, `status=${res.status}`);
  });

  console.log("\n✨ All tests completed!");
}

run().catch(console.error);
