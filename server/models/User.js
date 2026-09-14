// server/models/User.js
// מודל המשתמש - שכבת גישה לנתונים ב-Firestore (collection: "users")
// תואם לסכמת המסד ולדרישות ה-RBAC בסעיף 3 וה-FR-001..FR-005 במסמך ה-SRS
//
// הערה: המערכת עברה מ-MongoDB/Mongoose ל-Firebase/Firestore (לבקשת הקורס).
// ב-Firestore אין Schema מובנה כמו ב-Mongoose - הולידציה מתבצעת ידנית בקונטרולר,
// וכל מסמך מקבל מזהה (id) שהוא מחרוזת (לא ObjectId).

const { getDb } = require("../config/db");

const COLLECTION = "users";

// ממיר מסמך Firestore לאובייקט JS רגיל עם שדה id
function toUser(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// גרסה "בטוחה לתצוגה" של המשתמש - בלי סיסמת ה-hash (חשוב! NFR-003)
function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /register - FR-001: יצירת משתמש חדש
async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    fullName: data.fullName,
    username: data.username,
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role || "member",
    avatarUrl: data.avatarUrl || "",
    bio: data.bio || "",
    isActive: true,
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: now,
    updatedAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toUser(snap);
}

// BR-003: חיפוש לפי אימייל (משמש גם בכניסה וגם בבדיקת ייחודיות)
async function findByEmail(email, { activeOnly = false } = {}) {
  const db = getDb();
  const q = await db.collection(COLLECTION).where("email", "==", email).limit(1).get();
  if (q.empty) return null;
  const user = toUser(q.docs[0]);
  if (activeOnly && !user.isActive) return null; // FR-005: חשבון שנמחק לא יכול להתחבר
  return user;
}

// BR-001: חיפוש לפי שם משתמש (משמש בבדיקת ייחודיות ובבדיקת זמינות ב-Ajax)
async function findByUsername(username) {
  const db = getDb();
  const q = await db.collection(COLLECTION).where("username", "==", username).limit(1).get();
  if (q.empty) return null;
  return toUser(q.docs[0]);
}

// בדיקת ייחודיות אימייל/שם משתמש בהרשמה - Firestore לא תומך ב-$or בין שני שדות,
// לכן מריצים שתי שאילתות במקביל ומאחדים את התוצאה
async function findByEmailOrUsername(email, username) {
  const [byEmail, byUsername] = await Promise.all([findByEmail(email), findByUsername(username)]);
  return byEmail || byUsername;
}

async function update(id, patch) {
  const db = getDb();
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({ ...patch, updatedAt: new Date() });
  return findById(id);
}

// BR-010: בודקת אם המשתמש נעול כרגע עקב ניסיונות התחברות כושלים
function isLocked(user) {
  return !!(user.lockUntil && new Date(user.lockUntil) > new Date());
}

module.exports = {
  create,
  findById,
  findByEmail,
  findByUsername,
  findByEmailOrUsername,
  update,
  isLocked,
  toPublicUser,
};
