// server/controllers/mobileGroupsController.js
// API של אפליקציית המובייל לאזור "קבוצות": רשימת קבוצות, עמוד קבוצה, הצטרפות/עזיבה, פוסטים ותגובות.
// מחזיר JSON בלבד ומזהה את המשתמש לפי טוקן (middleware/mobileAuth.js -> req.mobileUserId) ולא לפי session.
// הכללים העסקיים זהים לאתר (BR-004: פרסום רק לחברי הקבוצה, FR-014/FR-016: מחיקה לבעלים / מנהל קבוצה / אדמין),
// והם נאכפים כאן בשרת - לא רק בהסתרת כפתורים באפליקציה (SRS סעיף 12.1).

const sanitizeHtml = require("sanitize-html");
const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { joinGroupWithRules, conflictMessage } = require("../services/groupMembershipService"); // כלל: מדור אחד מכל סוג
const { checkRelevance, rejectionMessage } = require("../services/relevanceService"); // בדיקת Gemini: התוכן מתאים למדור?
const { getSection, SECTION_KEYS } = require("../utils/chabadSections");
const moderation = require("../services/moderationService"); // דיווח על תוכן (משותף לאתר)
const likes = require("../services/likeService"); // ❤️ לייקים (משותף לאתר)
const { getIo } = require("../sockets/ioInstance");
const { canModifyContent } = require("../utils/permissionRules");
const { serializeGroup, serializeMember, serializePost, serializeComment } = require("../utils/mobileSerializers");

const MAX_TITLE = 150;
const MAX_POST_CONTENT = 5000;
const MAX_COMMENT = 1000;
const MAX_MEMBERS_SHOWN = 50; // רשימת חברים מוצגת עד 50 - מספיק למסך טלפון וחוסך שליפות
const MAX_POSTS_SHOWN = 50;
const VALID_POST_CATEGORIES = ["dvarTorah", "question", "update"];

// ניקוי HTML/סקריפטים מטקסט חופשי (הגנה מפני XSS - NFR-006), בדיוק כמו באתר
function sanitizeText(text) {
  return sanitizeHtml(String(text || ""), { allowedTags: [], allowedAttributes: {} }).trim();
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// שולף את המשתמש המחובר (שם + תפקיד) לפי הטוקן. חשבון שנמחק/הושבת (FR-005) נחשב לא מחובר.
async function loadActor(req) {
  const user = await User.findById(req.mobileUserId);
  if (!user || user.isActive === false) return null;
  return { id: user.id, fullName: user.fullName, role: user.role || "member" };
}

// GET /api/mobile/groups?q=טקסט&mine=1 - רשימת הקבוצות (FR-010). q מסנן לפי שם/נושא, mine=1 רק קבוצות שאני חבר בהן
async function listGroups(req, res, next) {
  try {
    if (Group.ensureSections) await Group.ensureSections(); // בית חב״ד: מוודא שהמדורים הקבועים קיימים (בטוח להרצה חוזרת)
    let groups = await Group.listAll();
    // מדורי בית חב״ד ראשונים בסדר הקבוע, ואחריהם שאר הקבוצות (sort יציב - הסדר המקורי נשמר בין קבוצות רגילות)
    const rank = (g) => (SECTION_KEYS.includes(g.sectionKey) ? SECTION_KEYS.indexOf(g.sectionKey) : SECTION_KEYS.length);
    groups = groups.slice().sort((a, b) => rank(a) - rank(b));
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q) {
      groups = groups.filter((g) => (g.name || "").toLowerCase().includes(q) || (g.topic || "").toLowerCase().includes(q));
    }
    if (req.query.mine === "1") {
      groups = groups.filter((g) => (g.members || []).includes(req.mobileUserId));
    }
    res.json({ success: true, groups: groups.map((g) => serializeGroup(req, g, req.mobileUserId)) });
  } catch (error) {
    next(error);
  }
}

// GET /api/mobile/groups/:id - עמוד קבוצה: פרטים + חברים + הפוסטים האחרונים
async function getGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return fail(res, 404, "הקבוצה לא נמצאה");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");

    const [memberDocs, posts] = await Promise.all([
      Promise.all((group.members || []).slice(0, MAX_MEMBERS_SHOWN).map((id) => User.findById(id))),
      Post.listByGroup(group.id),
    ]);

    res.json({
      success: true,
      group: serializeGroup(req, group, actor.id),
      members: memberDocs.filter(Boolean).map((u) => serializeMember(req, u, group)),
      posts: posts.slice(0, MAX_POSTS_SHOWN).map((p) => serializePost(req, p, actor, group.managerId)),
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/mobile/groups/:id/join - FR-009 (BR-005: הצטרפות כפולה לא עושה כלום)
async function joinGroup(req, res, next) {
  try {
    const result = await joinGroupWithRules(req.params.id, req.mobileUserId);
    if (result.status === "notFound") return fail(res, 404, "הקבוצה לא נמצאה");
    if (result.status === "conflict") return fail(res, 409, conflictMessage(result.conflict)); // 409 = התנגשות עם חברות קיימת
    res.json({ success: true, group: serializeGroup(req, result.group, req.mobileUserId) });
  } catch (error) {
    next(error);
  }
}

// POST /api/mobile/groups/:id/leave - FR-009. מנהל הקבוצה לא יכול לעזוב אותה (אחרת תישאר קבוצה בלי מנהל)
async function leaveGroup(req, res, next) {
  try {
    const existing = await Group.findById(req.params.id);
    if (!existing) return fail(res, 404, "הקבוצה לא נמצאה");
    if (existing.managerId === req.mobileUserId) {
      return fail(res, 400, "מנהל הקבוצה לא יכול לעזוב אותה");
    }
    const group = await Group.removeMember(req.params.id, req.mobileUserId);
    res.json({ success: true, group: serializeGroup(req, group, req.mobileUserId) });
  } catch (error) {
    next(error);
  }
}

// POST /api/mobile/groups/:id/posts  גוף: { title, content, category } - FR-013, BR-004 (חברי הקבוצה בלבד)
async function createPost(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return fail(res, 404, "הקבוצה לא נמצאה");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
    if (!(group.members || []).includes(actor.id)) {
      return fail(res, 403, "יש להצטרף לקבוצה לפני פרסום פוסטים בה");
    }

    const title = sanitizeText(req.body && req.body.title);
    const content = sanitizeText(req.body && req.body.content);
    if (!title || !content) return fail(res, 400, "יש למלא כותרת ותוכן");
    if (title.length > MAX_TITLE) return fail(res, 400, `הכותרת ארוכה מדי (עד ${MAX_TITLE} תווים)`);
    if (content.length > MAX_POST_CONTENT) return fail(res, 400, `התוכן ארוך מדי (עד ${MAX_POST_CONTENT} תווים)`);
    const category = VALID_POST_CATEGORIES.includes(req.body.category) ? req.body.category : "update";

    // בדיקת רלוונטיות כמו באתר: 422 + הסבר אם התוכן לא מתאים למדור; ה-AI לא זמין -> מפרסמים ומסמנים unchecked
    const section = getSection(group.sectionKey);
    const verdict = await checkRelevance({ section, kind: "post", title, content, userId: actor.id });
    if (verdict.status === "rejected") {
      return res.status(422).json({ success: false, code: "OFF_TOPIC", message: rejectionMessage(section, "post", verdict.reason) });
    }

    const post = await Post.create({
      title,
      content,
      category,
      groupId: group.id,
      groupName: group.name,
      authorId: actor.id,
      authorName: actor.fullName,
      aiCheck: verdict.status,
    });
    res.status(201).json({ success: true, post: serializePost(req, post, actor, group.managerId) });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/mobile/posts/:id - FR-014: בעל הפוסט / מנהל הקבוצה / אדמין
async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return fail(res, 404, "הפוסט לא נמצא");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
    const group = await Group.findById(post.groupId);
    const allowed = canModifyContent({ userId: actor.id, userRole: actor.role, ownerId: post.authorId, groupManagerId: group && group.managerId });
    if (!allowed) return fail(res, 403, "אין לך הרשאה למחוק פוסט זה");
    await Post.remove(post.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// GET /api/mobile/posts/:id/comments - FR-015: תגובות הפוסט, מהישנה לחדשה
async function listComments(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isArchived) return fail(res, 404, "הפוסט לא נמצא");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
    const group = await Group.findById(post.groupId);
    const comments = await Comment.listByPost(post.id);
    res.json({ success: true, comments: comments.map((c) => serializeComment(c, actor, group && group.managerId)) });
  } catch (error) {
    next(error);
  }
}

// POST /api/mobile/posts/:id/comments  גוף: { content } - FR-015 (+ התראת פעמון לבעל הפוסט, כמו באתר)
async function addComment(req, res, next) {
  try {
    const content = sanitizeText(req.body && req.body.content);
    if (!content) return fail(res, 400, "התגובה לא יכולה להיות ריקה");
    if (content.length > MAX_COMMENT) return fail(res, 400, `התגובה ארוכה מדי (עד ${MAX_COMMENT} תווים)`);

    const post = await Post.findById(req.params.id);
    if (!post || post.isArchived) return fail(res, 404, "הפוסט לא נמצא");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");

    const group = await Group.findById(post.groupId);
    const section = getSection(group && group.sectionKey);
    const verdict = await checkRelevance({ section, kind: "comment", title: "", content, context: post.title, userId: actor.id });
    if (verdict.status === "rejected") {
      return res.status(422).json({ success: false, code: "OFF_TOPIC", message: rejectionMessage(section, "comment", verdict.reason) });
    }

    const comment = await Comment.create({ postId: post.id, authorId: actor.id, authorName: actor.fullName, content, aiCheck: verdict.status });

    // התראה לבעל הפוסט (לא על תגובה של עצמי). כישלון בהתראה לא אמור להפיל את התגובה עצמה, ולכן ב-try/catch נפרד
    if (post.authorId && post.authorId !== actor.id) {
      try {
        const notif = await Notification.create({
          userId: post.authorId,
          type: "comment",
          text: `${actor.fullName} הגיב/ה על הפוסט שלך "${post.title}"`,
          link: `/groups/${post.groupId}`,
        });
        const io = getIo();
        if (io) io.to("user:" + post.authorId).emit("notification:new", notif);
      } catch (notifError) {
        console.error("שגיאה ביצירת התראה לתגובה (מובייל):", notifError.message);
      }
    }

    res.status(201).json({ success: true, comment: serializeComment(comment, actor, group && group.managerId) });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/mobile/comments/:id - FR-016: בעל התגובה / מנהל הקבוצה / אדמין
async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return fail(res, 404, "התגובה לא נמצאה");
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
    const post = await Post.findById(comment.postId);
    const group = post && (await Group.findById(post.groupId));
    const allowed = canModifyContent({ userId: actor.id, userRole: actor.role, ownerId: comment.authorId, groupManagerId: group && group.managerId });
    if (!allowed) return fail(res, 403, "אין לך הרשאה למחוק תגובה זו");
    await Comment.remove(comment.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// POST /api/mobile/posts/:id/like  ו-  /api/mobile/comments/:id/like - לייק/ביטול לייק. מחזיר { liked, likeCount }
function likeHandler(targetType) {
  return async (req, res, next) => {
    try {
      const actor = await loadActor(req);
      if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
      const result = await likes.toggleLike({ targetType, targetId: req.params.id, actor: { id: actor.id, name: actor.fullName } });
      if (result.status === "notFound") return fail(res, 404, "התוכן לא נמצא");
      if (result.status !== "ok") return fail(res, 400, "בקשה לא תקינה");
      res.json({ success: true, liked: result.liked, likeCount: result.likeCount });
    } catch (error) {
      next(error);
    }
  };
}
const likePost = likeHandler("post");
const likeComment = likeHandler("comment");

// POST /api/mobile/reports  גוף: { targetType: "post"|"comment", targetId, reason, details } - דיווח על תוכן לא ראוי למנהל
async function reportContent(req, res, next) {
  try {
    const actor = await loadActor(req);
    if (!actor) return fail(res, 401, "החשבון אינו פעיל - יש להתחבר מחדש");
    const body = req.body || {};
    const result = await moderation.submitReport({
      reporter: { id: actor.id, name: actor.fullName },
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: sanitizeText(body.details),
    });
    if (result.status === "created") return res.status(201).json({ success: true, message: "תודה, הדיווח נשלח למנהל" });
    const http = { invalid: 400, notFound: 404, self: 400, duplicate: 409 }[result.status] || 500;
    return fail(res, http, result.message || "אירעה שגיאה");
  } catch (error) {
    next(error);
  }
}

module.exports = { listGroups, getGroup, joinGroup, leaveGroup, createPost, deletePost, listComments, addComment, deleteComment, reportContent, likePost, likeComment };
