// server/models/LearningLog.js
// מודל רישום לימוד אישי - שכבת גישה לנתונים ב-Firestore (collection: "learningLogs")
// תואם ל-FR-018, FR-019, FR-020 ולכלל BR-006 ב-SRS

const { getDb } = require("../config/db");

const COLLECTION = "learningLogs";

function toLog(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function toDateOnly(d) {
  // מנרמל תאריך ל-YYYY-MM-DD (בלי שעה) - כדי שהשוואת "אותו יום" תהיה עקבית
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// FR-018: רישום יחידת לימוד. BR-006: לא ניתן לתאריך עתידי. מונע כפילות מדויקת (אותו יום+יחידה)
async function create(data) {
  const db = getDb();
  const date = toDateOnly(data.date);

  if (date.getTime() > toDateOnly(new Date()).getTime()) {
    throw new Error("לא ניתן לרשום לימוד לתאריך עתידי");
  }

  // בדיקת כפילות: אותו משתמש, אותו תאריך, אותה יחידה בדיוק
  const dup = await db
    .collection(COLLECTION)
    .where("userId", "==", data.userId)
    .where("date", "==", date)
    .where("unit", "==", data.unit)
    .limit(1)
    .get();
  if (!dup.empty) {
    throw new Error("כבר קיים רישום זהה עבור תאריך ויחידה אלו");
  }

  const docRef = await db.collection(COLLECTION).add({
    userId: data.userId,
    groupId: data.groupId || null,
    groupName: data.groupName || "",
    unit: data.unit,
    date,
    notes: data.notes || "",
    createdAt: new Date(),
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toLog(snap);
}

// FR-020: כל רישומי הלימוד של משתמש, ממוינים מהחדש לישן - משמש גם לתצוגת ה-Canvas (heatmap)
async function listByUser(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).get();
  const logs = snaps.docs.map(toLog);
  logs.sort((a, b) => toMillis(b.date) - toMillis(a.date));
  return logs;
}
function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// FR-019: עדכון רישום לימוד (הבעלים בלבד - נבדק במידלוור)
async function update(id, patch) {
  const db = getDb();
  const finalPatch = { ...patch };
  if (finalPatch.date) finalPatch.date = toDateOnly(finalPatch.date);
  await db.collection(COLLECTION).doc(id).update(finalPatch);
  return findById(id);
}

// FR-019: מחיקת רישום לימוד
async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = { create, findById, listByUser, update, remove };
