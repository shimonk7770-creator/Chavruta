// server/utils/jsonSafe.js
// הופך נתונים של מודלים (Firestore) למבנה JSON נקי שאפשר לשלוח לאפליקציה:
//  - Timestamp של Firestore / Date  ->  מחרוזת ISO (אחרת JSON.stringify היה מחזיר {_seconds,_nanoseconds} שאי אפשר להשתמש בו)
//  - שדות רגישים (סיסמאות, נעילות) מוסרים תמיד, כדי שגם אם בקר מעביר בטעות אובייקט משתמש גולמי הם לא יודלפו
//  - פונקציות מוסרות, ועומק רקורסיה מוגבל (הגנה מפני מבנים מעגליים)
// פונקציה טהורה - נבדקת ב-server/test/jsonSafe.test.js

const SENSITIVE_KEYS = new Set(["passwordHash", "password", "loginAttempts", "lockUntil", "idToken", "token"]);
const MAX_DEPTH = 12;

function timestampToIso(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }
  if (value && typeof value === "object" && typeof value._seconds === "number") {
    return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6)).toISOString();
  }
  return undefined; // לא תאריך
}

function jsonSafe(value, depth = 0) {
  if (value === null || value === undefined) return value === undefined ? undefined : null;
  if (depth > MAX_DEPTH) return undefined;
  const type = typeof value;
  if (type === "function" || type === "symbol") return undefined;
  if (type !== "object") return value;

  const iso = timestampToIso(value);
  if (iso !== undefined) return iso;

  if (Array.isArray(value)) return value.map((item) => jsonSafe(item, depth + 1)).filter((item) => item !== undefined);

  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    const safe = jsonSafe(inner, depth + 1);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
}

module.exports = { jsonSafe, SENSITIVE_KEYS };
