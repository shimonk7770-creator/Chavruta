// server/seed/seed.js
// סקריפט אתחול נתוני דמו - "npm run seed"
// ממלא את המערכת במידע ריאליסטי כדי שתדמה קהילה פעילה אמיתית (סעיף 23 בדרישות)
// ניתן להרצה חוזרת בלי ליצור כפילויות (NFR-012) - מוחק ומכניס מחדש בכל הרצה
// עובד מול Firestore (Firebase) ולא מול MongoDB

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, getDb } = require("../config/db");

// מוחק את כל המסמכים באוסף נתון - Firestore אין לו deleteMany() מובנה כמו Mongo,
// לכן שולפים את כל המזהים ומוחקים ב-batch (יעיל יותר ממחיקה אחת-אחת)
async function clearCollection(db, name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seed() {
  connectDB();
  const db = getDb();
  console.log("מחובר ל-Firestore - מתחיל זריעת נתונים...");

  // ניקוי נתונים קיימים כדי שההרצה תהיה נקייה וללא כפילויות (NFR-012)
  await Promise.all(
    ["users", "groups", "posts", "comments"].map((col) => clearCollection(db, col))
  );

  const passwordHash = await bcrypt.hash("Password1", 10); // סיסמה אחידה לכל משתמשי הדמו
  const now = new Date();

  const usersData = [
    { fullName: "יוסי כהן", username: "yossi_c", email: "yossi@example.com", role: "admin" },
    { fullName: "הרב דוד לוי", username: "rav_david", email: "david@example.com", role: "manager" },
    { fullName: "מירי אברהם", username: "miri_a", email: "miri@example.com", role: "manager" },
    { fullName: "שרה מזרחי", username: "sara_m", email: "sara@example.com", role: "member" },
    { fullName: "אבי פרץ", username: "avi_p", email: "avi@example.com", role: "member" },
    { fullName: "נעמה גולן", username: "naama_g", email: "naama@example.com", role: "member" },
    { fullName: "משה בן-דוד", username: "moshe_bd", email: "moshe@example.com", role: "member" },
    { fullName: "רחל שמעוני", username: "rachel_s", email: "rachel@example.com", role: "member" },
  ];

  const userIds = {};
  for (const u of usersData) {
    const ref = await db.collection("users").add({
      ...u,
      passwordHash,
      avatarUrl: "",
      bio: "",
      isActive: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    userIds[u.username] = ref.id;
  }
  const admin = userIds.yossi_c;
  const ravDavid = userIds.rav_david;
  const miri = userIds.miri_a;
  const sara = userIds.sara_m;
  const avi = userIds.avi_p;
  const naama = userIds.naama_g;
  const moshe = userIds.moshe_bd;
  const rachel = userIds.rachel_s;

  const groupsData = [
    {
      key: "dafYomi",
      name: "שיעור דף יומי",
      description: "שיעור יומי בדף היומי, פתוח לכולם",
      category: "shiur",
      topic: "דף יומי",
      dayOfWeek: "ראשון",
      time: "20:00",
      level: "intermediate",
      managerId: ravDavid,
      managerName: "הרב דוד לוי",
      members: [ravDavid, sara, avi, moshe],
    },
    {
      key: "parasha",
      name: "חבורת נשים - עיון בפרשה",
      description: "לימוד פרשת השבוע לנשים",
      category: "shiur",
      topic: "פרשת שבוע",
      dayOfWeek: "שלישי",
      time: "10:00",
      level: "beginners",
      managerId: miri,
      managerName: "מירי אברהם",
      members: [miri, sara, naama, rachel],
    },
    {
      key: "chesed",
      name: "ועד חסד קהילתי",
      description: "ריכוז פעילות חסד ותמיכה בקהילה",
      category: "vaad",
      topic: "חסד",
      dayOfWeek: "",
      time: "",
      level: "",
      managerId: admin,
      managerName: "יוסי כהן",
      members: [admin, naama, moshe],
    },
  ];

  const groupIds = {};
  for (const g of groupsData) {
    const { key, ...data } = g;
    const ref = await db.collection("groups").add({ ...data, createdAt: now, updatedAt: now });
    groupIds[key] = ref.id;
  }

  const postsData = [
    {
      title: "חידוש בסוגיה של השבוע",
      content: "רציתי לשתף חידוש קטן שעלה לי בלימוד היום...",
      category: "dvarTorah",
      groupId: groupIds.dafYomi,
      groupName: "שיעור דף יומי",
      authorId: ravDavid,
      authorName: "הרב דוד לוי",
    },
    {
      title: "שאלה על הדף",
      content: "מישהו יכול להסביר לי את הנקודה השנייה בסוגיה?",
      category: "question",
      groupId: groupIds.dafYomi,
      groupName: "שיעור דף יומי",
      authorId: sara,
      authorName: "שרה מזרחי",
    },
    {
      title: "עדכון: השיעור השבוע יתקיים באיחור קל",
      content: "השיעור יתחיל ב-20:30 במקום 20:00",
      category: "update",
      groupId: groupIds.dafYomi,
      groupName: "שיעור דף יומי",
      authorId: ravDavid,
      authorName: "הרב דוד לוי",
    },
    {
      title: "דבר תורה לפרשת השבוע",
      content: "הפעם נתמקד בקשר שבין הפרשה לחיי היום-יום שלנו...",
      category: "dvarTorah",
      groupId: groupIds.parasha,
      groupName: "חבורת נשים - עיון בפרשה",
      authorId: miri,
      authorName: "מירי אברהם",
    },
    {
      title: "בקשה לתרומת מזון למשפחה נזקקת",
      content: "יש משפחה בשכונה שזקוקה לעזרה השבוע, מי יכול לתרום?",
      category: "update",
      groupId: groupIds.chesed,
      groupName: "ועד חסד קהילתי",
      authorId: admin,
      authorName: "יוסי כהן",
    },
  ];

  const postIds = [];
  for (const p of postsData) {
    const ref = await db.collection("posts").add({ ...p, videoUrl: "", isArchived: false, createdAt: now, updatedAt: now });
    postIds.push(ref.id);
  }

  const commentsData = [
    { postId: postIds[0], authorId: sara, authorName: "שרה מזרחי", content: "חידוש יפה מאוד, תודה!" },
    { postId: postIds[0], authorId: avi, authorName: "אבי פרץ", content: "מעניין, לא חשבתי על זה כך" },
    { postId: postIds[1], authorId: moshe, authorName: "משה בן-דוד", content: "אני חושב שהתשובה היא..." },
    { postId: postIds[3], authorId: rachel, authorName: "רחל שמעוני", content: "תודה על השיתוף, מחכה לשיעור" },
    { postId: postIds[4], authorId: naama, authorName: "נעמה גולן", content: "אני יכולה לתרום, אשלח פרטים בהודעה" },
  ];
  for (const c of commentsData) {
    await db.collection("comments").add({ ...c, isArchived: false, createdAt: now });
  }

  console.log(
    `נזרעו בהצלחה: ${usersData.length} משתמשים, ${groupsData.length} קבוצות, ${postsData.length} פוסטים, ${commentsData.length} תגובות`
  );
  console.log("סיסמה לכל משתמשי הדמו: Password1");
  process.exit(0);
}

seed().catch((error) => {
  console.error("שגיאה בזריעת נתונים:", error);
  process.exit(1);
});
