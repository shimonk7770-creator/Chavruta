// server/scripts/makeAdmin.js
// סקריפט חד-פעמי להפיכת משתמש קיים למנהל מערכת (role="admin").
// אין דרך "להעניק לעצמך" הרשאת אדמין דרך האתר עצמו (מטעמי אבטחה - ראו server/views/permissions.ejs),
// לכן זו הדרך המיועדת: מריצים ידנית פעם אחת, ישירות מול ה-DB, עם גישת ה-Service Account המלאה.
//
// הרצה: npm run make-admin -- your@email.com
// (או ישירות: node server/scripts/makeAdmin.js your@email.com)

require("dotenv").config();
const { connectDB, getDb } = require("../config/db");

async function makeAdmin(email) {
  if (!email) {
    console.error("שימוש: npm run make-admin -- your@email.com");
    process.exit(1);
  }

  connectDB();
  const db = getDb();

  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) {
    console.error(`לא נמצא משתמש עם האימייל: ${email}`);
    process.exit(1);
  }

  const doc = snap.docs[0];
  const user = doc.data();
  await doc.ref.update({ role: "admin", updatedAt: new Date() });

  console.log(`בוצע בהצלחה: ${user.fullName} (${email}) הוגדר כעת כ-role="admin".`);
  console.log("צריך להתנתק ולהתחבר מחדש באתר כדי שהשינוי ייכנס לתוקף ב-session הנוכחי.");
  process.exit(0);
}

const emailArg = process.argv[2];
makeAdmin(emailArg).catch((error) => {
  console.error("שגיאה:", error);
  process.exit(1);
});
