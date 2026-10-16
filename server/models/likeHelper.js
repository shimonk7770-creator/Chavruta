// server/models/likeHelper.js
// החלפת מצב לייק בצורה אטומית (טרנזקציה) על מסמך Firestore כלשהו - משותף לפוסטים ולתגובות.
// טרנזקציה מבטיחה שגם אם שני משתמשים לוחצים באותו רגע, אף לייק לא "נבלע".

const { getDb } = require("../config/db");
const { toggleInList } = require("../utils/likes");

// מחזיר { liked, likeCount, authorId } או null אם המסמך לא קיים
async function toggleLikeIn(collection, id, userId) {
  const db = getDb();
  const ref = db.collection(collection).doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data();
    const { likedBy, liked } = toggleInList(data.likedBy, userId);
    tx.update(ref, { likedBy });
    return { liked, likeCount: likedBy.length, authorId: data.authorId || "" };
  });
}

module.exports = { toggleLikeIn };
