// server/controllers/learningLogController.js
// לוגיקה עסקית למעקב לימוד אישי (חברותא/לימוד עצמי)
// תואם ל-FR-018, FR-019, FR-020 ו-BR-006 ב-SRS

const sanitizeHtml = require("sanitize-html");
const LearningLog = require("../models/LearningLog");
const Group = require("../models/Group");

function sanitizeText(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// GET /learning - מסך מעקב הלימוד האישי: טופס הוספה + רשימת רישומים + נתוני heatmap
async function index(req, res) {
  const [logs, myGroups] = await Promise.all([
    LearningLog.listByUser(req.session.userId),
    Group.findByMember(req.session.userId),
  ]);
  res.render("learning/index", { logs, myGroups, error: null });
}

// POST /learning - FR-018: רישום יחידת לימוד חדשה
async function create(req, res) {
  try {
    const { date, unit, groupId, notes } = req.body;
    const unitClean = sanitizeText(unit);

    if (!date || !unitClean) {
      const [logs, myGroups] = await Promise.all([
        LearningLog.listByUser(req.session.userId),
        Group.findByMember(req.session.userId),
      ]);
      return res.render("learning/index", { logs, myGroups, error: "יש למלא תאריך ויחידת לימוד" });
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
    const [logs, myGroups] = await Promise.all([
      LearningLog.listByUser(req.session.userId),
      Group.findByMember(req.session.userId),
    ]);
    res.render("learning/index", { logs, myGroups, error: error.message || "אירעה שגיאה, נסה שוב" });
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

module.exports = { index, create, showEditForm, update, remove, heatmapData };
