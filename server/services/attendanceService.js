// server/services/attendanceService.js
// "אני מגיע" למניין: הצבעה, והוספת המונה לרשימות (עמוד המניינים ועמוד זמני היום). כל החישוב של התאריך נעשה בשרת
// (הלקוח לא שולח תאריך), כך שאי אפשר להצביע על מופע אחר מהנוכחי.

const Minyan = require("../models/Minyan");
const Attendance = require("../models/MinyanAttendance");
const L = require("../utils/minyanimLogic");
const A = require("../utils/attendanceLogic");

// מוסיף לכל תוצאת חיפוש (מ-searchMinyanim) את שדה attendance: { count, target, going, hasMinyan, missing, percent, canVote }
async function decorateResults(results, userId, now = new Date()) {
  const keyed = results.map((r) => {
    const dateISO = A.occurrenceDateISO(now, r.dayOffset);
    return { r, dateISO, docId: A.attendanceDocId(r.minyan.id, dateISO) };
  });
  const records = await Attendance.getMany(keyed.map((k) => k.docId));
  keyed.forEach(({ r, docId }) => {
    r.attendance = { ...A.attendanceSummary(records.get(docId), userId), canVote: A.canVote(r.secondsUntil) };
  });
  return results;
}

// מניינים של היום בעיר (לעמוד זמני היום): רק מי שמתקיים היום ועוד לא הסתיים (כולל חלון חסד), ממוינים לפי שעה
async function todaysForCity(cityKey, userId, now = new Date()) {
  const all = await Minyan.listAll();
  const items = [];
  for (const m of all) {
    if (m.city !== cityKey) continue;
    const occ = L.nextOccurrence(m, now);
    if (!occ || occ.dayOffset !== 0) continue;
    items.push({ minyan: m, secondsUntil: occ.secondsUntil, dayOffset: 0, countdownText: L.formatCountdown(occ.secondsUntil) });
  }
  items.sort((a, b) => a.secondsUntil - b.secondsUntil);
  await decorateResults(items, userId, now);
  return items;
}

// הצבעה על המופע הבא של מניין. מחזיר { status: "ok"|"notFound"|"closed", attendance }
async function toggleAttendance(minyanId, userId, now = new Date()) {
  const minyan = await Minyan.findById(minyanId);
  if (!minyan) return { status: "notFound" };
  const occ = L.nextOccurrence(minyan, now);
  if (!occ) return { status: "notFound" };
  if (!A.canVote(occ.secondsUntil)) return { status: "closed" };
  const dateISO = A.occurrenceDateISO(now, occ.dayOffset);
  const docId = A.attendanceDocId(minyanId, dateISO);
  const { attendees } = await Attendance.toggle(minyanId, dateISO, docId, userId);
  return { status: "ok", attendance: { ...A.attendanceSummary({ attendees }, userId), canVote: true } };
}

module.exports = { decorateResults, todaysForCity, toggleAttendance };
