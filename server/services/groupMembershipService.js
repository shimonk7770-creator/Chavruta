// server/services/groupMembershipService.js
// הצטרפות לקבוצה עם כלל בית חב״ד: משתמש יכול להיות חבר רק במדור אחד מכל סוג (בקשת המרצה:
// "לא ב-10 קבוצות של מסירת מוצרי קדושה"). השירות משותף לאתר, למנהל קבוצה שמוסיף חבר ולאפליקציית המובייל,
// כדי שהכלל ייאכף במקום אחד בשרת ולא רק בהסתרת כפתורים בממשק (SRS סעיף 12.1).

const Group = require("../models/Group");
const { findSectionConflict } = require("../utils/chabadSections");

// מחזיר { status: "joined" | "already" | "notFound" | "conflict", group, conflict }
async function joinGroupWithRules(groupId, userId) {
  const target = await Group.findById(groupId);
  if (!target) return { status: "notFound" };
  if ((target.members || []).includes(userId)) return { status: "already", group: target }; // BR-005: הצטרפות כפולה לא עושה כלום

  // בודקים התנגשות רק למדורים; לקבוצה רגילה (בלי sectionKey) אין הגבלה
  if (target.sectionKey) {
    const myGroups = await Group.findByMember(userId);
    const conflict = findSectionConflict(myGroups, target);
    if (conflict) return { status: "conflict", group: target, conflict };
  }

  const group = await Group.addMember(groupId, userId);
  return { status: "joined", group };
}

// הודעת שגיאה אחידה בעברית להתנגשות מדור
function conflictMessage(conflict) {
  return `אתה כבר חבר ב"${conflict.name}" מאותו סוג. אפשר להיות בקבוצה אחת בלבד מכל סוג - עזוב אותה קודם כדי להצטרף לכאן.`;
}

module.exports = { joinGroupWithRules, conflictMessage };
