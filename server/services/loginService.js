// server/services/loginService.js
// שירות אימות התחברות משותף - מכיל את לוגיקת הבדיקה שהייתה קודם כפולה בין התחברות באתר
// (authController.login, EJS) לבין ההתחברות באפליקציית המובייל (mobileController.login, JSON).
// הוצאנו אותה למקום אחד כדי שכללי האבטחה (BR-010 נעילת חשבון, מניעת enumeration) יישארו זהים
// בשני המסלולים ולא יתבדרו בטעות ביניהם (למשל מישהו "יתקן" רק אחד מהם בעתיד).

const bcrypt = require("bcryptjs");
const User = require("../models/User");

const MAX_FAILED_ATTEMPTS = 5; // BR-010
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 דקות

// בודק אימייל+סיסמה מול המסד ומחזיר תוצאה אחת מתוך שלוש:
//   { ok: true, user }
//   { ok: false, reason: "invalid" }               - אימייל/סיסמה שגויים (או משתמש לא קיים/לא פעיל)
//   { ok: false, reason: "locked", minutesLeft }    - BR-010: החשבון נעול זמנית עקב ניסיונות כושלים
async function verifyCredentials(email, password) {
  // activeOnly: משתמש שמחק את חשבונו (FR-005) לא יכול להתחבר יותר - לא באתר ולא במובייל
  const user = await User.findByEmail(email, { activeOnly: true });
  if (!user) {
    return { ok: false, reason: "invalid" };
  }

  if (User.isLocked(user)) {
    const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
    return { ok: false, reason: "locked", minutesLeft };
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    // עדכון מונה ניסיונות כושלים - זהה לחלוטין בין אתר ומובייל, כדי שתוקף ש"מנסה בכוח" (brute-force)
    // דרך ה-API של המובייל לא יוכל לעקוף את הגנת הנעילה שקיימת בטופס ההתחברות הרגיל
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const patch = { failedLoginAttempts };
    if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      patch.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      patch.failedLoginAttempts = 0;
    }
    await User.update(user.id, patch);
    return { ok: false, reason: "invalid" };
  }

  // התחברות מוצלחת - איפוס מונה הכשלונות
  await User.update(user.id, { failedLoginAttempts: 0, lockUntil: null });
  return { ok: true, user };
}

module.exports = { verifyCredentials };
