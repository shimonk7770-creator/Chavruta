// server/utils/moderationRules.js
// כללי הניהול והדיווח - לוגיקה טהורה (בלי מסד נתונים ובלי רשת), ולכן נבדקת אוטומטית ב-test/moderationRules.test.js.
//
// ארבעה תפקידים באתר (מוצגים למשתמש בעמוד /permissions ובתג ליד שמו):
//   אורח (לא מחובר) < חבר קהילה (member) < מנהל קבוצה/מדור (managerId של הקבוצה) < מנהל מערכת (admin)
// הכללים כאן נאכפים בשרת; הממשק רק מסתיר כפתורים.

const REPORT_REASONS = {
  spam: "ספאם או פרסומת",
  offensive: "תוכן פוגעני או לא ראוי",
  offtopic: "לא מתאים לנושא המדור",
  other: "אחר",
};
const REPORT_TARGETS = ["post", "comment"];
const MAX_DETAILS = 300;

// בדיקת דיווח נכנס. מחזיר { ok:true, value } או { ok:false, message }
function validateReport(input) {
  const targetType = input && input.targetType;
  const reason = input && input.reason;
  if (!REPORT_TARGETS.includes(targetType)) return { ok: false, message: "סוג התוכן המדווח אינו תקין" };
  if (!input.targetId || typeof input.targetId !== "string") return { ok: false, message: "חסר מזהה תוכן לדיווח" };
  if (!Object.prototype.hasOwnProperty.call(REPORT_REASONS, reason)) return { ok: false, message: "יש לבחור סיבה לדיווח" };
  const details = String(input.details || "").replace(/\s+/g, " ").trim().slice(0, MAX_DETAILS);
  return { ok: true, value: { targetType, targetId: input.targetId, reason, details } };
}

// תווית התפקיד כפי שמוצגת למשתמש. isGroupManager = האם הוא מנהל של הקבוצה שבה הוא נמצא כעת (אופציונלי)
function roleLabel(userRole, { isGroupManager = false } = {}) {
  if (!userRole) return "אורח";
  if (userRole === "admin") return "מנהל מערכת";
  if (isGroupManager || userRole === "manager") return "מנהל קבוצה";
  return "חבר קהילה";
}

const USER_ACTIONS = ["suspend", "activate", "makeAdmin", "makeMember"];

// האם מנהל מערכת (actor) רשאי לבצע פעולה על משתמש (target). activeAdminCount = כמה אדמינים פעילים יש כרגע.
// חוקי הגנה: לא פועלים על עצמך (אי אפשר להשבית או להוריד את עצמך), ולא מורידים/משביתים את האדמין הפעיל האחרון.
function canManageUser({ actor, target, action, activeAdminCount }) {
  if (!actor || actor.role !== "admin") return { ok: false, message: "רק מנהל מערכת יכול לנהל משתמשים" };
  if (!target) return { ok: false, message: "המשתמש לא נמצא" };
  if (!USER_ACTIONS.includes(action)) return { ok: false, message: "פעולה לא מוכרת" };
  if (actor.id === target.id) return { ok: false, message: "אי אפשר לבצע את הפעולה הזו על החשבון שלך" };
  const removesAdmin = target.role === "admin" && target.isActive !== false && (action === "suspend" || action === "makeMember");
  if (removesAdmin && activeAdminCount <= 1) return { ok: false, message: "לא ניתן להשבית או להוריד את מנהל המערכת האחרון" };
  return { ok: true };
}

// השינוי ב-Firestore שמתאים לפעולה
function userPatchFor(action) {
  switch (action) {
    case "suspend":
      return { isActive: false };
    case "activate":
      return { isActive: true };
    case "makeAdmin":
      return { role: "admin" };
    case "makeMember":
      return { role: "member" };
    default:
      return null;
  }
}

module.exports = { REPORT_REASONS, REPORT_TARGETS, USER_ACTIONS, validateReport, roleLabel, canManageUser, userPatchFor };
