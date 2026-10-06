// server/models/Minyan.js
// מודל "מניין" - שכבת גישה לנתונים ב-Firestore (collection: "minyanim") לקטגוריית "מניינים" (/minyanim).
// מניין = תפילה אחת (שחרית/מנחה/ערבית) בבית כנסת מסוים, בשעה קבועה, בקבוצת ימים בשבוע, עם מיקום (lat/lng).
// משתמשים מחוברים מוסיפים מניינים; רק מי שהוסיף (או אדמין) יכול למחוק. נתוני דמו נזרעים ב-npm run seed (isDemo=true).
//
// כמות המניינים קטנה - לכן שולפים את כולם ומסננים/ממיינים לפי מרחק בזיכרון השרת
// (אין ב-Firestore חיפוש גאוגרפי מובנה; בהיקף גדול היה מוסיפים geohash).

const { getDb } = require("../config/db");

const COLLECTION = "minyanim";

function toMinyan(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    synagogueName: data.synagogueName,
    prayer: data.prayer, // shacharit | mincha | arvit
    time: data.time, // "HH:MM" (שעון ישראל)
    days: data.days, // [0..6], 0=ראשון
    nusach: data.nusach || "any",
    city: data.city, // מפתח עיר מתוך shabbatTimes.CITIES
    cityLabel: data.cityLabel || "",
    address: data.address || "",
    notes: data.notes || "",
    lat: data.lat,
    lng: data.lng,
    // עד כמה המיקום מדויק: exact (מיקום המכשיר), address (גיאוקוד כתובת), city (מרכז העיר - בקירוב)
    locationPrecision: data.locationPrecision || "city",
    isDemo: !!data.isDemo,
    createdBy: data.createdBy || "",
    createdByName: data.createdByName || "",
    createdAt: now,
    updatedAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  return toMinyan(snap);
}

async function listAll() {
  const snaps = await getDb().collection(COLLECTION).get();
  return snaps.docs.map(toMinyan);
}

async function remove(id) {
  await getDb().collection(COLLECTION).doc(id).delete();
}

module.exports = { create, findById, listAll, remove };
