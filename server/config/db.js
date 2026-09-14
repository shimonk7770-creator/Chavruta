// server/config/db.js
// אחראי על החיבור למסד הנתונים Firestore (דרך Firebase Admin SDK)
// לפי דרישה 16 במסמך הדרישות: אחסון ושליפת נתונים מתוך מסד נתונים מרכזי

const path = require("path");
const admin = require("firebase-admin");

let firestoreDb = null;

// מאתחל את החיבור ל-Firebase באמצעות קובץ מפתח שירות (Service Account)
// הקובץ מורד מ-Firebase Console (Project Settings -> Service Accounts) ואינו נשמר בגיט
function connectDB() {
  try {
    const keyPath = path.join(__dirname, "..", "..", "serviceAccountKey.json");
    const serviceAccount = require(keyPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firestoreDb = admin.firestore();
    console.log(`Firestore מחובר בהצלחה (פרויקט: ${serviceAccount.project_id})`);
  } catch (error) {
    // NFR-011: שגיאה בחיבור לא מפילה את השרת בצורה מכוערת - מדפיסים הודעה ברורה ויוצאים בצורה מבוקרת
    console.error("שגיאה בהתחברות ל-Firestore:", error.message);
    console.error(
      "ודא שקובץ serviceAccountKey.json קיים בשורש הפרויקט (הורד אותו מ-Firebase Console -> Project Settings -> Service Accounts -> Generate new private key)"
    );
    process.exit(1);
  }
}

// שליפת מופע ה-Firestore הפעיל (נקרא רק אחרי connectDB())
function getDb() {
  if (!firestoreDb) {
    throw new Error("Firestore לא אותחל - יש לקרוא ל-connectDB() לפני שימוש ב-getDb()");
  }
  return firestoreDb;
}

module.exports = { connectDB, getDb };
