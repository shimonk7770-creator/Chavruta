// server/middleware/permissions.js
// בדיקות הרשאה ברמת רשומה בודדת (קבוצה/פוסט/תגובה ספציפיים)
// תמיד בצד השרת - ראו סעיף 12.1 ב-SRS: אסור לסמוך רק על הסתרת כפתורים בממשק!

const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const LearningLog = require("../models/LearningLog");
const { canModifyContent } = require("../utils/permissionRules"); // לוגיקה טהורה, נבדקת אוטומטית ב-server/test/permissionRules.test.js

// בודק שהמשתמש המחובר הוא המנהל של הקבוצה הספציפית הזו (לא סתם "מנהל" באופן כללי)
async function isGroupManagerOf(req, res, next) {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404);
    return next(new Error("הקבוצה לא נמצאה"));
  }
  const isManager = group.managerId === req.session.userId;
  const isAdmin = req.session.userRole === "admin";
  if (!isManager && !isAdmin) {
    res.status(403);
    return next(new Error("רק מנהל הקבוצה יכול לבצע פעולה זו"));
  }
  req.group = group; // שומרים לשימוש ב-controller, כדי לא לשלוף שוב מה-DB
  next();
}

// בודק שהמשתמש הוא בעל הפוסט, או מנהל הקבוצה שבה הפוסט פורסם, או אדמין
async function canModifyPost(req, res, next) {
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404);
    return next(new Error("הפוסט לא נמצא"));
  }
  const group = await Group.findById(post.groupId);
  const allowed = canModifyContent({
    userId: req.session.userId,
    userRole: req.session.userRole,
    ownerId: post.authorId,
    groupManagerId: group && group.managerId,
  });
  if (!allowed) {
    res.status(403);
    return next(new Error("אין לך הרשאה לערוך/למחוק פוסט זה"));
  }
  req.post = post;
  next();
}

// בודק שהמשתמש הוא בעל התגובה, או מנהל הקבוצה שבה התגובה נכתבה, או אדמין
async function canModifyComment(req, res, next) {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    return res.status(404).json({ success: false, message: "התגובה לא נמצאה" });
  }
  const post = await Post.findById(comment.postId);
  const group = post && (await Group.findById(post.groupId));
  const allowed = canModifyContent({
    userId: req.session.userId,
    userRole: req.session.userRole,
    ownerId: comment.authorId,
    groupManagerId: group && group.managerId,
  });
  if (!allowed) {
    return res.status(403).json({ success: false, message: "אין לך הרשאה למחוק תגובה זו" });
  }
  req.comment = comment;
  next();
}

// בודק שהמשתמש הוא הבעלים של רישום הלימוד - FR-019: הבעלים בלבד, גם לא אדמין (מידע אישי)
async function canModifyLearningLog(req, res, next) {
  const log = await LearningLog.findById(req.params.id);
  if (!log) {
    res.status(404);
    return next(new Error("הרישום לא נמצא"));
  }
  if (log.userId !== req.session.userId) {
    res.status(403);
    return next(new Error("אין לך הרשאה לערוך רישום לימוד של משתמש אחר"));
  }
  req.learningLog = log;
  next();
}

// בודק שהמשתמש הוא מנהל מערכת (role === "admin") - למשל לניהול תוכן "מעגל השנה" (BR-012)
function isAdminUser(req, res, next) {
  if (!req.session || req.session.userRole !== "admin") {
    res.status(403);
    return next(new Error("פעולה זו מותרת למנהל מערכת בלבד"));
  }
  next();
}

module.exports = { isGroupManagerOf, canModifyPost, canModifyComment, canModifyLearningLog, isAdminUser };
