// server/controllers/commentController.js
// לוגיקה עסקית לתגובות - תואם ל-FR-015, FR-016 ב-SRS
// נתיב זה נקרא בעיקר דרך jQuery/Ajax (ראו server/public/js/comments.js) - ללא רענון עמוד
// שכבת הנתונים (Comment/Post model) עובדת מול Firestore

const sanitizeHtml = require("sanitize-html");
const Comment = require("../models/Comment");
const Post = require("../models/Post");

// ניקוי HTML/סקריפטים מתוכן תגובה (הגנה מפני XSS - NFR-006)
function sanitizeContent(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// POST /api/posts/:postId/comments - FR-015: הוספת תגובה (מוחזר JSON ל-Ajax)
async function addComment(req, res) {
  try {
    const content = sanitizeContent(req.body.content);
    if (!content) {
      return res.status(400).json({ success: false, message: "התגובה לא יכולה להיות ריקה" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "הפוסט לא נמצא" });
    }

    const comment = await Comment.create({
      postId: post.id,
      authorId: req.session.userId,
      authorName: req.session.userName,
      content,
    });

    res.json({ success: true, comment });
  } catch (error) {
    console.error("שגיאה בהוספת תגובה:", error);
    res.status(500).json({ success: false, message: "אירעה שגיאה בשרת" });
  }
}

// GET /api/posts/:postId/comments - שליפת תגובות לפוסט (לטעינה דרך Ajax)
async function listComments(req, res) {
  const comments = await Comment.listByPost(req.params.postId);
  res.json({ success: true, comments });
}

// DELETE /api/comments/:id - FR-016: מחיקת תגובה - הבעלים או מנהל הקבוצה (נבדק במידלוור)
async function deleteComment(req, res) {
  await Comment.remove(req.comment.id);
  res.json({ success: true });
}

module.exports = { addComment, listComments, deleteComment };
