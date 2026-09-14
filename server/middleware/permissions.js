// server/middleware/permissions.js
// בדיקות הרשאה ברמת רשומה בודדת (קבוצה/פוסט/תגובה ספציפיים)
// תמיד בצד השרת - ראו סעיף 12.1 ב-SRS: אסור לסמוך רק על הסתרת כפתורים בממשק!

const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

// בודק שהמשתמש המחובר הוא המנהל של הקבוצה הספציפית הזו (לא סתם "מנהל" באופן כללי)
async function isGroupManagerOf(req, res, next) {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404);
    return next(new Error("הקבוצה לא נמצאה"));
  }
  const isManager = group.managerId.toString() === req.session.userId;
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
  const isOwner = post.authorId.toString() === req.session.userId;
  const isAdmin = req.session.userRole === "admin";

  if (!isOwner && !isAdmin) {
    // אם זה לא הבעלים - בודקים אם מדובר במנהל הקבוצה הספציפית שהפוסט שייך אליה
    const group = await Group.findById(post.groupId);
    const isManagerOfThisGroup = group && group.managerId.toString() === req.session.userId;
    if (!isManagerOfThisGroup) {
      res.status(403);
      return next(new Error("אין לך הרשאה לערוך/למחוק פוסט זה"));
    }
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
  const isOwner = comment.authorId.toString() === req.session.userId;
  const isAdmin = req.session.userRole === "admin";

  if (!isOwner && !isAdmin) {
    const post = await Post.findById(comment.postId);
    const group = post && (await Group.findById(post.groupId));
    const isManagerOfThisGroup = group && group.managerId.toString() === req.session.userId;
    if (!isManagerOfThisGroup) {
      return res.status(403).json({ success: false, message: "אין לך הרשאה למחוק תגובה זו" });
    }
  }
  req.comment = comment;
  next();
}

module.exports = { isGroupManagerOf, canModifyPost, canModifyComment };
