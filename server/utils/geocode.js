// server/utils/geocode.js
// המרת כתובת טקסט לקואורדינטות (lat/lng) דרך Nominatim של OpenStreetMap - שירות חינמי ופתוח.
// משמש את קטגוריית "מניינים": (1) כשמשתמש מקליד כתובת במקום "איפה אתה נמצא", (2) כשמוסיפים בית כנסת עם כתובת.
//
// כללי שימוש הוגנים של Nominatim (usage policy): לא יותר מבקשה אחת בשנייה, User-Agent מזהה, ו-cache של תוצאות.
// כולם מיושמים כאן. זו שליפה "best effort": כל כשל (אין אינטרנט, אין תוצאה, חסימה) מחזיר null - והקוראים
// נופלים בחן לחלופה (מרכז העיר שנבחרה) בלי לקרוס.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100; // מעט מעל שנייה בין בקשות
const TIMEOUT_MS = 6000;
const MAX_CACHE = 500;

const cache = new Map(); // שאילתה מנורמלת -> {lat,lng,label} או null
let lastRequestAt = 0;
let queue = Promise.resolve(); // מסדר את הבקשות בתור כדי לכבד את מגבלת הקצב גם כשמגיעות כמה במקביל

function normalizeQuery(q) {
  return String(q || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// מפרסר תשובת Nominatim (מערך תוצאות) לאובייקט {lat,lng,label} או null. פונקציה טהורה - נבדקת אוטומטית.
function parseNominatimResponse(data) {
  if (!Array.isArray(data) || !data.length) return null;
  const first = data[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: String(first.display_name || "").split(",").slice(0, 2).join(",").trim() };
}

async function geocodeAddress(query, fetchImpl = fetch) {
  const key = normalizeQuery(query);
  if (key.length < 3) return null;
  if (cache.has(key)) return cache.get(key);

  // ממתינים בתור, ואז מכבדים הפרש מינימלי מהבקשה הקודמת
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    try {
      const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}`;
      const res = await fetchImpl(url, {
        headers: { "User-Agent": "ChavrutaStudentProject/1.0 (course project)", Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return parseNominatimResponse(await res.json());
    } catch (e) {
      return null; // אין רשת / timeout - לא קריטי
    }
  });
  queue = run.catch(() => null);
  const result = await run;
  if (cache.size >= MAX_CACHE) cache.clear(); // cache פשוט וחסום - מספיק לפרויקט
  cache.set(key, result);
  return result;
}

module.exports = { geocodeAddress, parseNominatimResponse, normalizeQuery };
