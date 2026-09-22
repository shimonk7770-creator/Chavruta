// server/utils/permissionRules.js
// הלוגיקה הטהורה שקובעת "מי מורשה לשנות תוכן מסוים" - מופרדת מהשליפה בפועל מ-Firestore
// (שנעשית ב-server/middleware/permissions.js) כדי שאפשר לבדוק אותה אוטומטית עם node:test
// בלי להתחבר למסד נתונים אמיתי (ראו server/test/permissionRules.test.js).
//
// הכלל (תואם ל-SRS סעיף 3 וסעיף BR-013): מותר לשנות תוכן אם המשתמש הוא הבעלים שלו,
// או מנהל מערכת (admin - מותר לו בכל תוכן, למטרות מודרציה), או מנהל הקבוצה שבה התוכן פורסם.

function canModifyContent({ userId, userRole, ownerId, groupManagerId }) {
  if (!userId) return false;
  if (userRole === "admin") return true;
  if (userId === ownerId) return true;
  if (groupManagerId && userId === groupManagerId) return true;
  return false;
}

module.exports = { canModifyContent };
