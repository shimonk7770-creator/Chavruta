// server/controllers/moderationController.js
// אזור "ניהול" (אדמין בלבד) + כפתור "דווח" לכל משתמש מחובר:
//   GET  /admin/users                     - רשימת כל המשתמשים עם פעולות
//   POST /admin/users/:id/action          - suspend | activate | makeAdmin | makeMember (עם הגנות ב-utils/moderationRules.js)
//   GET  /admin/moderation                - דיווחים פתוחים + תוכן שה-AI לא בדק
//   POST /admin/reports/:id/:action       - remove | dismiss
//   POST /admin/unchecked/:type/:id/:action - approve | remove
//   POST /api/reports                     - דיווח על פוסט/תגובה (כל משתמש מחובר), מחזיר JSON
// ההרשאות נאכפות ב-routes/adminRoutes.js (isAdminUser) ובשירות; הממשק רק מסתיר כפתורים (SRS סעיף 12.1).

const sanitizeHtml = require("sanitize-html");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const moderation = require("../services/moderationService");
const { guard } = require("../middleware/activeUser");
const { REPORT_REASONS, canManageUser, userPatchFor } = require("../utils/moderationRules");

function clean(text) {
  return sanitizeHtml(String(text || ""), { allowedTags: [], allowedAttributes: {} }).trim();
}

// POST /api/reports  גוף: { targetType, targetId, reason, details }
async function reportContent(req, res) {
  try {
    const result = await moderation.submitReport({
      reporter: { id: req.session.userId, name: req.session.userName },
      targetType: req.body && req.body.targetType,
      targetId: req.body && req.body.targetId,
      reason: req.body && req.body.reason,
      details: clean(req.body && req.body.details),
    });
    const http = { created: 201, invalid: 400, notFound: 404, self: 400, duplicate: 409 }[result.status] || 500;
    if (result.status === "created") return res.status(201).json({ success: true, message: "תודה, הדיווח נשלח למנהל" });
    return res.status(http).json({ success: false, message: result.message || "אירעה שגיאה" });
  } catch (error) {
    console.error("שגיאה ביצירת דיווח:", error.message);
    return res.status(500).json({ success: false, message: "אירעה שגיאה בשרת" });
  }
}

// GET /admin/users
async function usersPage(req, res, next) {
  try {
    const users = await User.listAll();
    res.render("admin/users", { users, message: req.query.message || null, error: req.query.error || null });
  } catch (error) {
    next(error);
  }
}

// POST /admin/users/:id/action  גוף: { action }
async function userAction(req, res, next) {
  try {
    const action = req.body && req.body.action;
    const target = await User.findById(req.params.id);
    const actor = { id: req.session.userId, role: req.session.userRole };
    const activeAdminCount = await User.countActiveAdmins();
    const check = canManageUser({ actor, target, action, activeAdminCount });
    if (!check.ok) return res.redirect(`/admin/users?error=${encodeURIComponent(check.message)}`);

    await User.update(target.id, userPatchFor(action));
    guard.invalidate(target.id); // ההשבתה/ההפעלה נכנסת לתוקף מיד ולא רק אחרי פקיעת המטמון
    const labels = { suspend: "הושבת", activate: "הופעל מחדש", makeAdmin: "מונה למנהל מערכת", makeMember: "הוחזר לחבר קהילה" };
    res.redirect(`/admin/users?message=${encodeURIComponent(`${target.fullName} ${labels[action]}`)}`);
  } catch (error) {
    next(error);
  }
}

// GET /admin/moderation
async function moderationPage(req, res, next) {
  try {
    const [reports, uncheckedPosts, uncheckedComments] = await Promise.all([Report.listOpen(), Post.listUnchecked(), Comment.listUnchecked()]);
    res.render("admin/moderation", {
      reports,
      uncheckedPosts,
      uncheckedComments,
      reasons: REPORT_REASONS,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (error) {
    next(error);
  }
}

// POST /admin/reports/:id/:action
async function resolveReport(req, res, next) {
  try {
    const result = await moderation.resolveReport(req.params.id, req.params.action, req.session.userId);
    if (result.status !== "ok") return res.redirect(`/admin/moderation?error=${encodeURIComponent("הדיווח לא נמצא או הפעולה אינה תקינה")}`);
    const text = req.params.action === "remove" ? "התוכן הוסר והדיווחים עליו נסגרו" : "הדיווח נדחה";
    res.redirect(`/admin/moderation?message=${encodeURIComponent(text)}`);
  } catch (error) {
    next(error);
  }
}

// POST /admin/unchecked/:type/:id/:action
async function reviewUnchecked(req, res, next) {
  try {
    const result = await moderation.reviewUnchecked(req.params.type, req.params.id, req.params.action, req.session.userId);
    if (result.status !== "ok") return res.redirect(`/admin/moderation?error=${encodeURIComponent("הפעולה אינה תקינה")}`);
    res.redirect(`/admin/moderation?message=${encodeURIComponent(req.params.action === "approve" ? "התוכן אושר" : "התוכן הוסר")}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { reportContent, usersPage, userAction, moderationPage, resolveReport, reviewUnchecked };
