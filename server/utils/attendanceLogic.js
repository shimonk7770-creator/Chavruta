// server/utils/attendanceLogic.js
// לוגיקה טהורה של "אני מגיע" למניין (בקשת המרצה: ליד כל תפילה כל אחד מסמן שהוא מגיע, וכולם רואים אם יש מניין,
// והמונה מתאפס אחרי התפילה). נבדקת ב-test/attendanceLogic.test.js בלי Firestore ובלי רשת.
//
// רעיון האיפוס: ההצבעות נשמרות לפי "מופע" של התפילה = מניין + תאריך (בשעון ישראל). אחרי שהתפילה עברה, המופע הבא הוא בתאריך אחר,
// ולכן המונה פשוט מתחיל מאפס, בלי משימת ניקוי ובלי שעון מתזמן.

const TZ = "Asia/Jerusalem";
const MINYAN_TARGET = 10; // כמה צריך למניין
const VOTE_WINDOW_SECONDS = 24 * 3600; // אפשר להצביע רק על תפילה שמתקיימת ב-24 השעות הקרובות (או שהתחילה לפני רגע)

// התאריך של "עכשיו" בשעון ישראל, בפורמט YYYY-MM-DD
function israelDateISO(now = new Date(), tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// מוסיף ימים לתאריך YYYY-MM-DD (חישוב ב-UTC, ללא השפעה של שעון קיץ)
function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// התאריך שבו מתקיים המופע הבא של המניין (dayOffset מגיע מ-minyanimLogic.nextOccurrence)
function occurrenceDateISO(now, dayOffset, tz = TZ) {
  return addDaysISO(israelDateISO(now, tz), dayOffset);
}

// מזהה המסמך של מופע: מניין + תאריך
function attendanceDocId(minyanId, dateISO) {
  return `${minyanId}__${dateISO}`;
}

// האם מותר להצביע כרגע על המופע (secondsUntil מתוך nextOccurrence; שלילי = כבר התחיל, בתוך חלון החסד)
function canVote(secondsUntil) {
  return typeof secondsUntil === "number" && secondsUntil <= VOTE_WINDOW_SECONDS;
}

// סיכום להצגה: { count, target, going, hasMinyan, missing, percent }
function attendanceSummary(record, userId, target = MINYAN_TARGET) {
  const list = record && Array.isArray(record.attendees) ? record.attendees : [];
  const count = list.length;
  return {
    count,
    target,
    going: Boolean(userId) && list.includes(userId),
    hasMinyan: count >= target,
    missing: Math.max(0, target - count),
    percent: Math.min(100, Math.round((count / target) * 100)),
  };
}

// החלפת מצב "מגיע": מוסיף אם עוד לא מסומן, מסיר אם כבר מסומן
function toggleAttendee(list, userId) {
  const current = Array.isArray(list) ? list : [];
  if (current.includes(userId)) return { attendees: current.filter((id) => id !== userId), going: false };
  return { attendees: [...current, userId], going: true };
}

module.exports = {
  MINYAN_TARGET,
  VOTE_WINDOW_SECONDS,
  israelDateISO,
  addDaysISO,
  occurrenceDateISO,
  attendanceDocId,
  canVote,
  attendanceSummary,
  toggleAttendee,
};
