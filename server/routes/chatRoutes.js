// server/routes/chatRoutes.js
// נתיבי הצ'אט הקבוצתי - עמוד ה-SSR + REST fallback להיסטוריה (FR-021..FR-024)
// שליחת הודעות בזמן אמת עצמה לא עוברת דרך HTTP route - היא קורית דרך Socket.io (ראו server/sockets/chatSocket.js)

const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/groups/:id/chat", isAuthenticated, chatController.showChat);
router.get("/api/groups/:id/chat/history", isAuthenticated, chatController.chatHistorySince);

module.exports = router;
