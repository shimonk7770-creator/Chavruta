// server/controllers/postController.js
// לוגיקה עסקית לניהול פוסטים (דברי תורה / שאלות / עדכונים)
// תואם ל-FR-012..FR-017 ב-SRS
// שכבת הנתונים (Post/Group model) עובדת מול Firestore

const sanitizeHtml = require("sanitize-html");
const Post = require("../models/Post");
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

    const isMember = group.members.includes(req.session.userId);
    if (!isMember) {
      res.status(403);
      return next(new Error("יש להצטרף לקבוצה לפני פרסום פוסטים בה"));
    }

    const title = sanitizeContent(req.body.title);
    const content = sanitizeContent(req.body.content);
    const category = req.body.category;

    if (!title || !content) {
      req.session.flashError = "יש למלא כותרת ותוכן";
      return res.redirect(`/groups/${group.id}`);
    }

    await Post.create({
      title,
      content, // כבר עבר sanitize; גם ב-EJS משתמשים ב-<%= %> ולא <%- %> כהגנת-כפל
      category: category || "update",
      groupId: group.id,
      groupName: group.name,
      authorId: req.session.userId,
      authorName: req.session.userName,
    });

    res.redirect(`/groups/${group.id}`);
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

  const patch = { title, content };
  if (req.body.category) patch.category = req.body.category;
  await Post.update(post.id, patch);

  res.redirect(`/groups/${post.groupId}`);
}

// POST /posts/:id/video - BR-008: העלאת קובץ וידאו לפוסט קיים (הבעלים או מנהל הקבוצה בלבד)
async function uploadVideo(req, res) {
  const post = req.post; // הגיע ממידלוור ההרשאה canModifyPost
  if (!req.file) {
    return res.render("posts/edit", { post, error: "יש לבחור קובץ וידאו בפורמט mp4 או webm" });
  }
  const videoUrl = `/uploads/${req.file.filename}`;
  const updated = await Post.update(post.id, { videoUrl });
  res.redirect(`/groups/${updated.groupId}`);
}

// POST /posts/:id/images - הוספת תמונות לגלריית פוסט קיים (הבעלים או מנהל הקבוצה בלבד)
// אותו דפוס בדיוק כמו uploadVideo למעלה, רק עם req.files (ריבוי קבצים) במקום req.file
async function uploadImages(req, res) {
  const post = req.post; // הגיע ממידלוור ההרשאה canModifyPost
  if (!req.files || !req.files.length) {
    return res.render("posts/edit", { post, error: "יש לבחור לפחות תמונה אחת" });
  }
  const newUrls = req.files.map((file) => `/uploads/${file.filename}`);
  const updated = await Post.addImages(post.id, newUrls);
  res.redirect(`/groups/${updated.groupId}`);
}

// DELETE /posts/:id - FR-014: מחיקת פוסט - הבעלים או מנהל הקבוצה (נבדק במידלוור)
async function deletePost(req, res) {
  const post = req.post; // הגיע ממידלוור ההרשאה
  await Post.remove(post.id);
  res.redirect(`/groups/${post.groupId}`);
}

// GET /posts/search - FR-012: חיפוש פוסטים לפי category, groupId, טווח תאריכים, מילת מפתח
async function searchPosts(req, res) {
  const { category, groupId, dateFrom, dateTo, keyword } = req.query;
  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;

  const { posts, total } = await Post.search({ category, groupId, dateFrom, dateTo, keyword }, { page, pageSize });

  res.render("posts/search", { posts, total, page, pageSize, query: req.query });
}

// GET /feed - FR-017: פיד אישי - פוסטים מכל הקבוצות שהמשתמש חבר בהן + הפוסטים שלו עצמו
async function myFeed(req, res) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;

  const myGroups = await Group.findByMember(req.session.userId);
  const groupIds = myGroups.map((g) => g.id);

  const { posts, total } = await Post.listByGroupIds(groupIds, { page, pageSize });

  res.render("posts/feed", { posts, total, page, pageSize });
}

// GET /api/videos/library - דרישה 26: רשימת קטעי הוידאו שצורפו לפוסטים באתר, עבור מרכיב ה-React
// "הספרייה שלי" ב-/study-room (server/public/js/studyRoom.js) - שם הם מנוגנים דרך נגן שנשלט כולו ע"י React,
// לא <video controls> רגיל דרך EJS כמו בעמוד הקבוצה - כדי לסגור בפועל את הפער "React+Video" בדרישות הקורס.
async function videoLibrary(req, res, next) {
  try {
    const posts = await Post.listWithVideo({ limit: 20 });
    const videos = posts.map((p) => ({
      id: p.id,
      title: p.title,
      videoUrl: p.videoUrl,
      groupName: p.groupName,
      authorName: p.authorName,
    }));
    res.json({ success: true, videos });
  } catch (error) {
    next(error);
  }
}

module.exports = { createPost, showEditPostForm, updatePost, uploadVideo, uploadImages, deletePost, searchPosts, myFeed, videoLibrary };
