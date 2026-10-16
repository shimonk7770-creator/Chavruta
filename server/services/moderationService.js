// server/services/moderationService.js
// לוגיקת הדיווח והניהול, משותפת לאתר ולאפליקציית המובייל (כמו groupMembershipService):
//  - משתמש מדווח על פוסט/תגובה (עם צילום מצב של התוכן)
//  - אדמין סוגר דיווח: מסיר את התוכן או דוחה את הדיווח
//  - אדמין בודק תוכן ש-Gemini לא הספיק לבדוק (aiCheck="unchecked")
// המודלים נטענים רגילים; בבדיקות הם מוחלפים ב-require.cache.

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Group = require("../models/Group");
const Report = require("../models/Report");
const { validateReport } = require("../utils/moderationRules");

// טוען את התוכן המדווח ואת הקבוצה שלו. מחזיר null אם התוכן לא קיים (נמחק)
async function loadTarget(targetType, targetId) {
  if (targetType === "post") {
    const post = await Post.findById(targetId);
    if (!post || post.isArchived) return null;
    return { kind: "post", item: post, groupId: post.groupId, title: post.title, content: post.content };
  }
  const comment = await Comment.findById(targetId);
  if (!comment || comment.isArchived) return null;
  const post = await Post.findById(comment.postId);
  return { kind: "comment", item: comment, groupId: post ? post.groupId : "", title: post ? post.title : "", content: comment.content };
}

// מחזיר { status: "created" | "invalid" | "notFound" | "self" | "duplicate", message?, report? }
async function submitReport({ reporter, targetType, targetId, reason, details }) {
  const check = validateReport({ targetType, targetId, reason, details });
  if (!check.ok) return { status: "invalid", message: check.message };

  const target = await loadTarget(targetType, targetId);
  if (!target) return { status: "notFound", message: "התוכן לא נמצא (ייתכן שכבר נמחק)" };
  if (target.item.authorId === reporter.id) return { status: "self", message: "אי אפשר לדווח על תוכן שכתבת בעצמך" };
  if (await Report.hasOpenReportBy(reporter.id, targetType, targetId)) {
    return { status: "duplicate", message: "כבר דיווחת על התוכן הזה. הדיווח ממתין לטיפול מנהל" };
  }

  const group = target.groupId ? await Group.findById(target.groupId) : null;
  const report = await Report.create({
    targetType,
    targetId,
    groupId: target.groupId,
    groupName: group ? group.name : "",
    reason: check.value.reason,
    details: check.value.details,
    reporterId: reporter.id,
    reporterName: reporter.name,
    snapshot: {
      title: target.kind === "post" ? target.title : target.title ? `תגובה על: ${target.title}` : "תגובה",
      content: target.content,
      authorId: target.item.authorId || "",
      authorName: target.item.authorName || "",
    },
  });
  return { status: "created", report };
}

// מוחק תוכן (פוסט + תגובותיו, או תגובה בודדת). מחזיר true אם נמחק
async function removeTarget(targetType, targetId) {
  if (targetType === "post") {
    const post = await Post.findById(targetId);
    if (!post) return false;
    await Comment.archiveByPost(targetId); // כמו במחיקת קבוצה (BR-011): התגובות מאורכבות ולא נשארות "יתומות" גלויות
    await Post.remove(targetId);
    return true;
  }
  const comment = await Comment.findById(targetId);
  if (!comment) return false;
  await Comment.remove(targetId);
  return true;
}

// אדמין סוגר דיווח. action = "remove" (מסיר את התוכן וסוגר את כל הדיווחים עליו) | "dismiss" (דוחה את הדיווח)
// מחזיר { status: "ok" | "notFound" | "invalid", ... }
async function resolveReport(reportId, action, adminId) {
  const report = await Report.findById(reportId);
  if (!report) return { status: "notFound" };
  if (action === "dismiss") {
    await Report.resolve(reportId, "dismissed", adminId);
    return { status: "ok", removed: false };
  }
  if (action === "remove") {
    const removed = await removeTarget(report.targetType, report.targetId);
    await Report.resolveAllForTarget(report.targetType, report.targetId, "removed", adminId);
    return { status: "ok", removed };
  }
  return { status: "invalid" };
}

// בדיקת תוכן שלא נבדק ע"י AI. action = "approve" | "remove"
async function reviewUnchecked(targetType, targetId, action, adminId) {
  if (!["post", "comment"].includes(targetType)) return { status: "invalid" };
  if (action === "approve") {
    const model = targetType === "post" ? Post : Comment;
    await model.setAiCheck(targetId, "approved");
    return { status: "ok", removed: false };
  }
  if (action === "remove") {
    const removed = await removeTarget(targetType, targetId);
    await Report.resolveAllForTarget(targetType, targetId, "removed", adminId); // אם דווח בנוסף - הדיווח נסגר
    return { status: "ok", removed };
  }
  return { status: "invalid" };
}

module.exports = { submitReport, resolveReport, reviewUnchecked, removeTarget };
