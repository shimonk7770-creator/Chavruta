// server/models/Holiday.js
// מודל מאמרי "מעגל השנה" - שכבת גישה לנתונים ב-Firestore (collection: "holidays")
// תואם ל-FR-028 (יצירה/עריכה - אדמין בלבד, BR-012) ו-FR-029 (צפייה - לכולם, כולל אורחים) ב-SRS.
//
// אין חישוב אסטרונומי של הלוח העברי (מחוץ להיקף המערכת, ראו סעיף 2.2 ב-SRS) - לכן "המועד הקרוב"
// אינו מחושב אוטומטית אלא מסומן ידנית ע"י האדמין דרך שדה isFeatured, ו-order קובע את סדר התצוגה בארכיון.

const { getDb } = require("../config/db");

const COLLECTION = "holidays";

function toHoliday(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// FR-028: יצירת מאמר חג חדש (אדמין בלבד - נבדק ב-middleware/permissions.js isAdminUser)
async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    holidayName: data.holidayName,
    dateHint: data.dateHint || "",
    whatWeDo: data.whatWeDo || "",
    whatWePray: data.whatWePray || "",
    customs: data.customs || "",
    linkedGroupId: data.linkedGroupId || "",
    // gregorianDate ("YYYY-MM-DD") - תאריך לועזי מדויק לשנה הנוכחית, מוזן ידנית ע"י האדמין (אופציונלי).
    // משמש רק להצגה בלוח השנה הגרגוריאני (server/utils/calendarGrid.js) - אין כאן חישוב אסטרונומי של הלוח העברי.
    gregorianDate: data.gregorianDate || "",
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    isFeatured: !!data.isFeatured,
    authorId: data.authorId,
    createdAt: now,
    updatedAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toHoliday(snap);
}

// FR-029: כל מאמרי החג, ממוינים לפי סדר השנה העברית (שדה order) - לתצוגת הארכיון
async function listAll() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).orderBy("order", "asc").get();
  return snaps.docs.map(toHoliday);
}

// המועד המוצג בהבלטה בראש העמוד - מסומן ידנית ע"י האדמין (isFeatured=true)
async function findFeatured() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("isFeatured", "==", true).limit(1).get();
  if (snaps.empty) return null;
  return toHoliday(snaps.docs[0]);
}

async function update(id, patch) {
  const db = getDb();
  const clean = { ...patch };
  if ("order" in clean) clean.order = Number.isFinite(Number(clean.order)) ? Number(clean.order) : 0;
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({ ...clean, updatedAt: new Date() });
  return findById(id);
}

async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = { create, findById, listAll, findFeatured, update, remove };
