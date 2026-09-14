// server/controllers/groupController.js
// לוגיקה עסקית לניהול קבוצות (שיעורים/ועדים/קהילות)
// תואם ל-FR-006..FR-011 ולהרשאות בסעיף 3 ב-SRS

const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

// GET /groups - רשימת/עיון בכל הקבוצות (FR-010), פתוח גם לאורח
async function listGroups(req, res) {
  const groups = await Group.find().populate("managerId", "fullName").sort({ createdAt: -1 });
  res.render("groups/index", { groups, query: {} });
}

// GET /groups/search - חיפוש קבוצות (FR-011): topic, dayOfWeek, time, level - עד 4 פרמטרים
async function searchGroups(req, res) {
  const { topic, dayOfWeek, time, level } = req.query;
  const filter = {};

  // בונים שאילתה דינמית רק מהפרמטרים שסופקו בפועל
  if (topic) filter.topic = { $regex: topic, $options: "i" }; // חיפוש לא תלוי-רישיות
  if (dayOfWeek) filter.dayOfWeek = dayOfWeek;
  if (time) filter.time = time;
  if (level) filter.level = level;

  const groups = await Group.find(filter).populate("managerId", "fullName").sort({ createdAt: -1 });
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
      members: [req.session.userId], // וגם לחבר הראשון בה
    });

    res.redirect(`/groups/${group._id}`);
  } catch (error) {
    console.error("שגיאה ביצירת קבוצה:", error);
    res.render("groups/new", { error: "אירעה שגיאה, נסה שוב" });
  }
}

// GET /groups/:id - צפייה בקבוצה + הפוסטים שלה
async function showGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id).populate("managerId", "fullName");
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה המבוקשת לא נמצאה או שנמחקה"));
    }

    const posts = await Post.find({ groupId: group._id, isArchived: false })
      .populate("authorId", "fullName")
      .sort({ createdAt: -1 });

    const isMember = group.members.some((m) => m.toString() === req.session.userId);
    const isManager = group.managerId._id.toString() === req.session.userId;

    res.render("groups/show", { group, posts, isMember, isManager });
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
  try {
    const { name, description, topic, dayOfWeek, time, level } = req.body;
    const group = req.group; // הגיע ממידלוור ההרשאה, כבר נבדק שזה המנהל הנכון

    group.name = name;
    group.description = description;
    group.topic = topic;
    group.dayOfWeek = dayOfWeek;
    group.time = time;
    group.level = level;
    await group.save();

    res.redirect(`/groups/${group._id}`);
  } catch (error) {
    console.error("שגיאה בעדכון קבוצה:", error);
    res.render("groups/edit", { group: req.group, error: "אירעה שגיאה, נסה שוב" });
  }
}

// DELETE /groups/:id - FR-008: מחיקת קבוצה + ארכוב לוגי של התוכן המשויך (BR-011)
async function deleteGroup(req, res) {
  const group = req.group;

  await Post.updateMany({ groupId: group._id }, { isArchived: true });
  const archivedPosts = await Post.find({ groupId: group._id }).select("_id");
  await Comment.updateMany(
    { postId: { $in: archivedPosts.map((p) => p._id) } },
    { isArchived: true }
  );

  await group.deleteOne();
  res.redirect("/groups");
}

// POST /groups/:id/join - FR-009: הצטרפות לקבוצה
async function joinGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }
    // BR-005: לא ניתן להצטרף פעמיים
    if (!group.members.some((m) => m.toString() === req.session.userId)) {
      group.members.push(req.session.userId);
      await group.save();
    }
    res.redirect(`/groups/${group._id}`);
  } catch (error) {
    next(error);
  }
}

// POST /groups/:id/leave - FR-009: עזיבת קבוצה
async function leaveGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }
    group.members = group.members.filter((m) => m.toString() !== req.session.userId);
    await group.save();
    res.redirect(`/groups/${group._id}`);
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
