// server/models/Status.js
// מודל "סטטוס" (סטוריז) - שכבת גישה לנתונים ב-Firestore (collection: "statuses")
// עדכון בעקבות בקשת המשתמש: פיצ'ר "סטטוס" מלא בהשראת וואטסאפ - תמונה/טקסט שנעלם אוטומטית אחרי 24 שעות,
// עם רשימת "נצפה ע"י" (viewers). המשתמש אישר במפורש את ההיקף הזה (לא סטטוס טקסט פשוט).
//
// הערה חשובה על "נעלם אחרי 24 שעות": בדומה לארכוב פוסטים/קבוצות (BR-011) בפרויקט הזה, לא מוחקים פיזית
// מה-DB - פשוט מסננים בשאילתות הקריאה (listActiveXxx) כל מסמך שעבר 24 שעות מאז היצירה. זה פתרון סביר
// ונפוץ לפרויקט לימודי (אין צורך ב-cron/scheduled function למחיקה אמיתית), ומונע גם אפשרות "לשחזר" סטטוס
// שנמחק בטעות לפני שפג תוקפו.

const { getDb } = require("../config/db");

const COLLECTION = "statuses";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 שעות - בדיוק כמו "סטטוס" בוואטסאפ

function toStatus(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function toMillis(v) {
  return v && v.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

function isExpired(status) {
  return Date.now() - toMillis(status.createdAt) > EXPIRY_MS;
}

// יצירת סטטוס חדש - type: "text" | "image"
// טקסט: content (הטקסט עצמו) + bgColor (אחד מהצבעים המוגדרים מראש בטופס - server/views/status/new.ejs)
// תמונה: mediaUrl (נתיב הקובץ שהועלה דרך multer) + content אופציונלי (כיתוב מתחת לתמונה)
async function create({ userId, userName, avatarUrl, type, content, mediaUrl, bgColor }) {
  const db = getDb();
  const docRef = await db.collection(COLLECTION).add({
    userId,
    userName: userName || "",
    avatarUrl: avatarUrl || "",
    type: type === "image" ? "image" : "text",
    content: (content || "").trim().slice(0, 300),
    mediaUrl: mediaUrl || "",
    bgColor: bgColor || "",
    viewers: [], // { userId, userName, viewedAt } - ראו addViewer למטה
    createdAt: new Date(),
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toStatus(snap);
}

// כל הסטטוסים הפעילים (לא פגי תוקף) של משתמש מסוים - ממוינים מהישן לחדש (סדר צפייה טבעי, כמו בוואטסאפ)
async function listActiveByUser(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).get();
  const statuses = snaps.docs.map(toStatus).filter((s) => !isExpired(s));
  statuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return statuses;
}

// "שורת הסטטוסים" בדף הבית - קיבוץ כל הסטטוסים הפעילים של *כל* המשתמשים לפי משתמש (לא כולל excludeUserId -
// "הסטטוס שלי" מוצג בנפרד תמיד ראשון בעמוד עצמו, לא כחלק מהרשימה הזו), ממוין מהחדש לישן.
// viewerId: המשתמש שצופה כרגע בשורה - משמש לחישוב seenByMe (האם כבר צפה בכל הסטטוסים של אותו משתמש),
// כדי לצייר טבעת צבעונית/אפורה סביב התמונה - בדיוק כמו ההבחנה "נצפה/לא נצפה" בוואטסאפ.
async function listActiveFeed(viewerId, excludeUserId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).get();
  const active = snaps.docs.map(toStatus).filter((s) => !isExpired(s) && s.userId !== excludeUserId);

  const byUser = new Map();
  active.forEach((s) => {
    if (!byUser.has(s.userId)) {
      byUser.set(s.userId, { userId: s.userId, userName: s.userName, avatarUrl: s.avatarUrl, statuses: [] });
    }
    byUser.get(s.userId).statuses.push(s);
  });

  const feed = Array.from(byUser.values()).map((entry) => {
    const latest = entry.statuses.reduce((a, b) => (toMillis(a.createdAt) > toMillis(b.createdAt) ? a : b));
    const seenByMe = entry.statuses.every((s) => s.viewers.some((v) => v.userId === viewerId));
    return { userId: entry.userId, userName: entry.userName, avatarUrl: entry.avatarUrl, count: entry.statuses.length, latestCreatedAt: latest.createdAt, seenByMe };
  });
  feed.sort((a, b) => toMillis(b.latestCreatedAt) - toMillis(a.latestCreatedAt));
  return feed;
}

// רישום צפייה - לא רושמים צפייה עצמית (הבעלים לא "צופה" בסטטוס של עצמו), ולא כופלים את אותו צופה פעמיים
async function addViewer(id, viewerId, viewerName) {
  const status = await findById(id);
  if (!status || status.userId === viewerId) return status;
  if (status.viewers.some((v) => v.userId === viewerId)) return status;

  const db = getDb();
  const updatedViewers = [...status.viewers, { userId: viewerId, userName: viewerName || "", viewedAt: new Date() }];
  await db.collection(COLLECTION).doc(id).update({ viewers: updatedViewers });
  return findById(id);
}

// מחיקה מוקדמת ע"י הבעלים (לפני שפג התוקף) - רשות נחמדה בהשראת "מחיקת סטטוס" בוואטסאפ
async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = { create, findById, listActiveByUser, listActiveFeed, addViewer, remove, isExpired, EXPIRY_MS };
