// server/middleware/auth.js
// Middleware להרשאות (RBAC) - בודק בצד השרת, לא רק בממשק! (ראו סעיף 12.1 ב-SRS)

// בודק שהמשתמש מחובר בכלל
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // לא מחובר - מפנים לדף התחברות (או שולחים 401 אם זו קריאת API)
  if (req.originalUrl.startsWith("/api")) {
    return res.status(401).json({ success: false, message: "יש להתחבר תחילה" });
  }
  return res.redirect("/login");
}

// בודק שלמשתמש יש אחת מהתפקידים המורשים (למשל מנהל קבוצה או אדמין)
function hasRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userRole) {
      return res.status(401).json({ success: false, message: "יש להתחבר תחילה" });
    }
    if (!allowedRoles.includes(req.session.userRole)) {
      // 403 = מחובר, אבל אין הרשאה מספקת
      return res.status(403).json({ success: false, message: "אין לך הרשאה לבצע פעולה זו" });
    }
    next();
  };
}

module.exports = { isAuthenticated, hasRole };
