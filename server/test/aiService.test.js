// server/test/aiService.test.js
// בדיקות לשירות ה-AI (services/aiService.js) עם fetch מדומה - בלי מפתח אמיתי ובלי אינטרנט
const test = require("node:test");
const assert = require("node:assert");
const ai = require("../services/aiService");

const ENV = { GEMINI_API_KEY: "test-key-1234567890" };
const okResponse = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const statusResponse = (status) => ({ ok: false, status, json: async () => ({}) });

test("isConfigured: false בלי מפתח או עם מפתח קצר, true עם מפתח", () => {
  assert.strictEqual(ai.isConfigured({}), false);
  assert.strictEqual(ai.isConfigured({ GEMINI_API_KEY: "abc" }), false);
  assert.strictEqual(ai.isConfigured(ENV), true);
});

test("generate: בלי מפתח זורק NOT_CONFIGURED (503) ולא קורא ל-fetch", async () => {
  let called = false;
  await assert.rejects(
    ai.generate({ system: "s", prompt: "p" }, { env: {}, fetchImpl: async () => { called = true; } }),
    (e) => e.code === "NOT_CONFIGURED" && e.httpStatus === 503
  );
  assert.strictEqual(called, false);
});

test("generate: שולח את המפתח ב-header (לא ב-URL), את המודל מה-env, ומחזיר את הטקסט", async () => {
  let seen;
  const text = await ai.generate(
    { system: "הוראה", prompt: "שאלה" },
    { env: { ...ENV, GEMINI_MODEL: "my-model" }, fetchImpl: async (url, init) => { seen = { url, init }; return okResponse("  תשובה  "); } }
  );
  assert.strictEqual(text, "תשובה");
  assert.ok(seen.url.includes("/models/my-model:generateContent"));
  assert.ok(!seen.url.includes("test-key"), "המפתח לא אמור להופיע ב-URL");
  assert.strictEqual(seen.init.headers["x-goog-api-key"], ENV.GEMINI_API_KEY);
  const body = JSON.parse(seen.init.body);
  assert.strictEqual(body.systemInstruction.parts[0].text, "הוראה");
  assert.strictEqual(body.contents[0].parts[0].text, "שאלה");
});

test("generate: ממפה קודי שגיאה של Google להודעות בעברית בלי לחשוף את המפתח", async () => {
  const cases = [[429, "QUOTA", 429], [400, "BAD_REQUEST", 400], [403, "AUTH", 502], [404, "MODEL", 502], [500, "UPSTREAM", 502]];
  for (const [status, code, http] of cases) {
    await assert.rejects(
      ai.generate({ system: "s", prompt: "p" }, { env: ENV, fetchImpl: async () => statusResponse(status) }),
      (e) => e.code === code && e.httpStatus === http && !e.message.includes(ENV.GEMINI_API_KEY)
    );
  }
});

test("generate: שגיאת רשת -> NETWORK, וחריגת זמן -> TIMEOUT", async () => {
  await assert.rejects(
    ai.generate({ system: "s", prompt: "p" }, { env: ENV, fetchImpl: async () => { throw new Error("ECONNRESET https://x?key=SECRET"); } }),
    (e) => e.code === "NETWORK" && !e.message.includes("SECRET")
  );
  // fetch שמחכה לביטול (signal) - עם timeout קצר מאוד
  const hanging = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => { const err = new Error("aborted"); err.name = "AbortError"; reject(err); });
  });
  await assert.rejects(ai.generate({ system: "s", prompt: "p" }, { env: ENV, fetchImpl: hanging, timeoutMs: 20 }), (e) => e.code === "TIMEOUT" && e.httpStatus === 504);
});

test("extractText: חסימת בטיחות, תשובה ריקה ושרשור כמה parts", () => {
  assert.throws(() => ai.extractText({ promptFeedback: { blockReason: "SAFETY" } }), (e) => e.code === "BLOCKED");
  assert.throws(() => ai.extractText({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), (e) => e.code === "BLOCKED");
  assert.throws(() => ai.extractText({ candidates: [] }), (e) => e.code === "EMPTY");
  assert.throws(() => ai.extractText(null), (e) => e.code === "EMPTY");
  assert.strictEqual(ai.extractText({ candidates: [{ content: { parts: [{ text: "א" }, { text: "ב" }] } }] }), "אב");
});
