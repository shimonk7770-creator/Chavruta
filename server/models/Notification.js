// server/models/Notification.js
// מודל התראות "פעמון" בזמן אמת - שכבת גישה לנתונים ב-Firestore (collection: "notifications")
// כל התראה שייכת למשתמש-נמען ספציפי (userId). נוצרת מ-2 מקומות: chatSocket.js (הודעת צ'אט חדשה)
// ו-commentController.js (תגובה חדשה על פוסט שלי) - ומוצגת בתפריט העליון בכל עמוד (server/public/js/notifications.js)

const { getDb } = require("../config/db");

const COLLECTION = "notifications";

function toNotification(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function toMillis(v) {
  return v && v.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// יצירת התראה חדשה - type: "message" | "comment", link: לאן הלחיצה על ההתראה מובילה
async function create({ userId, type, text, link }) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    userId,
    type,
    text,
    link: link || "/",
    isRead: false,
    createdAt: now,
  });
  const snap = await docRef.get();
  return toNotification(snap);
}

// ההתראות האחרונות של המשתמש (לתצוגה בנפתח הפעמון) - ממוינות מהחדשה לישנה
async function listForUser(userId, { limit = 15 } = {}) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).get();
  const all = snaps.docs.map(toNotification);
  all.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return all.slice(0, limit);
}

// כמות ההתראות שטרם נקראו - מוצגת כ"בועה" אדומה על הפעמון
async function countUnread(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).where("isRead", "==", false).get();
  return snaps.size;
}

// מסמנים את כל ההתראות של המשתמש כ"נקראו" - נקרא ברגע שפותחים את תפריט הפעמון
async function markAllRead(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("userId", "==", userId).where("isRead", "==", false).get();
  if (snaps.empty) return;
  const batch = db.batch();
  snaps.docs.forEach((doc) => batch.update(doc.ref, { isRead: true }));
  await batch.commit();
}

module.exports = { create, listForUser, countUnread, markAllRead };
