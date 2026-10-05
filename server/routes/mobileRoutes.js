// server/routes/mobileRoutes.js
// נתיבי ה-API הייעודיים לאפליקציית המובייל (React Native/Expo) - כולם תחת /api/mobile,
// כדי שיהיה ברור וקל להבחין בינם לבין שאר ה-API הפנימי של האתר (jQuery/Ajax, לדוגמה /api/groups/:id/chat)
const express = require("express");
const router = express.Router();
const mobileController = require("../controllers/mobileController");
const { isMobileAuthenticated } = require("../middleware/mobileAuth");

router.post("/api/mobile/login", mobileController.login); // ללא הגנת isMobileAuthenticated - זו בדיוק נקודת הכניסה שיוצרת את הטוקן
router.post("/api/mobile/logout", isMobileAuthenticated, mobileController.logout);
router.get("/api/mobile/feed", isMobileAuthenticated, mobileController.feed); // "פיד פוסטים אישי"

module.exports = router;
