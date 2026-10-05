// server/controllers/messageController.js
// לוגיקה עסקית לצ'אט פרטי (1-על-1) בין משתמשים - עדכון בעקבות בקשת המשתמש ("וואטסאפ-ification").
// אותו רעיון בדיוק כמו chatController.js (הצ'אט הקבוצתי): הקונטרולר הזה אחראי רק על טעינת העמודים (SSR)
// וההיסטוריה - שליחת ההודעות בזמן אמת עצמה קורית ב-server/sockets/chatSocket.js (אירועי dm:*).

const User = require("../models/User");
const Message = require("../models/Message");

// GET /messages - תיבת הודעות: רשימת שיחות קיימות + חיפוש משתמש להתחלת שיחה חדשה
async function showInbox(req, res, next) {
  try {
    const myUserId = req.session.userId;

    const conversations = await Message.listConversationsForUser(myUserId);
    const conversationUsers = await Promise.all(
      conversations.map(async (c) => {
        const otherUser = await User.findById(c.otherUserId);
        return otherUser ? { ...c, otherUser: User.toPublicUser(otherUser) } : null;
      })
    );

    const q = (req.query.q || "").trim();
    let searchResults = [];
    if (q) {
      const matches = await User.search(q, { excludeUserId: myUserId });
      searchResults = matches.map(User.toPublicUser);
    }

    res.render("messages/inbox", {
      conversations: conversationUsers.filter(Boolean),
      searchResults,
      q,
    });
  } catch (error) {
    next(error);
  }
}

// GET /messages/:userId - עמוד הצ'אט הפרטי מול משתמש ספציפי
async function showDmChat(req, res, next) {
  try {
    const myUserId = req.session.userId;
    const otherUserId = req.params.userId;

    if (otherUserId === myUserId) {
      res.status(400);
      return next(new Error("לא ניתן לפתוח שיחה פרטית עם עצמך"));
    }

    const otherUserDoc = await User.findById(otherUserId);
    if (!otherUserDoc || !otherUserDoc.isActive) {
      res.status(404);
      return next(new Error("המשתמש המבוקש לא נמצא"));
    }
    const otherUser = User.toPublicUser(otherUserDoc);

    const dmRoomId = Message.dmRoomIdFor(myUserId, otherUserId);
    const messages = await Message.listByDm(dmRoomId, { limit: 50 });

    res.render("messages/chat", {
      otherUser,
      messages,
      userId: myUserId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/messages/:userId/history - FR-024 המקביל לצ'אט הפרטי: fallback REST לחיבור מחדש
async function dmHistorySince(req, res, next) {
  try {
    const myUserId = req.session.userId;
    const otherUserId = req.params.userId;
    if (otherUserId === myUserId) {
      return res.status(400).json({ success: false, message: "בקשה לא תקינה" });
    }
    const otherUserDoc = await User.findById(otherUserId);
    if (!otherUserDoc) {
      return res.status(404).json({ success: false, message: "המשתמש לא נמצא" });
    }

    const dmRoomId = Message.dmRoomIdFor(myUserId, otherUserId);
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const messages = await Message.listDmSince(dmRoomId, since);
    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}

module.exports = { showInbox, showDmChat, dmHistorySince };
