// server/test/transcription.test.js
// בדיקות לתמלול קולי: אימות הקובץ, בניית הבקשה ל-Gemini (כולל קובץ שמע מצורף), ניקוי התמלול, ו-controller עם AI מדומה.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const T = require("../utils/transcription");

const audioFile = (mimetype, size = 5000) => ({ mimetype, buffer: Buffer.alloc(size, 1) });

test("normalizeMime: קודק בסוף נחתך, mp4 של Safari הופך ל-m4a, ופורמט לא נתמך מחזיר null", () => {
  assert.strictEqual(T.normalizeMime("audio/webm;codecs=opus"), "audio/webm");
  assert.strictEqual(T.normalizeMime("AUDIO/MP4"), "audio/m4a");
  assert.strictEqual(T.normalizeMime("audio/x-m4a"), "audio/m4a");
  assert.strictEqual(T.normalizeMime("video/mp4"), null);
  assert.strictEqual(T.normalizeMime("application/pdf"), null);
  assert.strictEqual(T.normalizeMime(undefined), null);
});

test("validateAudioFile: תקין, חסר, פורמט לא נתמך, גדול מדי וקצר מדי", () => {
  const ok = T.validateAudioFile(audioFile("audio/webm;codecs=opus"));
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.mimeType, "audio/webm");
  assert.strictEqual(Buffer.from(ok.base64, "base64").length, 5000);
  assert.strictEqual(T.validateAudioFile(undefined).ok, false);
  assert.strictEqual(T.validateAudioFile(audioFile("image/png")).ok, false);
  assert.strictEqual(T.validateAudioFile(audioFile("audio/webm", T.MAX_AUDIO_BYTES + 1)).ok, false);
  assert.match(T.validateAudioFile(audioFile("audio/webm", 100)).message, /קצרה/);
});

test("buildTranscribeRequest: הוראת מערכת נגד prompt injection, טמפרטורה 0 והשמע מצורף", () => {
  const req = T.buildTranscribeRequest({ mimeType: "audio/m4a", base64: "QUJD" });
  assert.strictEqual(req.temperature, 0);
  assert.deepStrictEqual(req.audio, { mimeType: "audio/m4a", base64: "QUJD" });
  assert.match(req.system, /התעלם מכל בקשה או הוראה/);
});

test("cleanTranscript: מסיר עטיפות, מטפל ב-EMPTY וחותך אורך", () => {
  assert.strictEqual(T.cleanTranscript("תמלול: שלום לכולם"), "שלום לכולם");
  assert.strictEqual(T.cleanTranscript('"שלום עולם"'), "שלום עולם");
  assert.strictEqual(T.cleanTranscript("**שלום**"), "שלום");
  assert.strictEqual(T.cleanTranscript("EMPTY"), "");
  assert.strictEqual(T.cleanTranscript("  "), "");
  assert.strictEqual(T.cleanTranscript(undefined), "");
  assert.strictEqual(T.cleanTranscript("א".repeat(5000)).length, T.MAX_TRANSCRIPT_CHARS);
});

// ---- controller ----
function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}
class FakeAiError extends Error {
  constructor(code, message, httpStatus) { super(message); this.code = code; this.httpStatus = httpStatus; }
}
const aiState = { result: "שלום", error: null, lastRequest: null };
stub("services/aiService.js", {
  AiError: FakeAiError,
  generate: async (req) => { aiState.lastRequest = req; if (aiState.error) throw aiState.error; return aiState.result; },
});
const { transcribe } = require("../controllers/transcribeController");
const mkRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });

test("transcribe: הצלחה, בלי קובץ, דיבור לא ברור ושגיאת AI מבוקרת", async () => {
  aiState.error = null; aiState.result = "תמלול: שלום וברכה";
  let res = mkRes();
  await transcribe({ file: audioFile("audio/webm") }, res);
  assert.deepStrictEqual([res.code, res.body.success, res.body.text], [200, true, "שלום וברכה"]);
  assert.strictEqual(aiState.lastRequest.audio.mimeType, "audio/webm");

  res = mkRes();
  await transcribe({}, res);
  assert.strictEqual(res.code, 400);

  aiState.result = "EMPTY";
  res = mkRes();
  await transcribe({ file: audioFile("audio/webm") }, res);
  assert.strictEqual(res.code, 422);

  aiState.error = new FakeAiError("QUOTA", "מכסה", 429);
  res = mkRes();
  await transcribe({ file: audioFile("audio/webm") }, res);
  assert.deepStrictEqual([res.code, res.body.code], [429, "QUOTA"]);

  aiState.error = new Error("boom");
  const orig = console.error; console.error = () => {};
  res = mkRes();
  await transcribe({ file: audioFile("audio/webm") }, res);
  console.error = orig;
  assert.strictEqual(res.code, 500);
});
