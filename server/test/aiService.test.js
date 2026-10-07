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

test("generate: זמן ההמתנה נלקח מ-GEMINI_TIMEOUT_MS ב-env", async () => {
  const hanging = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => { const err = new Error("aborted"); err.name = "AbortError"; reject(err); });
  });
  const started = Date.now();
  await assert.rejects(ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_TIMEOUT_MS: "30" }, fetchImpl: hanging }), (e) => e.code === "TIMEOUT");
  assert.ok(Date.now() - started < 2000);
});

// ---------- בדיקות גיבוי מודלים (Fallback) ----------
const quiet = { warn() {} }; // logger שקט כדי לא להציף את פלט הבדיקות

test("getModelChain: מודל ראשי + גיבויים מ-env, בלי כפילויות ובלי ערכים ריקים", () => {
  assert.deepStrictEqual(ai.getModelChain({ GEMINI_MODEL: "a" }), ["a", ...ai.DEFAULT_FALLBACK_MODELS.filter((m) => m !== "a")]);
  assert.deepStrictEqual(ai.getModelChain({ GEMINI_MODEL: "a", GEMINI_FALLBACK_MODELS: " b, ,a , c " }), ["a", "b", "c"]);
});

test("generate: 503 במודל הראשי -> עובר למודל גיבוי ומחזיר תשובה", async () => {
  const tried = [];
  const text = await ai.generate(
    { system: "s", prompt: "p" },
    {
      env: { ...ENV, GEMINI_MODEL: "main", GEMINI_FALLBACK_MODELS: "backup1,backup2" },
      logger: quiet,
      fetchImpl: async (url) => { tried.push(url.match(/models\/([^:]+):/)[1]); return tried.length === 1 ? statusResponse(503) : okResponse("מהגיבוי"); },
    }
  );
  assert.strictEqual(text, "מהגיבוי");
  assert.deepStrictEqual(tried, ["main", "backup1"]);
});

test("generate: כל המודלים נכשלו -> נזרקת השגיאה של המודל הראשי", async () => {
  const codes = [503, 429, 404];
  let n = 0;
  await assert.rejects(
    ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_MODEL: "m1", GEMINI_FALLBACK_MODELS: "m2,m3" }, logger: quiet, fetchImpl: async () => statusResponse(codes[n++]) }),
    (e) => e.code === "UPSTREAM" && n === 3
  );
});

test("generate: שגיאות שלא קשורות לעומס (מפתח/בקשה/רשת) לא עוברות לגיבוי", async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_FALLBACK_MODELS: "x,y" }, logger: quiet, fetchImpl: async () => { calls++; return statusResponse(status); } }),
      (e) => ["BAD_REQUEST", "AUTH"].includes(e.code)
    );
    assert.strictEqual(calls, 1, `סטטוס ${status} לא אמור לנסות מודל נוסף`);
  }
  let netCalls = 0;
  await assert.rejects(
    ai.generate({ system: "s", prompt: "p" }, { env: ENV, logger: quiet, fetchImpl: async () => { netCalls++; throw new Error("down"); } }),
    (e) => e.code === "NETWORK"
  );
  assert.strictEqual(netCalls, 1);
});

test("generate: חריגת זמן או תשובה ריקה במודל הראשי -> עוברים לגיבוי", async () => {
  // timeout: המודל הראשי "נתקע", הגיבוי עונה
  const mixed = (url, init) => {
    if (url.includes("/models/slow:")) {
      return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => { const err = new Error("a"); err.name = "AbortError"; reject(err); }));
    }
    return Promise.resolve(okResponse("מהיר"));
  };
  assert.strictEqual(
    await ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_MODEL: "slow", GEMINI_FALLBACK_MODELS: "fast" }, fetchImpl: mixed, timeoutMs: 20, logger: quiet }),
    "מהיר"
  );
  // תשובה ריקה
  let n = 0;
  const empty = async () => (n++ === 0 ? { ok: true, status: 200, json: async () => ({ candidates: [] }) } : okResponse("תקין"));
  assert.strictEqual(await ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_FALLBACK_MODELS: "b" }, fetchImpl: empty, logger: quiet }), "תקין");
});

test("generate: הלוג של המעבר לגיבוי לא מכיל את המפתח", async () => {
  const lines = [];
  await ai.generate({ system: "s", prompt: "p" }, { env: { ...ENV, GEMINI_MODEL: "m1", GEMINI_FALLBACK_MODELS: "m2" }, logger: { warn: (m) => lines.push(m) }, fetchImpl: async (u) => (u.includes("m1") ? statusResponse(503) : okResponse("ok")) });
  assert.strictEqual(lines.length, 1);
  assert.ok(lines[0].includes("m1") && lines[0].includes("m2") && !lines[0].includes(ENV.GEMINI_API_KEY));
});
