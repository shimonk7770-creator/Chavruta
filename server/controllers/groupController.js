// server/controllers/groupController.js
// לוגיקה עסקית לניהול קבוצות (שיעורים/ועדים/קהילות)
// תואם ל-FR-006..FR-011 ולהרשאות בסעיף 3 ב-SRS
// שכבת הנתונים (Group/Post/Comment models) עובדת מול Firestore

const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

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
      name,
      description,
      category,
      topic,
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

    res.render("groups/show", { group, posts, isMember, isManager, userId: req.session.userId });
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

  const group = await Group.update(req.group.id, { name, description, topic, dayOfWeek, time, level, category });
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
};
