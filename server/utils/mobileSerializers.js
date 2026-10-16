// server/utils/mobileSerializers.js
// פונקציות "טהורות" שהופכות מסמכי Firestore (קבוצה/פוסט/תגובה) ל-JSON נקי ובטוח לאפליקציית המובייל.
// הן מופרדות מהקונטרולר כדי שאפשר לבדוק אותן אוטומטית (server/test/mobileSerializers.test.js) בלי מסד נתונים.
//
// שלושה עקרונות:
//  1. כתובות תמונה/וידאו הופכות לכתובות מלאות (http://host/uploads/..) - רכיב ה-Image של React Native לא יודע לפתור כתובת יחסית.
//  2. תאריכים מוחזרים כמחרוזת ISO. אובייקט Timestamp של Firestore היה מגיע לטלפון כ-{_seconds,_nanoseconds}, שקשה לעבוד איתו.
//  3. מחזירים רק שדות שהאפליקציה צריכה (בלי passwordHash, aiSummaryHash וכו').

const { canModifyContent } = require("./permissionRules");
const { getSection } = require("./chabadSections");
const { likeSummary } = require("./likes");

// הופך כתובת יחסית כמו "/uploads/x.jpg" לכתובת מלאה לפי ה-host שהטלפון עצמו פנה אליו.
// כתובת שכבר מלאה (http/https) נשארת כמו שהיא.
function toAbsoluteUrl(req, url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${req.protocol}://${req.get("host")}${url}`;
}

// ממיר Timestamp של Firestore / Date / מחרוזת למחרוזת ISO. ערך חסר או לא תקין -> מחרוזת ריקה
function toIso(value) {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

// קבוצה לרשימה/לפרטים. userId = המשתמש המחובר (כדי לסמן isMember/isManager)
function serializeGroup(req, group, userId) {
  const members = Array.isArray(group.members) ? group.members : [];
  return {
    id: group.id,
    name: group.name || "",
    description: group.description || "",
    category: group.category || "community",
    topic: group.topic || "",
    dayOfWeek: group.dayOfWeek || "",
    time: group.time || "",
    level: group.level || "",
    managerId: group.managerId || "",
    managerName: group.managerName || "",
    groupPhotoUrl: toAbsoluteUrl(req, group.groupPhotoUrl),
    sectionKey: group.sectionKey || "", // מדור בית חב״ד (ריק = קבוצה רגילה)
    emoji: (getSection(group.sectionKey) || {}).emoji || "",
    memberCount: members.length,
    isMember: members.includes(userId),
    isManager: group.managerId === userId,
  };
}

// חבר קבוצה - רק פרטים ציבוריים (שם, שם משתמש, תמונה)
function serializeMember(req, user, group) {
  return {
    id: user.id,
    fullName: user.fullName || "",
    username: user.username || "",
    avatarUrl: toAbsoluteUrl(req, user.avatarUrl),
    isManager: user.id === group.managerId,
  };
}

// פוסט. actor = { id, role } של המשתמש המחובר; canDelete נקבע לפי אותו כלל בדיוק כמו באתר (בעלים / מנהל קבוצה / אדמין)
function serializePost(req, post, actor, groupManagerId) {
  return {
    id: post.id,
    groupId: post.groupId || "",
    groupName: post.groupName || "",
    title: post.title || "",
    content: post.content || "",
    category: post.category || "update",
    authorId: post.authorId || "",
    authorName: post.authorName || "",
    imageUrls: (post.imageUrls || []).map((u) => toAbsoluteUrl(req, u)),
    videoUrl: toAbsoluteUrl(req, post.videoUrl),
    aiSummary: post.aiSummary || "",
    ...likeSummary(post, actor.id), // likeCount + likedByMe (בלי חשיפת רשימת המזהים)
    createdAt: toIso(post.createdAt),
    canDelete: canModifyContent({ userId: actor.id, userRole: actor.role, ownerId: post.authorId, groupManagerId }),
  };
}

// תגובה (אותו כלל הרשאת מחיקה כמו בפוסט)
function serializeComment(comment, actor, groupManagerId) {
  return {
    id: comment.id,
    postId: comment.postId || "",
    authorId: comment.authorId || "",
    authorName: comment.authorName || "",
    content: comment.content || "",
    ...likeSummary(comment, actor.id),
    createdAt: toIso(comment.createdAt),
    canDelete: canModifyContent({ userId: actor.id, userRole: actor.role, ownerId: comment.authorId, groupManagerId }),
  };
}

module.exports = { toAbsoluteUrl, toIso, serializeGroup, serializeMember, serializePost, serializeComment };
