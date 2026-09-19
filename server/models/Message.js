// server/models/Message.js
// מודל הודעת צ'אט - שכבת גישה לנתונים ב-Firestore (collection: "messages")
// כל הודעה משויכת לקבוצה - הצ'אט הוא "חדר" אחד לכל קבוצה (לא צ'אט פרטי בין שני משתמשים)
// תואם ל-FR-021, FR-022, FR-024 ב-SRS
//
// הערה: שם השולח (senderName) נשמר ישירות על מסמך ההודעה (denormalization), כמו ב-Post/Comment,
// כדי להימנע מ-populate() שלא קיים ב-Firestore.

const { getDb } = require("../config/db");

const COLLECTION = "messages";
const MAX_CONTENT_LENGTH = 1000;

function toMessage(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// FR-021: שמירת הודעה חדשה - נקרא מ-server/sockets/chatSocket.js אחרי אימות חברות בקבוצה
async function create({ groupId, senderId, senderName, content }) {
  const trimmed = (content || "").trim();
  if (!trimmed) {
    throw new Error("לא ניתן לשלוח הודעה ריקה");
  }
  if (!groupId || !senderId) {
    throw new Error("חסרים פרטי קבוצה/שולח בהודעה");
  }

  const db = getDb();
  const docRef = await db.collection(COLLECTION).add({
    groupId,
    senderId,
    senderName: senderName || "",
    content: trimmed.slice(0, MAX_CONTENT_LENGTH),
    createdAt: new Date(),
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toMessage(snap);
}

// FR-022: היסטוריית צ'אט - עד limit ההודעות האחרונות של קבוצה, ממוינות מהישן לחדש (סדר תצוגה טבעי בצ'אט)
async function listByGroup(groupId, { limit = 50 } = {}) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("groupId", "==", groupId).get();
  const messages = snaps.docs.map(toMessage);
  messages.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  // שולפים הכל ואז חותכים בזיכרון ל-limit האחרונות - נמנעים מ-orderBy+limitToLast (דורש אינדקס מורכב ב-Firestore)
  // סביר לחלוטין לגודל פרויקט לימודי; אותה גישה משמשת גם ב-Group.search / Post.search
  return messages.slice(-limit);
}

// FR-024: fallback ל-REST בזמן ניתוק/חיבור מחדש - שולף רק הודעות שנוצרו אחרי זמן מסוים,
// כדי להשלים "חורים" בהיסטוריה אם ה-socket התנתק לזמן קצר ופספס broadcast
async function listSince(groupId, sinceDate) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("groupId", "==", groupId).get();
  const messages = snaps.docs.map(toMessage).filter((m) => toMillis(m.createdAt) > toMillis(sinceDate));
  messages.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return messages;
}

module.exports = { create, findById, listByGroup, listSince };
