// server/scripts/testGemini.js
// כלי אבחון למפתח ה-Gemini: מריצים אותו עם `node server/scripts/testGemini.js` (מתיקיית chavruta-app).
// מה הוא עושה: טוען את המפתח מ-.env, מושך מ-Google את רשימת מודלי הטקסט הזמינים למפתח שלך,
// שולח לכל אחד מהם (במקביל) בקשה קטנה עם הגבלת זמן, ומדפיס איזה מודל עונה ובכמה זמן.
// כך אפשר לבחור מודל מהיר ולשים אותו ב-GEMINI_MODEL בקובץ .env. המפתח עצמו לעולם לא מודפס.

require("dotenv").config();

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const KEY = (process.env.GEMINI_API_KEY || "").trim();
const TIMEOUT_MS = 25000; // כמה זמן מחכים לכל מודל
const MAX_MODELS = 8; // לא מציפים את המכסה

// מודלים שלא מתאימים לטקסט רגיל (קול, תמונה, הטמעות וכו')
const SKIP = /tts|image|live|audio|embed|vision|robotics|computer|native|imagen|veo|aqa/i;

function short(text, n = 70) {
  return String(text || "").replace(/\s+/g, " ").slice(0, n);
}

async function call(url, options) {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ms: Date.now() - started, json };
  } catch (error) {
    return { status: error.name === "TimeoutError" ? "TIMEOUT" : "ERR", ms: Date.now() - started, json: {} };
  }
}

(async () => {
  if (KEY.length < 10) {
    console.log("לא נמצא GEMINI_API_KEY בקובץ .env");
    process.exit(1);
  }
  const headers = { "content-type": "application/json", "x-goog-api-key": KEY };

  // 1. רשימת מודלים שתומכים ב-generateContent
  const list = await call(`${BASE}/models?pageSize=100`, { headers });
  if (list.status !== 200) {
    console.log("שליפת רשימת המודלים נכשלה:", list.status, short(list.json.error && list.json.error.message, 150));
    process.exit(1);
  }
  let names = (list.json.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace("models/", ""))
    .filter((n) => /flash|lite/i.test(n) && !SKIP.test(n));

  // המודל המוגדר כרגע ב-.env נבדק תמיד, ראשון
  const configured = (process.env.GEMINI_MODEL || "").trim();
  if (configured) names = [configured, ...names.filter((n) => n !== configured)];
  names = names.slice(0, MAX_MODELS);
  console.log(`בודק ${names.length} מודלים (עד ${TIMEOUT_MS / 1000} שניות לכל אחד)...\n`);

  // 2. בקשה קטנה לכל מודל, במקביל
  const results = await Promise.all(
    names.map(async (name) => {
      const r = await call(`${BASE}/models/${encodeURIComponent(name)}:generateContent`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contents: [{ parts: [{ text: "ענה במילה אחת בעברית: שלום" }] }], generationConfig: { maxOutputTokens: 50 } }),
      });
      const parts = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].content && r.json.candidates[0].content.parts;
      const text = parts ? parts.map((p) => p.text || "").join("") : "";
      const err = r.json.error && r.json.error.message;
      return { name, status: r.status, ms: r.ms, note: text ? `"${short(text, 30)}"` : short(err, 90) };
    })
  );

  results.forEach((r) => console.log(`${r.status === 200 ? "✓" : "✗"} ${r.name}${r.name === configured ? " (מוגדר ב-.env)" : ""}: ${r.status} | ${r.ms}ms | ${r.note}`));

  const ok = results.filter((r) => r.status === 200 && r.note).sort((a, b) => a.ms - b.ms);
  console.log(ok.length ? `\nהמהיר ביותר שענה: ${ok[0].name} (${ok[0].ms}ms)\nכדי להשתמש בו: GEMINI_MODEL=${ok[0].name}` : "\nאף מודל לא ענה בהצלחה.");
})();
