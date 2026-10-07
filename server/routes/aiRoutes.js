// server/routes/aiRoutes.js
// נתיבי ה-AI. כולם דורשים התחברות (isAuthenticated מחזיר 401 JSON עבור כתובות /api),
// ובנוסף מוגבלים בקצב לכל משתמש - כל קריאה למעשה "עולה" ממכסת ה-API של Gemini ולכן חייבים להגן עליה מניצול.

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { isAuthenticated } = require("../middleware/auth");

// עד 8 בקשות AI בדקה לכל משתמש מחובר (המפתח הוא מזהה המשתמש, לא ה-IP - כמה משתמשים יכולים לשבת מאחורי אותו IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  keyGenerator: (req) => (req.session && req.session.userId) || "anonymous",
  message: { success: false, message: "שלחתם יותר מדי בקשות ל-AI. נסו שוב בעוד דקה." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/ai/posts/:id/summary", isAuthenticated, aiLimiter, aiController.summarizePost);
router.post("/api/ai/posts/:id/ask", isAuthenticated, aiLimiter, aiController.askAboutPost);
router.post("/api/ai/prayers/explain", isAuthenticated, aiLimiter, aiController.explainPrayer);
router.post("/api/ai/learning/summary", isAuthenticated, aiLimiter, aiController.summarizeLearning);
router.post("/api/ai/holidays/:id/ask", isAuthenticated, aiLimiter, aiController.askAboutHoliday);
router.post("/api/ai/compose", isAuthenticated, aiLimiter, aiController.composeHelp);
router.post("/api/ai/search", isAuthenticated, aiLimiter, aiController.askSite);
router.post("/api/ai/groups/:id/ask", isAuthenticated, aiLimiter, aiController.askAboutGroup);

module.exports = router;
