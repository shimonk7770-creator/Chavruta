// server/utils/minyanimLogic.js
// הלוגיקה ה"טהורה" (בלי Firestore ובלי רשת) של קטגוריית "מניינים" - ניתנת לבדיקה אוטומטית
// (server/test/minyanimLogic.test.js). כוללת: מרחק בין שתי נקודות (Haversine), חישוב "המועד הבא" של מניין
// שבועי לפי שעון ישראל וכמה זמן נשאר עד אליו, סינון ומיון לפי קרבה, תיאור ימים בעברית, ולידציה של טופס הוספה.
//
// הנחת עבודה: כל המניינים בישראל (אזור זמן Asia/Jerusalem). מניין מוגדר לפי שעה קבועה ביום (HH:MM) וקבוצת ימים
// בשבוע - ולא "דקות לפני שקיעה" (שיפור אפשרי בהמשך, אפשר לחבר ל-zmanimTimes.js).

const TZ = "Asia/Jerusalem";
const WALK_MINUTES_PER_KM = 12; // הליכה של 5 קמ"ש - להערכת "מספיקים להגיע ברגל"
const STARTED_GRACE_SECONDS = 5 * 60; // מניין שהתחיל לפני עד 5 דקות עדיין מוצג ("התחיל לפני X דק'") - אפשר להצטרף

const PRAYER_LABELS = { shacharit: "שחרית", mincha: "מנחה", arvit: "ערבית" };
const NUSACH_LABELS = { any: "כל הנוסחים", ashkenaz: "אשכנז", sefard: "ספרד", edot: "עדות המזרח" };
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]; // לפי getDay(): 0=ראשון

// ימים מוגדרים-מראש בטופס ההוספה: key -> רשימת ימים (0=ראשון ... 6=שבת)
const DAY_PRESETS = {
  weekdays: { label: "ימי חול (א'-ה')", days: [0, 1, 2, 3, 4] },
  sunFri: { label: "ראשון עד שישי", days: [0, 1, 2, 3, 4, 5] },
  all: { label: "כל ימות השבוע", days: [0, 1, 2, 3, 4, 5, 6] },
  friday: { label: "ערב שבת (שישי)", days: [5] },
  shabbat: { label: "שבת בלבד", days: [6] },
};

function isValidPrayer(key) {
  return Object.prototype.hasOwnProperty.call(PRAYER_LABELS, key || "");
}
function isValidNusach(key) {
  return Object.prototype.hasOwnProperty.call(NUSACH_LABELS, key || "");
}

// ===== מרחק =====

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// מרחק בק"מ על פני כדור הארץ בין שתי נקודות {lat,lng} (נוסחת Haversine)
function haversineKm(a, b) {
  const R = 6371; // רדיוס כדור הארץ בק"מ
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "850 מ'" / "1.3 ק"מ" / "12 ק"מ"
function formatDistance(km) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} מ'`;
  if (km < 10) return `${km.toFixed(1)} ק"מ`;
  return `${Math.round(km)} ק"מ`;
}

// ===== זמן =====

// הרכיבים של "עכשיו" בשעון ישראל: יום בשבוע (0=ראשון), שניות מתחילת היום
function localClock(date, tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dow: dowMap[get("weekday")],
    secondsOfDay: Number(get("hour")) * 3600 + Number(get("minute")) * 60 + Number(get("second")),
  };
}

function parseTime(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
}

// המועד הבא של מניין: { secondsUntil (שלילי = כבר התחיל, בתוך חלון החסד), dayOffset, dayLabel } או null
function nextOccurrence(minyan, now = new Date(), tz = TZ) {
  const target = parseTime(minyan.time);
  const days = Array.isArray(minyan.days) ? minyan.days : [];
  if (target === null || !days.length) return null;
  const { dow, secondsOfDay } = localClock(now, tz);
  for (let offset = 0; offset <= 7; offset++) {
    const d = (dow + offset) % 7;
    if (!days.includes(d)) continue;
    const delta = offset * 86400 + target - secondsOfDay;
    if (delta >= 0 || (offset === 0 && delta >= -STARTED_GRACE_SECONDS)) {
      const dayLabel = offset === 0 ? "היום" : offset === 1 ? "מחר" : `ביום ${DAY_NAMES[d]}`;
      return { secondsUntil: delta, dayOffset: offset, dayLabel };
    }
  }
  return null;
}

// "עוד 7 דק'" / "עוד שעה ו-5 דק'" / "מתחיל עכשיו" / "התחיל לפני 3 דק'"
function formatCountdown(secondsUntil) {
  if (secondsUntil < 0) return `התחיל לפני ${Math.max(1, Math.ceil(-secondsUntil / 60))} דק'`;
  const totalMin = Math.ceil(secondsUntil / 60);
  if (totalMin <= 0 || secondsUntil < 30) return "מתחיל עכשיו";
  if (totalMin < 60) return `עוד ${totalMin} דק'`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const hours = h === 1 ? "שעה" : `${h} שעות`;
  return m ? `עוד ${hours} ו-${m} דק'` : `עוד ${hours}`;
}

// תיאור קצר של ימי המניין: "כל ימות השבוע", "ימי חול (א'-ה')", או רשימה
function daysLabel(days) {
  const set = [...new Set(days || [])].sort((a, b) => a - b);
  for (const preset of Object.values(DAY_PRESETS)) {
    if (preset.days.length === set.length && preset.days.every((d, i) => d === set[i])) return preset.label;
  }
  return set.map((d) => DAY_NAMES[d]).join(", ");
}

// ===== חיפוש ודירוג =====

// origin = {lat,lng}; options: prayer ("all"|key), radiusKm (מספר, 0=ללא הגבלה), sort ("distance"|"time"),
// horizonHours (מספר, 0=ללא הגבלה - ברירת מחדל 24: רק מניינים שמתקיימים ב-24 השעות הקרובות)
function searchMinyanim(minyanim, origin, now = new Date(), options = {}) {
  const { prayer = "all", radiusKm = 0, sort = "distance", horizonHours = 24 } = options;
  const results = [];
  for (const m of minyanim) {
    if (prayer !== "all" && m.prayer !== prayer) continue;
    if (typeof m.lat !== "number" || typeof m.lng !== "number") continue;
    const occ = nextOccurrence(m, now);
    if (!occ) continue;
    if (horizonHours > 0 && occ.secondsUntil > horizonHours * 3600) continue;
    const distanceKm = haversineKm(origin, { lat: m.lat, lng: m.lng });
    if (radiusKm > 0 && distanceKm > radiusKm) continue;
    const walkMinutes = Math.max(1, Math.round(distanceKm * WALK_MINUTES_PER_KM));
    results.push({
      minyan: m,
      distanceKm,
      distanceText: formatDistance(distanceKm),
      secondsUntil: occ.secondsUntil,
      dayLabel: occ.dayLabel,
      countdownText: formatCountdown(occ.secondsUntil),
      walkMinutes,
      canMakeItWalking: occ.secondsUntil / 60 >= walkMinutes,
    });
  }
  const byDistance = (a, b) => a.distanceKm - b.distanceKm || a.secondsUntil - b.secondsUntil;
  const byTime = (a, b) => a.secondsUntil - b.secondsUntil || a.distanceKm - b.distanceKm;
  results.sort(sort === "time" ? byTime : byDistance);
  return results;
}

// ===== ולידציה של טופס הוספת מניין =====
// מקבלת את req.body הגולמי ומחזירה { ok, errors:[...], value:{...} } - value כבר מנוקה ומנורמל (בלי sanitize של HTML -
// זה נעשה בקונטרולר עם sanitize-html כמו בשאר המערכת)
function validateMinyanInput(body, isValidCityKey) {
  const errors = [];
  const name = String((body && body.synagogueName) || "").trim();
  const address = String((body && body.address) || "").trim();
  const notes = String((body && body.notes) || "").trim();
  const time = String((body && body.time) || "").trim();
  const prayer = String((body && body.prayer) || "");
  const nusach = String((body && body.nusach) || "any");
  const city = String((body && body.city) || "");
  const preset = String((body && body.daysPreset) || "weekdays");

  if (name.length < 2 || name.length > 60) errors.push("שם בית הכנסת חייב להכיל 2-60 תווים");
  if (!isValidPrayer(prayer)) errors.push("יש לבחור תפילה (שחרית/מנחה/ערבית)");
  if (parseTime(time) === null) errors.push("יש להזין שעה תקינה בפורמט HH:MM");
  if (!isValidNusach(nusach)) errors.push("נוסח לא תקין");
  if (!isValidCityKey(city)) errors.push("יש לבחור עיר");
  if (!Object.prototype.hasOwnProperty.call(DAY_PRESETS, preset)) errors.push("יש לבחור ימים");
  if (address.length > 120) errors.push("הכתובת ארוכה מדי (עד 120 תווים)");
  if (notes.length > 200) errors.push("ההערות ארוכות מדי (עד 200 תווים)");

  // lat/lng אופציונליים (מגיעים מכפתור "המיקום שלי") - אם הוזנו חייבים להיות מספרים בטווח תקין
  let lat = null;
  let lng = null;
  if (body && body.lat !== undefined && body.lat !== "" && body.lng !== undefined && body.lng !== "") {
    lat = Number(body.lat);
    lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      errors.push("קואורדינטות לא תקינות");
      lat = null;
      lng = null;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      synagogueName: name,
      address,
      notes,
      time,
      prayer,
      nusach,
      city,
      days: DAY_PRESETS[preset] ? DAY_PRESETS[preset].days : [],
      lat,
      lng,
    },
  };
}

module.exports = {
  TZ,
  PRAYER_LABELS,
  NUSACH_LABELS,
  DAY_NAMES,
  DAY_PRESETS,
  isValidPrayer,
  isValidNusach,
  haversineKm,
  formatDistance,
  localClock,
  parseTime,
  nextOccurrence,
  formatCountdown,
  daysLabel,
  searchMinyanim,
  validateMinyanInput,
};
