// server/models/Group.js
// מודל הקבוצה (קהילה/שיעור/ועד) - שכבת גישה לנתונים ב-Firestore (collection: "groups")
// תואם ל-FR-006..FR-011 ולסכמת המסד בסעיף 9 ב-SRS
//
// הערה: עבר מ-Mongoose ל-Firestore. כדי להימנע מ-populate() (שלא קיים ב-Firestore),
// שם המנהל (managerName) נשמר ישירות על מסמך הקבוצה (denormalization) בזמן היצירה/העדכון.

const { getDb } = require("../config/db");

const COLLECTION = "groups";
const VALID_CATEGORIES = ["shiur", "vaad", "community"];
const VALID_LEVELS = ["beginners", "intermediate", "advanced", ""];

function toGroup(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// FR-006: יצירת קבוצה - היוצר הופך אוטומטית למנהל ולחבר הראשון בה
async function create(data) {
  const db = getDb();
  const now = new Date();
  const docRef = await db.collection(COLLECTION).add({
    name: data.name,
    description: data.description || "",
    category: VALID_CATEGORIES.includes(data.category) ? data.category : "community",
    topic: data.topic || "",
    dayOfWeek: data.dayOfWeek || "",
    time: data.time || "",
    level: VALID_LEVELS.includes(data.level) ? data.level : "",
    managerId: data.managerId,
    managerName: data.managerName || "",
    members: [data.managerId],
    createdAt: now,
    updatedAt: now,
  });
  return findById(docRef.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  return toGroup(snap);
}

// FR-010: רשימת כל הקבוצות
async function listAll() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snaps.docs.map(toGroup);
}

// FR-011: חיפוש קבוצות לפי topic + dayOfWeek + level (עד 3 פרמטרים בשילוב)
// Firestore תומך בסינון שוויון (where ==) על כמה שדות בקלות, אבל לא בחיפוש טקסט חלקי (regex) -
// לכן מסננים dayOfWeek+level ישירות ב-DB, ואת topic (התאמה חלקית) מסננים בזיכרון השרת אחרי השליפה.
async function search({ topic, dayOfWeek, level }) {
  const db = getDb();
  let query = db.collection(COLLECTION);

  if (dayOfWeek) query = query.where("dayOfWeek", "==", dayOfWeek);
  if (level) query = query.where("level", "==", level);

  const snaps = await query.get();
  let groups = snaps.docs.map(toGroup);

  if (topic) {
    const needle = topic.trim().toLowerCase();
    groups = groups.filter((g) => (g.topic || "").toLowerCase().includes(needle) || (g.name || "").toLowerCase().includes(needle));
  }

  groups.sort((a, b) => (b.createdAt?.toDate?.() ?? b.createdAt) - (a.createdAt?.toDate?.() ?? a.createdAt));
  return groups;
}

// FR-007: עדכון קבוצה
async function update(id, patch) {
  const db = getDb();
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({ ...patch, updatedAt: new Date() });
  return findById(id);
}

// FR-008: מחיקת קבוצה
async function remove(id) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).delete();
}

// FR-009: הצטרפות לקבוצה - BR-005: לא ניתן להצטרף פעמיים
async function addMember(groupId, userId) {
  const group = await findById(groupId);
  if (!group) return null;
  if (group.members.includes(userId)) return group; // כבר חבר - לא עושים כלום
  return update(groupId, { members: [...group.members, userId] });
}

// FR-009: עזיבת קבוצה
async function removeMember(groupId, userId) {
  const group = await findById(groupId);
  if (!group) return null;
  return update(groupId, { members: group.members.filter((m) => m !== userId) });
}

// FR-017: כל הקבוצות שמשתמש מסוים חבר בהן (משמש לבניית הפיד האישי)
async function findByMember(userId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("members", "array-contains", userId).get();
  return snaps.docs.map(toGroup);
}

module.exports = { create, findById, listAll, search, update, remove, addMember, removeMember, findByMember };
