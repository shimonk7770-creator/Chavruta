// server/routes/authRoutes.js
// נתיבי (Routes) האימות - מחברים בין כתובות ה-URL לבין הפונקציות ב-Controller

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/register", authController.showRegisterForm);
router.post("/register", authController.register);

router.get("/login", authController.showLoginForm);
router.post("/login", authController.login);

router.post("/logout", authController.logout);

// FR-004, FR-005 - דורש התחברות
router.get("/profile", isAuthenticated, authController.showProfileForm);
router.post("/profile", isAuthenticated, authController.updateProfile);
router.post("/profile/delete", isAuthenticated, authController.deleteAccount);

// נתיב API קטן שמשמש את jQuery/Ajax בדף ההרשמה
router.get("/api/check-username", authController.checkUsername);

module.exports = router;
