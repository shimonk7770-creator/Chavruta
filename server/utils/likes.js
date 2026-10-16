// server/utils/likes.js
// לוגיקה טהורה ללייקים ("❤️ אהבתי") בפוסטים ובתגובות - נבדקת ב-test/likes.test.js.
// הלייקים נשמרים על מסמך הפוסט/התגובה עצמו בשדה likedBy (מערך מזהי משתמשים): קל, ואי אפשר לתת שני לייקים מאותו משתמש.

function likedByOf(item) {
  return item && Array.isArray(item.likedBy) ? item.likedBy : [];
}

// { likeCount, likedByMe } לתצוגה. רשימת המזהים עצמה לא נחשפת ללקוח (פרטיות)
function likeSummary(item, userId) {
  const list = likedByOf(item);
  return { likeCount: list.length, likedByMe: Boolean(userId) && list.includes(userId) };
}

// מחליף מצב לייק: אם כבר אהב - מסיר, אחרת מוסיף. מחזיר { likedBy, liked }
function toggleInList(list, userId) {
  const current = Array.isArray(list) ? list : [];
  if (current.includes(userId)) return { likedBy: current.filter((id) => id !== userId), liked: false };
  return { likedBy: [...current, userId], liked: true };
}

module.exports = { likedByOf, likeSummary, toggleInList };
