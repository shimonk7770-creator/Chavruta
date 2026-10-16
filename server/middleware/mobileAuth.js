// server/middleware/mobileAuth.js
// מידלוור הרשאות ייעודי לאפליקציית המובייל - מקביל ל-isAuthenticated (server/middleware/auth.js),
// אבל בודק טוקן בכותרת Authorization: Bearer <token> במקום session/עוגייה - ראו הסבר מלא
// ב-server/models/MobileToken.js על הסיבה לכך שצריך מנגנון נפרד לגמרי מהאתר.
const MobileToken = require("../models/MobileToken");
const { guard } = require("./activeUser"); // השבתת משתמש ע"י אדמין חלה גם על הטוקן שלו

async function isMobileAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "נדרש טוקן התחברות - יש להתחבר דרך /api/mobile/login" });
  }

  const userId = await MobileToken.findUserIdByToken(token);
  if (!userId) {
    return res.status(401).json({ success: false, message: "טוקן לא תקף - יש להתחבר מחדש" });
  }

  if (!(await guard.isActive(userId))) {
    return res.status(401).json({ success: false, message: "החשבון הושבת או נמחק - יש להתחבר מחדש" });
  }

  req.mobileUserId = userId;
  req.mobileToken = token;
  next();
}

module.exports = { isMobileAuthenticated };
