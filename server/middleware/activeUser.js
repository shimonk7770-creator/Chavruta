// server/middleware/activeUser.js
// אכיפת השבתת משתמש (אדמין לחץ "השבת" או המשתמש מחק את החשבון): בלי זה, מי שכבר מחובר (session באתר או טוקן במובייל)
// היה ממשיך לפעול עד שהחיבור פג. הבדיקה נשמרת בזיכרון ל-30 שניות לכל משתמש, כדי לא לקרוא את Firestore בכל בקשה,
// ו-invalidate(userId) מבטל את המטמון מיד כשאדמין משנה סטטוס (ההשבתה נכנסת לתוקף מיידית).

const User = require("../models/User");

function createActiveUserGuard({ findUser = (id) => User.findById(id), ttlMs = 30 * 1000, now = () => Date.now() } = {}) {
  const cache = new Map(); // userId -> { active, at }

  async function isActive(userId) {
    const hit = cache.get(userId);
    if (hit && now() - hit.at < ttlMs) return hit.active;
    let active;
    try {
      const user = await findUser(userId);
      active = !!user && user.isActive !== false;
    } catch (error) {
      return true; // תקלה זמנית ב-DB לא מנתקת משתמשים (fail-open); הבדיקה הבאה תנסה שוב
    }
    cache.set(userId, { active, at: now() });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return active;
  }

  function invalidate(userId) {
    cache.delete(userId);
  }

  return { isActive, invalidate };
}

const guard = createActiveUserGuard();

// Express middleware לאתר: משתמש מושבת מנותק מיד
async function rejectInactiveSession(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) return next();
  if (await guard.isActive(userId)) return next();
  req.session.destroy(() => {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(401).json({ success: false, message: "החשבון הושבת או נמחק" });
    }
    res.redirect("/login");
  });
}

module.exports = { createActiveUserGuard, guard, rejectInactiveSession };
