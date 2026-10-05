// server/models/LearningGoal.js
// מודל "יעדי לימוד" אישיים - שכבת גישה לנתונים ב-Firestore (collection: "learningGoals")
// תוספת לפי משוב המשתמש (אוקטובר 2026) לעמוד "מעקב לימוד אישי" - יעד מוגדר ע"י המשתמש עצמו + סימון "בוצע"
// כל יעד שייך למשתמש בודד בלבד (מידע אישי, באותה רוח כמו LearningLog - ראו BR-006 וההרשאה הייעודית)

const { getDb } = require("../config/db");

const COLLECTION = "learningGoals";

function toGoal(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// יצירת יעד לימוד חדש שהמשתמש הגדיר לעצמו
async function create(data) {
  const db = getDb();
  const docRef = await db.collection(COLLECTION).add({
    userId: data.userId,
    text: data.text,
    done: false,
    createdAt: new Date(),
    doneAt: null,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toGoal(snap);
}

// כל היעדים של משתמש - יעדים פתוחים קודם, ואז לפי תאריך יצירה (מהחדש לישן)
async function listByUser(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).get();
  const goals = snaps.docs.map(toGoal);
  goals.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
  return goals;
}
function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// החלפת מצב "בוצע" ליעד - הסימון וי שהמשתמש ביקש
async function toggleDone(id, done) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ done, doneAt: done ? new Date() : null });
  return findById(id);
}

async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = { create, findById, listByUser, toggleDone, remove };
