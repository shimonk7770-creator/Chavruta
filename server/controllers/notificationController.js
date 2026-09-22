// server/controllers/notificationController.js
// API להתראות הפעמון בתפריט העליון - טעינה ראשונית בכל עמוד (עדכונים חיים חדשים מגיעים ישירות דרך Socket.io)

const Notification = require("../models/Notification");

// GET /api/notifications - נקרא ע"י server/public/js/notifications.js בכל טעינת עמוד
async function listMine(req, res, next) {
  try {
    const notifications = await Notification.listForUser(req.session.userId, { limit: 15 });
    const unreadCount = await Notification.countUnread(req.session.userId);
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

// POST /api/notifications/mark-read - נקרא ברגע שפותחים את תפריט הפעמון (כמו Gmail/פייסבוק)
async function markRead(req, res, next) {
  try {
    await Notification.markAllRead(req.session.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { listMine, markRead };
