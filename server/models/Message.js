// server/models/Message.js
// מודל הודעת צ'אט - שכבת גישה לנתונים ב-Firestore (collection: "messages")
// תואם ל-FR-021, FR-022, FR-024 ב-SRS
//
// עדכון (בקשת המשתמש - "וואטסאפ-ification"): בנוסף להודעות קבוצתיות (groupId), נוסף תמיכה בצ'אט פרטי
// 1-על-1 בין שני משתמשים. כדי לא לשכפל קוד/collection, אותו מסמך הודעה משמש לשני הסוגים:
// הודעה קבוצתית: groupId מלא, dmRoomId/recipientId ריקים. הודעה פרטית: dmRoomId+recipientId מלאים, groupId ריק.
// dmRoomId הוא מזהה "חדר" דטרמיניסטי לזוג משתמשים (ראו dmRoomIdFor למטה) - זהה לשני הצדדים בלי תלות מי פתח ראשון.
//
// הערה: שם השולח (senderName) נשמר ישירות על מסמך ההודעה (denormalization), כמו ב-Post/Comment,
// כדי להימנע מ-populate() שלא קיים ב-Firestore.

const { getDb } = require("../config/db");

const COLLECTION = "messages";
const MAX_CONTENT_LENGTH = 1000;

// בונה מזהה חדר דטרמיניסטי לצ'אט פרטי בין שני משתמשים - תמיד אותו מזהה לא משנה מי מהשניים "פתח" את הצ'אט,
// כי ממיינים את שני המזהים לפני החיבור (אותו רעיון בדיוק כמו room ייחודי לקבוצה, רק לזוג משתמשים)
function dmRoomIdFor(userIdA, userIdB) {
  return "dm:" + [userIdA, userIdB].sort().join("_");
}

function toMessage(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// FR-021: שמירת הודעה חדשה - נקרא מ-server/sockets/chatSocket.js אחרי אימות חברות בקבוצה
// תוספת לפי משוב המשתמש (אוקטובר 2026): הודעה יכולה לכלול תמונה (imageUrl) - מותר גם הודעה עם תמונה בלבד,
// בלי טקסט בכלל (בדיוק כמו בוואטסאפ) - ולכן הבדיקה היא "אין טקסט וגם אין תמונה", לא רק "אין טקסט"
async function create({ groupId, senderId, senderName, content, imageUrl }) {
  const trimmed = (content || "").trim();
  if (!trimmed && !imageUrl) {
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
    imageUrl: imageUrl || "",
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

// ===== עדכון: צ'אט פרטי (1-על-1) - נקרא מ-server/sockets/chatSocket.js (אירועי dm:*) =====

// שמירת הודעה פרטית חדשה - אותו דפוס בדיוק כמו create() הקבוצתית, רק עם dmRoomId+recipientId במקום groupId
async function createDm({ dmRoomId, senderId, senderName, recipientId, content }) {
  const trimmed = (content || "").trim();
  if (!trimmed) {
    throw new Error("לא ניתן לשלוח הודעה ריקה");
  }
  if (!dmRoomId || !senderId || !recipientId) {
    throw new Error("חסרים פרטי שולח/נמען בהודעה הפרטית");
  }

  const db = getDb();
  const docRef = await db.collection(COLLECTION).add({
    dmRoomId,
    senderId,
    senderName: senderName || "",
    recipientId,
    content: trimmed.slice(0, MAX_CONTENT_LENGTH),
    createdAt: new Date(),
  });
  return findById(docRef.id);
}

// היסטוריית הצ'אט הפרטי - אותו רעיון בדיוק כמו listByGroup
async function listByDm(dmRoomId, { limit = 50 } = {}) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("dmRoomId", "==", dmRoomId).get();
  const messages = snaps.docs.map(toMessage);
  messages.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return messages.slice(-limit);
}

// fallback REST לחיבור מחדש בצ'אט פרטי - אותו רעיון בדיוק כמו listSince
async function listDmSince(dmRoomId, sinceDate) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("dmRoomId", "==", dmRoomId).get();
  const messages = snaps.docs.map(toMessage).filter((m) => toMillis(m.createdAt) > toMillis(sinceDate));
  messages.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return messages;
}

// רשימת "שיחות" פרטיות של משתמש - עבור תיבת ה"הודעות" (/messages), בהשראת רשימת הצ'אטים בוואטסאפ.
// Firestore לא תומך ב-OR בין שני שדות (senderId==me / recipientId==me) - לכן שתי שאילתות במקביל ומאחדים,
// אותו רעיון בדיוק כמו User.findByEmailOrUsername. לכל dmRoomId משאירים רק את ההודעה האחרונה (preview).
async function listConversationsForUser(userId) {
  // הערה: לא משלבים כאן עוד תנאי where על dmRoomId (כדי להימנע מאינדקס מורכב ב-Firestore, כמו בכל שאר
  // המודלים בפרויקט) - במקום זה שולפים הכל לפי senderId/recipientId ומסננים הודעות קבוצתיות בזיכרון למטה.
  const db = getDb();
  const [sent, received] = await Promise.all([
    db.collection(COLLECTION).where("senderId", "==", userId).get(),
    db.collection(COLLECTION).where("recipientId", "==", userId).get(),
  ]);
  const all = [...sent.docs, ...received.docs].map(toMessage).filter((m) => m && m.dmRoomId);

  const latestByRoom = new Map();
  all.forEach((m) => {
    const existing = latestByRoom.get(m.dmRoomId);
    if (!existing || toMillis(m.createdAt) > toMillis(existing.createdAt)) {
      latestByRoom.set(m.dmRoomId, m);
    }
  });

  const conversations = Array.from(latestByRoom.values()).map((m) => ({
    dmRoomId: m.dmRoomId,
    otherUserId: m.senderId === userId ? m.recipientId : m.senderId,
    lastMessage: m,
  }));
  conversations.sort((a, b) => toMillis(b.lastMessage.createdAt) - toMillis(a.lastMessage.createdAt));
  return conversations;
}

module.exports = {
  create,
  findById,
  listByGroup,
  listSince,
  dmRoomIdFor,
  createDm,
  listByDm,
  listDmSince,
  listConversationsForUser,
};
