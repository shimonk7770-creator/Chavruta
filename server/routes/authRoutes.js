// server/routes/authRoutes.js
// נתיבי (Routes) האימות - מחברים בין כתובות ה-URL לבין הפונקציות ב-Controller

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/register", authController.showRegisterForm);
router.post("/register", authController.register);

router.get("/login", authController.showLoginForm);
router.post("/login", authController.login);

router.post("/logout", authController.logout);

// נתיב API קטן שמשמש את jQuery/Ajax בדף ההרשמה
router.get("/api/check-username", authController.checkUsername);

module.exports = router;
