// server/routes/mobileRoutes.js
// נתיבי ה-API הייעודיים לאפליקציית המובייל (React Native/Expo) - כולם תחת /api/mobile,
// כדי שיהיה ברור וקל להבחין בינם לבין שאר ה-API הפנימי של האתר (jQuery/Ajax, לדוגמה /api/groups/:id/chat)
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { uploadAudio } = require("../middleware/upload");
const transcribeController = require("../controllers/transcribeController");
const mobileController = require("../controllers/mobileController");
const mobileGroups = require("../controllers/mobileGroupsController");
const aiController = require("../controllers/aiController");
const { isMobileAuthenticated } = require("../middleware/mobileAuth");

// --- התחברות ופיד (שלב קודם) ---
router.post("/api/mobile/login", mobileController.login); // ללא הגנת isMobileAuthenticated - זו בדיוק נקודת הכניסה שיוצרת את הטוקן
router.post("/api/mobile/login/google", mobileController.googleLogin); // כמו login - נקודת כניסה ללא טוקן
router.post("/api/mobile/logout", isMobileAuthenticated, mobileController.logout);
router.get("/api/mobile/feed", isMobileAuthenticated, mobileController.feed); // "פיד פוסטים אישי"

// --- קבוצות, פוסטים ותגובות (שלב 1 של ההעברה למובייל) ---
router.get("/api/mobile/groups", isMobileAuthenticated, mobileGroups.listGroups);
router.get("/api/mobile/groups/:id", isMobileAuthenticated, mobileGroups.getGroup);
router.post("/api/mobile/groups/:id/join", isMobileAuthenticated, mobileGroups.joinGroup);
router.post("/api/mobile/groups/:id/leave", isMobileAuthenticated, mobileGroups.leaveGroup);
router.post("/api/mobile/posts/:id/like", isMobileAuthenticated, mobileGroups.likePost); // ❤️
router.post("/api/mobile/comments/:id/like", isMobileAuthenticated, mobileGroups.likeComment);
router.post("/api/mobile/reports", isMobileAuthenticated, mobileGroups.reportContent); // דיווח על פוסט/תגובה
router.post("/api/mobile/groups/:id/posts", isMobileAuthenticated, mobileGroups.createPost);
router.delete("/api/mobile/posts/:id", isMobileAuthenticated, mobileGroups.deletePost);
router.get("/api/mobile/posts/:id/comments", isMobileAuthenticated, mobileGroups.listComments);
router.post("/api/mobile/posts/:id/comments", isMobileAuthenticated, mobileGroups.addComment);
router.delete("/api/mobile/comments/:id", isMobileAuthenticated, mobileGroups.deleteComment);

// --- AI (Gemini) באפליקציה: אותם בקרים בדיוק כמו באתר (controllers/aiController.js), רק עם אימות טוקן ---
// ההגבלה היא 8 בקשות בדקה לכל משתמש, כמו באתר. המפתח של המשתמש הוא req.mobileUserId (נקבע ב-isMobileAuthenticated,
// ולכן המגביל חייב לבוא אחריו) ולא ה-IP, כי כמה משתמשים יכולים לשבת מאחורי אותו WiFi.
const mobileAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  keyGenerator: (req) => req.mobileUserId || "anonymous",
  message: { success: false, message: "שלחתם יותר מדי בקשות ל-AI. נסו שוב בעוד דקה." },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/api/mobile/ai/posts/:id/summary", isMobileAuthenticated, mobileAiLimiter, aiController.summarizePost);
router.post("/api/mobile/ai/posts/:id/ask", isMobileAuthenticated, mobileAiLimiter, aiController.askAboutPost);
router.post("/api/mobile/ai/groups/:id/ask", isMobileAuthenticated, mobileAiLimiter, aiController.askAboutGroup);
// תמלול קולי מהאפליקציה (הקלטה ← טקסט להודעה/פוסט/תגובה)
router.post(
  "/api/mobile/ai/transcribe",
  isMobileAuthenticated,
  mobileAiLimiter,
  transcribeController.receiveAudio(uploadAudio),
  transcribeController.transcribe
);

module.exports = router;
