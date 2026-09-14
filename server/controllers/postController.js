// server/controllers/postController.js
// לוגיקה עסקית לניהול פוסטים (דברי תורה / שאלות / עדכונים)
// תואם ל-FR-012..FR-017 ב-SRS

const sanitizeHtml = require("sanitize-html");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Group = require("../models/Group");

// ניקוי HTML/סקריפטים מתוכן שהוזן על ידי משתמש (הגנה מפני XSS - NFR-006)
// לא מאפשרים תגיות כלל בתוכן פוסט - טקסט חופשי בלבד
function sanitizeContent(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

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

    const title = sanitizeContent(req.body.title);
    const content = sanitizeContent(req.body.content);
    const category = req.body.category;

    if (!title || !content) {
      req.session.flashError = "יש למלא כותרת ותוכן";
      return res.redirect(`/groups/${group._id}`);
    }

    await Post.create({
      title,
      content, // כבר עבר sanitize; גם ב-EJS משתמשים ב-<%= %> ולא <%- %> כהגנת-כפל
      category: category || "update",
      groupId: group._id,
      authorId: req.session.userId,
    });

    res.redirect(`/groups/${group._id}`);
  } catch (error) {
    next(error);
  }
}

// GET /posts/:id/edit - FR-014: טופס עריכת פוסט (הבעלים או מנהל הקבוצה בלבד - נבדק במידלוור canModifyPost)
function showEditPostForm(req, res) {
  res.render("posts/edit", { post: req.post });
}

// PUT /posts/:id - FR-014: עדכון פוסט
async function updatePost(req, res) {
  const post = req.post; // הגיע ממידלוור ההרשאה canModifyPost
  const title = sanitizeContent(req.body.title);
  const content = sanitizeContent(req.body.content);

  if (!title || !content) {
    return res.render("posts/edit", { post, error: "יש למלא כותרת ותוכן" });
  }

  post.title = title;
  post.content = content;
  if (req.body.category) post.category = req.body.category;
  await post.save();

  res.redirect(`/groups/${post.groupId}`);
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

// GET /feed - FR-017: פיד אישי - פוסטים מכל הקבוצות שהמשתמש חבר בהן + הפוסטים שלו עצמו
async function myFeed(req, res) {
  const Group = require("../models/Group");
  const myGroups = await Group.find({ members: req.session.userId }).select("_id");
  const groupIds = myGroups.map((g) => g._id);

  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;
  const filter = { isArchived: false, groupId: { $in: groupIds } };

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("authorId", "fullName")
      .populate("groupId", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Post.countDocuments(filter),
  ]);

  res.render("posts/feed", { posts, total, page, pageSize });
}

module.exports = { createPost, showEditPostForm, updatePost, deletePost, searchPosts, myFeed };
