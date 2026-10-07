// server/services/aiService.js
// שירות ה-AI של האתר - עוטף את הקריאה ל-Gemini API (Google) בצד השרת בלבד.
// למה בשרת ולא בדפדפן: מפתח ה-API הוא סוד. הוא נקרא רק מ-process.env (קובץ .env שלא עולה ל-git)
// ולעולם לא נשלח ללקוח, לא נכתב ללוג ולא מופיע בהודעות שגיאה.
//
// הפונקציות כאן "טהורות" ככל האפשר ומקבלות את fetch ואת env כפרמטר - כדי שאפשר יהיה לבדוק אותן
// אוטומטית (server/test/aiService.test.js) בלי מפתח אמיתי ובלי אינטרנט.

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// שם המודל ניתן לשינוי ב-.env (GEMINI_MODEL) - Google מחליפה שמות מודלים מדי כמה חודשים,
// ולכן לא מקודדים אותו בקשיחות. אם המודל הזה לא קיים אצלך, מחליפים רק את השורה ב-.env.
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 60000; // אם Google לא ענתה תוך דקה - מוותרים (לא תוקעים את הבקשה). ניתן לשינוי ב-.env: GEMINI_TIMEOUT_MS

// שגיאה "מבוקרת" עם קוד ו-HTTP status שמתאימים להחזרה למשתמש (הודעה בעברית, בלי פרטים פנימיים)
class AiError extends Error {
  constructor(code, message, httpStatus) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// האם הוגדר מפתח? (בלי לחשוף אותו)
function isConfigured(env = process.env) {
  return typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim().length > 10;
}

// מוציא את הטקסט מתשובת Gemini. מבנה התשובה: candidates[0].content.parts[].text
// אם התשובה נחסמה (בטיחות) או ריקה - זורק AiError ברור במקום להחזיר undefined
function extractText(json) {
  if (json && json.promptFeedback && json.promptFeedback.blockReason) {
    throw new AiError("BLOCKED", "ה-AI סירב לענות על התוכן הזה. נסו לנסח אחרת.", 422);
  }
  const candidate = json && Array.isArray(json.candidates) ? json.candidates[0] : null;
  const parts = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) {
    if (candidate && candidate.finishReason === "SAFETY") {
      throw new AiError("BLOCKED", "ה-AI סירב לענות על התוכן הזה. נסו לנסח אחרת.", 422);
    }
    throw new AiError("EMPTY", "ה-AI לא החזיר תשובה. נסו שוב.", 502);
  }
  return text;
}

// ממפה קוד שגיאה מ-Google להודעה ידידותית (בעברית) - לא מעבירים את גוף השגיאה הגולמי למשתמש
function mapHttpError(status) {
  if (status === 429) return new AiError("QUOTA", "הגענו למגבלת הבקשות של ה-AI כרגע. נסו שוב בעוד דקה.", 429);
  if (status === 400) return new AiError("BAD_REQUEST", "הבקשה ל-AI לא תקינה (ייתכן שהטקסט ארוך מדי).", 400);
  if (status === 401 || status === 403) return new AiError("AUTH", "מפתח ה-AI אינו תקין או חסרות לו הרשאות. יש לבדוק את GEMINI_API_KEY בקובץ .env.", 502);
  if (status === 404) return new AiError("MODEL", "מודל ה-AI לא נמצא. יש לבדוק את GEMINI_MODEL בקובץ .env.", 502);
  return new AiError("UPSTREAM", "שירות ה-AI אינו זמין כרגע. נסו שוב מאוחר יותר.", 502);
}

// הפונקציה הראשית: שולחת הוראת מערכת + שאלה ומחזירה טקסט.
//   system - הוראות קבועות ל-AI (תפקיד, שפה, כללים)
//   prompt - התוכן/השאלה של המשתמש
async function generate({ system, prompt, maxOutputTokens = 1024, temperature = 0.4 }, { fetchImpl = fetch, env = process.env, timeoutMs } = {}) {
  // סדר עדיפויות: פרמטר (לבדיקות) > GEMINI_TIMEOUT_MS ב-.env > ברירת מחדל
  const effectiveTimeout = timeoutMs || Number(env.GEMINI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  if (!isConfigured(env)) {
    throw new AiError("NOT_CONFIGURED", "פיצ'ר ה-AI עדיין לא הוגדר בשרת (חסר מפתח GEMINI_API_KEY בקובץ .env).", 503);
  }
  const model = (env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  // AbortController - מבטל את הבקשה אם עבר זמן ההמתנה
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY.trim() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new AiError("TIMEOUT", "ה-AI לא הגיב בזמן. נסו שוב.", 504);
    }
    // שגיאת רשת - לא מדפיסים את error המלא כי עלול להכיל את כתובת הבקשה
    throw new AiError("NETWORK", "אין חיבור לשירות ה-AI. בדקו חיבור אינטרנט בשרת.", 502);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    throw new AiError("UPSTREAM", "התקבלה תשובה לא תקינה משירות ה-AI.", 502);
  }
  return extractText(json);
}

module.exports = { generate, isConfigured, extractText, mapHttpError, AiError, DEFAULT_MODEL };
