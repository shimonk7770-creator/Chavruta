// server/routes/messageRoutes.js
// נתיבי הצ'אט הפרטי (1-על-1) - עמודי ה-SSR + REST fallback להיסטוריה, אותו רעיון בדיוק כמו chatRoutes.js
// שליחת הודעות בזמן אמת עצמה קורית דרך Socket.io (אירועי dm:* ב-server/sockets/chatSocket.js), לא כאן

const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/messages", isAuthenticated, messageController.showInbox);
router.get("/messages/:userId", isAuthenticated, messageController.showDmChat);
router.get("/api/messages/:userId/history", isAuthenticated, messageController.dmHistorySince);

module.exports = router;
