// server/models/Post.js
// מודל הפוסט (דבר תורה / שאלה / עדכון / תוכן חג) - שכבת גישה לנתונים ב-Firestore (collection: "posts")
// תואם ל-FR-012..FR-017 ולסכמת המסד בסעיף 9 ב-SRS
//
// הערה: עבר מ-Mongoose ל-Firestore. שם המחבר (authorName) ושם הקבוצה (groupName)
// נשמרים ישירות על מסמך הפוסט (denormalization) כדי להימנע מ-populate() שלא קיים ב-Firestore.
// חיפוש טקסט חופשי (FR-012) מבוצע בזיכרון השרת - ל-Firestore אין אינדקס $text מובנה כמו ב-Mongo.

const { getDb } = require("../config/db");

const COLLECTION = "posts";
const VALID_CATEGORIES = ["dvarTorah", "question", "update", "holiday"];

function toPost(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function sortByCreatedAtDesc(items) {
  return items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}
function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

// FR-013: יצירת פוסט
async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    title: data.title,
    content: data.content,
    category: VALID_CATEGORIES.includes(data.category) ? data.category : "update",
    groupId: data.groupId,
    groupName: data.groupName || "",
    authorId: data.authorId,
    authorName: data.authorName || "",
    videoUrl: data.videoUrl || "",
    imageUrls: data.imageUrls || [], // גלריית תמונות לפוסט (שיפור UX - "רשת חברתית אמיתית")
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toPost(snap);
}

// פוסטים פעילים של קבוצה מסוימת (מוצג בעמוד הקבוצה)
async function listByGroup(groupId) {
  const db = getDb();
  const snaps = await db
    .collection(COLLECTION)
    .where("groupId", "==", groupId)
    .where("isArchived", "==", false)
    .get();
  return sortByCreatedAtDesc(snaps.docs.map(toPost));
}

// FR-017: פיד אישי - כל הפוסטים הפעילים מתוך רשימת מזהי קבוצות (הקבוצות שהמשתמש חבר בהן)
// Firestore מגביל שאילתת "in" ל-30 ערכים לכל היותר - סביר לחלוטין לפרויקט לימודי
async function listByGroupIds(groupIds, { page = 1, pageSize = 10 } = {}) {
  if (!groupIds.length) return { posts: [], total: 0 };
  const db = getDb();
  const snaps = await db
    .collection(COLLECTION)
    .where("groupId", "in", groupIds.slice(0, 30))
    .where("isArchived", "==", false)
    .get();
  const all = sortByCreatedAtDesc(snaps.docs.map(toPost));
  return paginate(all, page, pageSize);
}

// FR-012: חיפוש פוסטים - category/groupId מסוננים ב-DB, טווח תאריכים על createdAt, keyword בזיכרון
async function search({ category, groupId, dateFrom, dateTo, keyword }, { page = 1, pageSize = 10 } = {}) {
  const db = getDb();
  let query = db.collection(COLLECTION).where("isArchived", "==", false);

  if (category) query = query.where("category", "==", category);
  if (groupId) query = query.where("groupId", "==", groupId);
  if (dateFrom) query = query.where("createdAt", ">=", new Date(dateFrom));
  if (dateTo) query = query.where("createdAt", "<=", new Date(dateTo));

  const snaps = await query.get();
  let posts = sortByCreatedAtDesc(snaps.docs.map(toPost));

  if (keyword) {
    const needle = keyword.trim().toLowerCase();
    posts = posts.filter(
      (p) => (p.title || "").toLowerCase().includes(needle) || (p.content || "").toLowerCase().includes(needle)
    );
  }

  return paginate(posts, page, pageSize);
}

function paginate(items, page, pageSize) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { posts: items.slice(start, start + pageSize), total };
}

// FR-014: עדכון פוסט
async function update(id, patch) {
  const db = getDb();
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({ ...patch, updatedAt: new Date() });
  return findById(id);
}

// הוספת תמונות לגלריית פוסט קיים - מצרפים למערך הקיים (לא מחליפים), עד מקסימום 6 תמונות בסה"כ לפוסט
async function addImages(id, newUrls) {
  const post = await findById(id);
  if (!post) return null;
  const combined = [...(post.imageUrls || []), ...newUrls].slice(0, 6);
  return update(id, { imageUrls: combined });
}

// FR-014: מחיקת פוסט (מחיקה פיזית - הבעלים בעצמו בחר להסיר את התוכן שלו)
async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

// BR-011: כשקבוצה נמחקת - כל הפוסטים שלה עוברים ארכוב לוגי, לא נמחקים פיזית
async function archiveByGroup(groupId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("groupId", "==", groupId).get();
  const batch = db.batch();
  snaps.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
  await batch.commit();
  return snaps.docs.map((d) => d.id);
}

// דרישה 26 (React+Video+Canvas): כל הפוסטים הפעילים עם קובץ וידאו מצורף (BR-008) - למרכיב React
// "הספרייה שלי" ב-/study-room (server/public/js/studyRoom.js). סינון videoUrl נעשה בזיכרון השרת,
// באותה גישה בדיוק כמו FR-012 (חיפוש פוסטים) - כי Firestore לא תומך בנוחות בסינון "לא ריק" משולב עם where נוסף.
async function listWithVideo({ limit = 20 } = {}) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("isArchived", "==", false).get();
  const withVideo = snaps.docs.map(toPost).filter((p) => !!p.videoUrl);
  return sortByCreatedAtDesc(withVideo).slice(0, limit);
}

// FR-025: כמות פוסטים פעילים לכל קבוצה - aggregation בזיכרון השרת, כי ל-Firestore אין $group מובנה
// (משמש את גרף העמודות "פעילות לפי קבוצה" ב-/study-room, ראו statsController.js)
async function countActiveByGroup() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("isArchived", "==", false).get();
  const counts = {};
  snaps.docs.forEach((doc) => {
    const groupId = doc.data().groupId;
    counts[groupId] = (counts[groupId] || 0) + 1;
  });
  return counts;
}

module.exports = {
  create,
  findById,
  listByGroup,
  listByGroupIds,
  search,
  update,
  addImages,
  remove,
  archiveByGroup,
  countActiveByGroup,
  listWithVideo,
};
