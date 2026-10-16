// server/routes/adminRoutes.js
// אזור "ניהול" - כל הראוטים של /admin דורשים role="admin" (isAdminUser); דיווח על תוכן פתוח לכל משתמש מחובר

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { isAdminUser } = require("../middleware/permissions");
const adminController = require("../controllers/adminController");
const moderationController = require("../controllers/moderationController");

router.get("/admin/dashboard", isAuthenticated, isAdminUser, adminController.dashboard);

// ניהול משתמשים והסרת תוכן (אדמין בלבד)
router.get("/admin/users", isAuthenticated, isAdminUser, moderationController.usersPage);
router.post("/admin/users/:id/action", isAuthenticated, isAdminUser, moderationController.userAction);
router.get("/admin/moderation", isAuthenticated, isAdminUser, moderationController.moderationPage);
router.post("/admin/reports/:id/:action", isAuthenticated, isAdminUser, moderationController.resolveReport);
router.post("/admin/unchecked/:type/:id/:action", isAuthenticated, isAdminUser, moderationController.reviewUnchecked);

// דיווח על פוסט/תגובה - כל משתמש מחובר, מוגבל ל-10 דיווחים בדקה כדי למנוע הצפה
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.session && req.session.userId) || "anonymous",
  message: { success: false, message: "יותר מדי דיווחים בזמן קצר. נסו שוב בעוד דקה." },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/api/reports", isAuthenticated, reportLimiter, moderationController.reportContent);

module.exports = router;
