// server/models/Comment.js
// מודל התגובה - שכבת גישה לנתונים ב-Firestore (collection: "comments")
// תואם ל-FR-015, FR-016 ב-SRS
//
// הערה: עבר מ-Mongoose ל-Firestore. שם המגיב (authorName) נשמר ישירות על מסמך התגובה
// (denormalization) כדי להימנע מ-populate() שלא קיים ב-Firestore.

const { getDb } = require("../config/db");
const { toggleLikeIn } = require("./likeHelper"); // לייקים (❤️) - טרנזקציה אטומית

const COLLECTION = "comments";

function toComment(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// FR-015: הוספת תגובה
async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    postId: data.postId,
    authorId: data.authorId,
    authorName: data.authorName || "",
    content: data.content,
    likedBy: [], // מזהי המשתמשים שנתנו ❤️ (ראו utils/likes.js)
    aiCheck: ["approved", "unchecked", "skipped"].includes(data.aiCheck) ? data.aiCheck : "skipped", // תוצאת בדיקת הרלוונטיות של Gemini
    isArchived: false,
    createdAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toComment(snap);
}

// שליפת תגובות פעילות לפוסט מסוים, ממוין מהישן לחדש (FR-015)
async function listByPost(postId) {
  const db = getDb();
  const snaps = await db
    .collection(COLLECTION)
    .where("postId", "==", postId)
    .where("isArchived", "==", false)
    .get();
  const comments = snaps.docs.map(toComment);
  comments.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return comments;
}
function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// FR-016: מחיקת תגובה
async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

// BR-011: ארכוב כל תגובות של פוסט מסוים (משמש כשפוסט נמחק דרך מחיקת קבוצה)
async function archiveByPost(postId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("postId", "==", postId).get();
  const batch = db.batch();
  snaps.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
  await batch.commit();
}

// תגובות שפורסמו בלי בדיקת AI - לבדיקת אדמין
async function listUnchecked() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("aiCheck", "==", "unchecked").get();
  return snaps.docs.map(toComment).filter((c) => c && !c.isArchived).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

async function setAiCheck(id, aiCheck) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ aiCheck });
}

// לייק/ביטול לייק של משתמש על התגובה
async function toggleLike(id, userId) {
  return toggleLikeIn(COLLECTION, id, userId);
}

module.exports = { toggleLike, create, findById, listByPost, remove, archiveByPost, listUnchecked, setAiCheck };
