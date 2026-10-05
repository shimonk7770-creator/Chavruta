// server/models/MobileToken.js
// טוקני גישה לאפליקציית המובייל (React Native/Expo) - collection נפרד ב-Firestore: "mobileTokens"
//
// למה בכלל צריך את זה: האתר (EJS) מזהה משתמש מחובר לפי session+עוגייה (server/server.js,
// express-session) - זה עובד מצוין בדפדפן, אבל לא מתאים לאפליקציית מובייל נפרדת (קוד Expo/React
// Native שרץ על הטלפון) - אין "דפדפן משותף" ששומר עוגייה בין בקשות לשרת. לכן, לאפליקציית המובייל
// בלבד, יש כאן מנגנון אימות נפרד ופשוט בהרבה מ-JWT: בכניסה מוצלחת (POST /api/mobile/login) נוצר
// טוקן אקראי וארוך ונשמר כאן יחד עם מזהה המשתמש; האפליקציה שומרת את הטוקן אצלה (בזיכרון/AsyncStorage)
// ושולחת אותו בכל בקשה הבאה בכותרת HTTP: Authorization: Bearer <token>.
//
// הערה לביקורת אבטחה (ראו DEFENSE-CHECKLIST.md): זהו טוקן ללא תפוגה אוטומטית (בניגוד ל-session
// באתר שפג אחרי 30 דקות חוסר פעילות) - מספיק ונכון לפרויקט לימודי בהיקף הזה, אך בפרויקט אמיתי
// היה ראוי להוסיף תוקף (expiry) ומנגנון חידוש (refresh token).
const { getDb } = require("../config/db");
const crypto = require("crypto");

const COLLECTION = "mobileTokens";

// יצירת טוקן חדש למשתמש (בכניסה מוצלחת) - מזהה המסמך ב-Firestore הוא הטוקן עצמו,
// כך שאימות טוקן בהמשך הוא שליפה ישירה לפי מפתח (מהירה, בלי query)
async function create(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  await db.collection(COLLECTION).doc(token).set({ userId, createdAt: new Date() });
  return token;
}

// אימות טוקן שמגיע מהאפליקציה - מחזיר את מזהה המשתמש אם הטוקן קיים, אחרת null
async function findUserIdByToken(token) {
  if (!token) return null;
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(token).get();
  if (!snap.exists) return null;
  return snap.data().userId;
}

// התנתקות (POST /api/mobile/logout) - מוחקים את הטוקן כדי שלא ניתן יהיה להשתמש בו שוב
async function remove(token) {
  if (!token) return;
  const db = getDb();
  await db.collection(COLLECTION).doc(token).delete();
}

module.exports = { create, findUserIdByToken, remove };
