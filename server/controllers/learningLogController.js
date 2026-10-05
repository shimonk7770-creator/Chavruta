// server/controllers/learningLogController.js
// לוגיקה עסקית למעקב לימוד אישי (חברותא/לימוד עצמי)
// תואם ל-FR-018, FR-019, FR-020 ו-BR-006 ב-SRS
// תוספת לפי משוב המשתמש (אוקטובר 2026): יעדי לימוד אישיים (צ'קליסט) + שיתוף רישום בודד עם חברי קבוצה

const sanitizeHtml = require("sanitize-html");
const LearningLog = require("../models/LearningLog");
const LearningGoal = require("../models/LearningGoal");
const Group = require("../models/Group");
const Post = require("../models/Post");
const { computeGoalProgress } = require("../utils/goalProgress");

function sanitizeText(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// טוען יחד את כל הנתונים הדרושים לעמוד הראשי - רישומים, קבוצות, יעדים + התקדמות מחושבת
async function loadPageData(userId) {
  const [logs, myGroups, goals] = await Promise.all([
    LearningLog.listByUser(userId),
    Group.findByMember(userId),
    LearningGoal.listByUser(userId),
  ]);
  return { logs, myGroups, goals, goalProgress: computeGoalProgress(goals) };
}

// GET /learning - מסך מעקב הלימוד האישי: טופס הוספה + רשימת רישומים + יעדים + נתוני heatmap
async function index(req, res) {
  const data = await loadPageData(req.session.userId);
  res.render("learning/index", { ...data, error: null, shareMessage: null });
}

// POST /learning - FR-018: רישום יחידת לימוד חדשה
async function create(req, res) {
  try {
    const { date, unit, groupId, notes } = req.body;
    const unitClean = sanitizeText(unit);

    if (!date || !unitClean) {
      const data = await loadPageData(req.session.userId);
      return res.render("learning/index", { ...data, error: "יש למלא תאריך ויחידת לימוד", shareMessage: null });
    }

    let groupName = "";
    if (groupId) {
      const group = await Group.findById(groupId);
      groupName = group ? group.name : "";
    }

    await LearningLog.create({
      userId: req.session.userId,
      date,
      unit: unitClean,
      groupId: groupId || null,
      groupName,
      notes: sanitizeText(notes),
    });

    res.redirect("/learning");
  } catch (error) {
    // BR-006 (תאריך עתידי) וכפילות מדויקת נזרקים כ-Error עם הודעה ידידותית מתוך המודל
    const data = await loadPageData(req.session.userId);
    res.render("learning/index", { ...data, error: error.message || "אירעה שגיאה, נסה שוב", shareMessage: null });
  }
}

// GET /learning/:id/edit - FR-019: טופס עריכה (הבעלים בלבד - נבדק במידלוור canModifyLearningLog)
function showEditForm(req, res) {
  res.render("learning/edit", { log: req.learningLog, error: null });
}

// PUT /learning/:id - FR-019: עדכון רישום לימוד
async function update(req, res) {
  try {
    const { date, unit, notes } = req.body;
    const unitClean = sanitizeText(unit);
    if (!date || !unitClean) {
      return res.render("learning/edit", { log: req.learningLog, error: "יש למלא תאריך ויחידת לימוד" });
    }
    await LearningLog.update(req.learningLog.id, { date, unit: unitClean, notes: sanitizeText(notes) });
    res.redirect("/learning");
  } catch (error) {
    res.render("learning/edit", { log: req.learningLog, error: error.message || "אירעה שגיאה, נסה שוב" });
  }
}

// DELETE /learning/:id - FR-019: מחיקת רישום לימוד
async function remove(req, res) {
  await LearningLog.remove(req.learningLog.id);
  res.redirect("/learning");
}

// POST /learning/:id/share - שיתוף רישום לימוד בודד עם חברי קבוצה (פרסום כפוסט בפיד הקבוצה)
// רק הבעלים של הרישום יכול לשתף אותו (req.learningLog נטען ע"י canModifyLearningLog - מידע אישי, גם לא אדמין)
// BR-004 (בהשראת postController): אי אפשר לשתף לקבוצה שהמשתמש אינו חבר בה
async function shareToGroup(req, res) {
  const log = req.learningLog;
  const { groupId } = req.body;

  const renderWithMessage = async (shareMessage) => {
    const data = await loadPageData(req.session.userId);
    res.render("learning/index", { ...data, error: null, shareMessage });
  };

  if (!groupId) {
    return renderWithMessage("יש לבחור קבוצה לשיתוף");
  }

  const group = await Group.findById(groupId);
  if (!group || !group.members.includes(req.session.userId)) {
    return renderWithMessage("אפשר לשתף רק לקבוצה שאתה חבר בה");
  }

  const dateStr = new Date(log.date.toDate ? log.date.toDate() : log.date).toLocaleDateString("he-IL");
  const contentParts = [`תאריך: ${dateStr}`];
  if (log.notes) contentParts.push(log.notes);

  await Post.create({
    title: `שיתוף מהמעקב האישי: ${log.unit}`,
    content: contentParts.join("\n"),
    category: "update",
    groupId: group.id,
    groupName: group.name,
    authorId: req.session.userId,
    authorName: req.session.userName,
  });

  await renderWithMessage(`הרישום שותף בהצלחה עם קבוצת "${group.name}"!`);
}

// POST /learning/goals - יצירת יעד לימוד אישי חדש (הצ'קליסט - הגדרת יעד עצמאית)
async function createGoal(req, res) {
  const text = sanitizeText(req.body.text);
  if (text) {
    await LearningGoal.create({ userId: req.session.userId, text });
  }
  res.redirect("/learning");
}

// PUT /learning/goals/:id - סימון/ביטול סימון יעד כ"בוצע" (וי בצ'קליסט)
async function toggleGoal(req, res) {
  const done = req.body.done === "true" || req.body.done === "on";
  await LearningGoal.toggleDone(req.learningGoal.id, done);
  res.redirect("/learning");
}

// DELETE /learning/goals/:id - מחיקת יעד לימוד
async function removeGoal(req, res) {
  await LearningGoal.remove(req.learningGoal.id);
  res.redirect("/learning");
}

// GET /api/learning/heatmap - FR-020: נתוני heatmap עבור ציור ב-Canvas (React)
// מחזיר מפה של תאריך -> מספר רישומים באותו יום, לשנה האחרונה
async function heatmapData(req, res) {
  const logs = await LearningLog.listByUser(req.session.userId);
  const counts = {};
  logs.forEach((log) => {
    const d = log.date?.toDate ? log.date.toDate() : new Date(log.date);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    counts[key] = (counts[key] || 0) + 1;
  });
  res.json({ success: true, counts });
}

module.exports = {
  index,
  create,
  showEditForm,
  update,
  remove,
  shareToGroup,
  createGoal,
  toggleGoal,
  removeGoal,
  heatmapData,
};
