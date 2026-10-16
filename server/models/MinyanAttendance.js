// server/models/MinyanAttendance.js
// הצבעות "אני מגיע" למופע של מניין (collection: "minyanAttendance"). מסמך לכל מופע: מזהה = "<minyanId>__<YYYY-MM-DD>".
// ההצבעות של מופע שעבר פשוט נשארות בתאריך שלהן (היסטוריה), והמופע הבא מקבל מסמך חדש - כך המונה "מתאפס" אחרי התפילה.

const { getDb } = require("../config/db");
const { toggleAttendee } = require("../utils/attendanceLogic");

const COLLECTION = "minyanAttendance";

// שולף כמה מופעים בבת אחת: מקבל מערך מזהי מסמכים, מחזיר Map של מזהה -> { attendees } (מופע בלי הצבעות לא מופיע)
async function getMany(docIds) {
  const unique = [...new Set(docIds)];
  const map = new Map();
  if (!unique.length) return map;
  const db = getDb();
  const refs = unique.map((id) => db.collection(COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);
  snaps.forEach((snap) => {
    if (snap.exists) map.set(snap.id, snap.data());
  });
  return map;
}

// הצבעה/ביטול הצבעה של משתמש במופע - בטרנזקציה, כדי ששתי לחיצות באותו רגע לא יאבדו קול
async function toggle(minyanId, dateISO, docId, userId) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().attendees : [];
    const { attendees, going } = toggleAttendee(current, userId);
    tx.set(ref, { minyanId, date: dateISO, attendees, updatedAt: new Date() }, { merge: true });
    return { attendees, going };
  });
}

module.exports = { getMany, toggle };
