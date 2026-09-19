// server/controllers/chatController.js
// לוגיקה עסקית לצ'אט הקבוצתי בזמן אמת (FR-021..FR-024)
// שים לב: השליחה/broadcast בפועל של הודעות קורים ב-server/sockets/chatSocket.js (Socket.io) -
// הקונטרולר הזה אחראי רק על טעינת עמוד הצ'אט (SSR) וההיסטוריה, לא על שליחת הודעות עצמן.

const Group = require("../models/Group");
const Message = require("../models/Message");

// GET /groups/:id/chat - עמוד הצ'אט של קבוצה - חברי הקבוצה בלבד (לא כל משתמש מחובר)
async function showChat(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404);
      return next(new Error("הקבוצה לא נמצאה"));
    }

    const isMember = group.members.includes(req.session.userId);
    if (!isMember) {
      res.status(403);
      return next(new Error("הצ'אט פתוח רק לחברי הקבוצה - הצטרף לקבוצה כדי להשתתף"));
    }

    // FR-022: טוענים היסטוריה קיימת עם ה-render הראשוני (SSR) - כך הצ'אט לא מתחיל ריק
    // לפני שה-socket מתחבר, ולא תלוי לגמרי ב-JavaScript כדי להציג משהו
    const messages = await Message.listByGroup(group.id, { limit: 50 });

    res.render("groups/chat", {
      group,
      messages,
      userId: req.session.userId,
      userName: req.session.userName,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/groups/:id/chat/history - FR-024: fallback REST לחיבור מחדש -
// הלקוח (chat.js) קורא לזה עם הזמן של ההודעה האחרונה שהוא קיבל, כדי להשלים מה שפוספס בזמן הניתוק
async function chatHistorySince(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || !group.members.includes(req.session.userId)) {
      return res.status(403).json({ success: false, message: "אין הרשאה" });
    }

    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const messages = await Message.listSince(group.id, since);
    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}

module.exports = { showChat, chatHistorySince };
