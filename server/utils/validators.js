// server/utils/validators.js
// פונקציות ולידציה "טהורות" (Pure Functions) - לא תלויות ב-DB או ב-Express (req/res).
// הופרדו במיוחד מה-Controller כדי שאפשר לבדוק אותן אוטומטית עם node:test בלי להתחבר ל-Firestore
// (ראו server/test/validators.test.js). נעשה בהתאם לבקשת המשתמש ל"בדיקות אוטומטיות לפחות להרשמה".

// BR-002: סיסמה - לפחות 8 תווים, אות גדולה אחת לפחות, ספרה אחת לפחות
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

// BR-001: שם משתמש - 3 עד 20 תווים, אותיות/ספרות/קו תחתון בלבד
function isValidUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

// BR-003: כתובת אימייל בפורמט תקין (בדיקה בסיסית, מספיקה לצרכי הפרויקט)
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// BR-007: מגבלות אורך טקסט (נאכפות גם בשרת, לא רק ב-maxlength של הדפדפן). הערכים זהים לאלה שבמובייל
const TEXT_LIMITS = { postTitle: 150, postContent: 5000, comment: 1000 };

// מחזיר הודעת שגיאה בעברית אם הטקסט ארוך מדי, אחרת null
function lengthError(kind, text) {
  const max = TEXT_LIMITS[kind];
  if (!max || typeof text !== "string" || text.length <= max) return null;
  const label = kind === "postTitle" ? "הכותרת" : kind === "comment" ? "התגובה" : "התוכן";
  return `${label} ${kind === "postContent" ? "ארוך" : "ארוכה"} מדי (עד ${max} תווים)`;
}

module.exports = { isValidPassword, isValidUsername, isValidEmail, TEXT_LIMITS, lengthError };
