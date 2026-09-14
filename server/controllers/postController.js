// server/controllers/postController.js
// לוגיקה עסקית לניהול פוסטים (דברי תורה / שאלות / עדכונים)
// תואם ל-FR-012..FR-017 ב-SRS

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Group = require("../models/Group");

// POST /groups/:groupId/posts - FR-013: יצירת פוסט
// BR-004: לא ניתן לפרסם בקבוצה שהמשתמש אינו חבר בה
async function createPost(req, res, next) {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }

    const isMember = group.members.some((m) => m.toString() === req.session.userId);
    if (!isMember) {
      res.status(403);
      return next(new Error("יש להצטרף לקבוצה לפני פרסום פוסטים בה"));
    }

    const { title, content, category } = req.body;
    if (!title || !content) {
      req.session.flashError = "יש למלא כותרת ותוכן";
      return res.redirect(`/groups/${group._id}`);
    }

    await Post.create({
      title,
      content, // הערה: ב-EJS משתמשים ב-<%= %> (לא <%- %>) כדי להימנע מ-XSS בעת תצוגה
      category: category || "update",
      groupId: group._id,
      authorId: req.session.userId,
    });

    res.redirect(`/groups/${group._id}`);
  } catch (error) {
    next(error);
  }
}

// DELETE /posts/:id - FR-014: מחיקת פוסט - הבעלים או מנהל הקבוצה (נבדק במידלוור)
async function deletePost(req, res) {
  const post = req.post; // הגיע ממידלוור ההרשאה
  await Comment.updateMany({ postId: post._id }, { isArchived: true });
  await post.deleteOne();
  res.redirect(`/groups/${post.groupId}`);
}

// GET /posts/search - FR-012: חיפוש פוסטים לפי category, groupId, טווח תאריכים, מילת מפתח
async function searchPosts(req, res) {
  const { category, groupId, dateFrom, dateTo, keyword } = req.query;
  const filter = { isArchived: false };

  if (category) filter.category = category;
  if (groupId) filter.groupId = groupId;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (keyword) {
    // חיפוש טקסט חופשי בכותרת/בתוכן
    filter.$text = { $search: keyword };
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("authorId", "fullName")
      .populate("groupId", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Post.countDocuments(filter),
  ]);

  res.render("posts/search", { posts, total, page, pageSize, query: req.query });
}

module.exports = { createPost, deletePost, searchPosts };
