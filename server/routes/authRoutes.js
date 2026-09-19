// server/routes/authRoutes.js
// נתיבי (Routes) האימות - מחברים בין כתובות ה-URL לבין הפונקציות ב-Controller

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const { isAuthenticated } = require("../middleware/auth");

// הגבלת קצב בקשות (NFR - הגנה בסיסית מפני ניחוש סיסמאות/הרשמות אוטומטיות בכמות גדולה - Brute Force).
// מוגבל רק על הפעולות הרגישות (login/register) ולא על כל האתר, כדי לא לפגוע בגלישה רגילה.
// שימו לב: זו הגנה *נוספת* על BR-010 (נעילת חשבון אחרי 5 כשלונות) - שכבת הגנה כללית יותר, ברמת ה-IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // חלון של 15 דקות
  max: 20, // עד 20 ניסיונות login/register לכל IP בחלון הזמן
  message: { success: false, message: "יותר מדי ניסיונות מכתובת זו - נסה שוב בעוד כמה דקות" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/register", authController.showRegisterForm);
router.post("/register", authLimiter, authController.register);

router.get("/login", authController.showLoginForm);
router.post("/login", authLimiter, authController.login);

router.post("/logout", authController.logout);

// FR-004, FR-005 - דורש התחברות
router.get("/profile", isAuthenticated, authController.showProfileForm);
router.post("/profile", isAuthenticated, authController.updateProfile);
router.post("/profile/delete", isAuthenticated, authController.deleteAccount);

// נתיב API קטן שמשמש את jQuery/Ajax בדף ההרשמה
router.get("/api/check-username", authController.checkUsername);

module.exports = router;
