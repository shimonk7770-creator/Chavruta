// server/config/db.js
// אחראי על החיבור למסד הנתונים MongoDB (דרך Mongoose)
// לפי דרישה 16 במסמך הדרישות: אחסון ושליפת נתונים מתוך MongoDB

const mongoose = require("mongoose");

async function connectDB() {
  try {
    // מתחברים למסד הנתונים לפי הכתובת שמוגדרת בקובץ .env
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB מחובר בהצלחה: ${conn.connection.host}`);
  } catch (error) {
    // NFR-011: שגיאה בחיבור לא מפילה את השרת בצורה מכוערת - מדפיסים ויוצאים בצורה מבוקרת
    console.error("שגיאה בהתחברות ל-MongoDB:", error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
