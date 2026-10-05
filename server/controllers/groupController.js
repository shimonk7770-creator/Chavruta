// server/controllers/groupController.js
// לוגיקה עסקית לניהול קבוצות (שיעורים/ועדים/קהילות)
// תואם ל-FR-006..FR-011 ולהרשאות בסעיף 3 ב-SRS
// שכבת הנתונים (Group/Post/Comment models) עובדת מול Firestore

const sanitizeHtml = require("sanitize-html");
const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User"); // עדכון: עיצוב קבוצות בהשראת וואטסאפ - צריך פרטי משתמשים (שם+אווטאר) לכל חבר בקבוצה

// ניקוי HTML/סקריפטים משדות טקסט חופשי של קבוצה (הגנה מפני XSS - NFR-006) -
// עדכון מביקורת האבטחה (סעיף 12.5 ב-SRS): שם/תיאור/נושא הקבוצה לא עברו ניקוי כמו שאר התוכן
// (פוסטים/תגובות/ביוגרפיה/יומן לימוד) - גם אם ה-EJS כבר עושה escape אוטומטי ב-<%= %> (הגנה ראשונה
// שעבדה כל הזמן), מוסיפים כאן הגנת-כפל זהה לשאר המערכת, כדי לא להישען רק על שכבה אחת.
function sanitizeField(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// GET /groups - רשימת/עיון בכל הקבוצות (FR-010), פתוח גם לאורח
async function listGroups(req, res) {
  const groups = await Group.listAll();
  res.render("groups/index", { groups, query: {} });
}

// GET /groups/search - חיפוש קבוצות (FR-011): topic, dayOfWeek, level - 3 פרמטרים בשילוב
async function searchGroups(req, res) {
  const { topic, dayOfWeek, level } = req.query;
  const groups = await Group.search({ topic, dayOfWeek, level });
  res.render("groups/index", { groups, query: req.query });
}

// GET /groups/new - טופס יצירת קבוצה (מנהל/אדמין בלבד - נבדק ב-route)
function showNewGroupForm(req, res) {
  res.render("groups/new", { error: null });
}

// POST /groups - FR-006: יצירת קבוצה חדשה
async function createGroup(req, res) {
  try {
    const { name, description, category, topic, dayOfWeek, time, level } = req.body;

    if (!name || name.trim().length < 2) {
      return res.render("groups/new", { error: "שם הקבוצה חייב להכיל לפחות 2 תווים" });
    }

    const group = await Group.create({
      name: sanitizeField(name),
      description: sanitizeField(description),
      category,
      topic: sanitizeField(topic),
      dayOfWeek,
      time,
      level,
      managerId: req.session.userId, // היוצר הופך אוטומטית למנהל הקבוצה
      managerName: req.session.userName, // נשמר ישירות על המסמך - אין populate() ב-Firestore
    });

    res.redirect(`/groups/${group.id}`);
  } catch (error) {
    console.error("שגיאה ביצירת קבוצה:", error);
    res.render("groups/new", { error: "אירעה שגיאה, נסה שוב" });
  }
}

// GET /groups/:id - צפייה בקבוצה + הפוסטים שלה
async function showGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה המבוקשת לא נמצאה או שנמחקה"));
    }

    const posts = await Post.listByGroup(group.id);

    const isMember = group.members.includes(req.session.userId);
    const isManager = group.managerId === req.session.userId;

    // עדכון (עיצוב בהשראת וואטסאפ): Group.members הוא רק מערך מזהי משתמשים (אין populate ב-Firestore) -
    // שולפים כאן את הפרטים המלאים (שם+אווטאר) של כל חבר כדי להציג "רשימת חברים" עם תמונות, כמו בקבוצת וואטסאפ.
    // משתמש שנמחק בינתיים (soft-delete) פשוט לא יופיע ברשימה (filter(Boolean)).
    const memberUserDocs = await Promise.all(group.members.map((id) => User.findById(id)));
    const memberUsers = memberUserDocs.filter(Boolean).map(User.toPublicUser);

    res.render("groups/show", {
      group,
      posts,
      isMember,
      isManager,
      userId: req.session.userId,
      memberUsers,
      memberError: req.query.memberError || null,
    });
  } catch (error) {
    next(error);
  }
}

// GET /groups/:id/edit - טופס עריכה (מנהל הקבוצה בלבד - ראו middleware isGroupManagerOf)
async function showEditGroupForm(req, res) {
  res.render("groups/edit", { group: req.group, error: null });
}

// PUT /groups/:id - FR-007: עריכת קבוצה - מנהל הקבוצה שלו בלבד
async function updateGroup(req, res) {
  const { name, description, topic, dayOfWeek, time, level, category } = req.body;

  if (!name || name.trim().length < 2) {
    return res.render("groups/edit", { group: req.group, error: "שם הקבוצה חייב להכיל לפחות 2 תווים" });
  }

  const group = await Group.update(req.group.id, {
    name: sanitizeField(name),
    description: sanitizeField(description),
    topic: sanitizeField(topic),
    dayOfWeek,
    time,
    level,
    category,
  });
  res.redirect(`/groups/${group.id}`);
}

// DELETE /groups/:id - FR-008: מחיקת קבוצה + ארכוב מדורג (BR-011)
async function deleteGroup(req, res) {
  const groupId = req.group.id;

  // BR-011: ארכוב לוגי של כל הפוסטים והתגובות המשויכים - לא מחיקה פיזית,
  // כדי לשמר שלמות רפרנציאלית עבור משתמשים אחרים שתוכנם מוזכר
  const archivedPostIds = await Post.archiveByGroup(groupId);
  await Promise.all(archivedPostIds.map((postId) => Comment.archiveByPost(postId)));

  await Group.remove(groupId);
  res.redirect("/groups");
}

// POST /groups/:id/join - FR-009: הצטרפות לקבוצה (BR-005: לא ניתן להצטרף פעמיים)
async function joinGroup(req, res, next) {
  try {
    const group = await Group.addMember(req.params.id, req.session.userId);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }
    res.redirect(`/groups/${group.id}`);
  } catch (error) {
    next(error);
  }
}

// POST /groups/:id/leave - FR-009: עזיבת קבוצה
async function leaveGroup(req, res, next) {
  try {
    const group = await Group.removeMember(req.params.id, req.session.userId);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }
    res.redirect(`/groups/${group.id}`);
  } catch (error) {
    next(error);
  }
}

// POST /groups/:id/photo - עדכון: תמונת קבוצה (עיצוב בהשראת וואטסאפ) - מנהל הקבוצה בלבד (req.group מגיע מ-isGroupManagerOf)
// אותו דפוס בדיוק כמו authController.uploadAvatar - קובץ נשמר ע"י multer, רק הנתיב נשמר במסמך הקבוצה
async function uploadGroupPhoto(req, res) {
  if (!req.file) {
    return res.redirect(`/groups/${req.group.id}?memberError=${encodeURIComponent("יש לבחור קובץ תמונה")}`);
  }
  const groupPhotoUrl = `/uploads/${req.file.filename}`;
  await Group.update(req.group.id, { groupPhotoUrl });
  res.redirect(`/groups/${req.group.id}`);
}

// POST /groups/:id/members - עדכון: הוספת חבר ע"י מנהל הקבוצה (בנוסף להצטרפות עצמית הקיימת - FR-009) -
// לפי שם משתמש (username), כי זה מה שחברי הקבוצה מכירים ולא מזהה Firestore פנימי
async function addMemberByManager(req, res, next) {
  try {
    const username = (req.body.username || "").trim();
    if (!username) {
      return res.redirect(`/groups/${req.group.id}?memberError=${encodeURIComponent("יש להזין שם משתמש")}`);
    }
    const user = await User.findByUsername(username);
    if (!user || !user.isActive) {
      return res.redirect(`/groups/${req.group.id}?memberError=${encodeURIComponent("לא נמצא משתמש פעיל עם שם המשתמש הזה")}`);
    }
    if (req.group.members.includes(user.id)) {
      return res.redirect(`/groups/${req.group.id}?memberError=${encodeURIComponent("המשתמש כבר חבר בקבוצה")}`);
    }
    await Group.addMember(req.group.id, user.id);
    res.redirect(`/groups/${req.group.id}`);
  } catch (error) {
    next(error);
  }
}

// POST /groups/:id/members/:userId/remove - הסרת חבר ע"י מנהל הקבוצה - אסור להסיר את המנהל עצמו (ראו הגנה גם ב-view)
async function removeMemberByManager(req, res, next) {
  try {
    if (req.params.userId === req.group.managerId) {
      return res.redirect(`/groups/${req.group.id}?memberError=${encodeURIComponent("לא ניתן להסיר את מנהל הקבוצה")}`);
    }
    await Group.removeMember(req.group.id, req.params.userId);
    res.redirect(`/groups/${req.group.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listGroups,
  searchGroups,
  showNewGroupForm,
  createGroup,
  showGroup,
  showEditGroupForm,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  uploadGroupPhoto,
  addMemberByManager,
  removeMemberByManager,
};
