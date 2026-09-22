// server/routes/notificationRoutes.js
// נתיבי הפעמון - כולם דורשים התחברות, מידע אישי לכל משתמש (כמו learningLogRoutes)

const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/api/notifications", isAuthenticated, notificationController.listMine);
router.post("/api/notifications/mark-read", isAuthenticated, notificationController.markRead);

module.exports = router;
