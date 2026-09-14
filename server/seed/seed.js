// server/seed/seed.js
// סקריפט אתחול נתוני דמו - "npm run seed"
// ממלא את המערכת במידע ריאליסטי כדי שתדמה קהילה פעילה אמיתית (סעיף 23 בדרישות)
// ניתן להרצה חוזרת בלי ליצור כפילויות (NFR-012) - מוחק ומכניס מחדש בכל הרצה

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Group = require("../models/Group");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("מחובר למסד הנתונים - מתחיל זריעת נתונים...");

  // ניקוי נתונים קיימים כדי שההרצה תהיה נקייה וללא כפילויות
  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("Password1", 10); // סיסמה אחידה לכל משתמשי הדמו

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

  const users = await User.insertMany(
    usersData.map((u) => ({ ...u, passwordHash }))
  );
  const [admin, ravDavid, miri, sara, avi, naama, moshe, rachel] = users;

  const groupsData = [
    {
      name: "שיעור דף יומי",
      description: "שיעור יומי בדף היומי, פתוח לכולם",
      category: "shiur",
      topic: "דף יומי",
      dayOfWeek: "ראשון",
      time: "20:00",
      level: "intermediate",
      managerId: ravDavid._id,
      members: [ravDavid._id, sara._id, avi._id, moshe._id],
    },
    {
      name: "חבורת נשים - עיון בפרשה",
      description: "לימוד פרשת השבוע לנשים",
      category: "shiur",
      topic: "פרשת שבוע",
      dayOfWeek: "שלישי",
      time: "10:00",
      level: "beginners",
      managerId: miri._id,
      members: [miri._id, sara._id, naama._id, rachel._id],
    },
    {
      name: "ועד חסד קהילתי",
      description: "ריכוז פעילות חסד ותמיכה בקהילה",
      category: "vaad",
      topic: "חסד",
      dayOfWeek: "",
      time: "",
      level: "",
      managerId: admin._id,
      members: [admin._id, naama._id, moshe._id],
    },
  ];

  const groups = await Group.insertMany(groupsData);
  const [dafYomiGroup, parashaGroup, chesedGroup] = groups;

  const postsData = [
    {
      title: "חידוש בסוגיה של השבוע",
      content: "רציתי לשתף חידוש קטן שעלה לי בלימוד היום...",
      category: "dvarTorah",
      groupId: dafYomiGroup._id,
      authorId: ravDavid._id,
    },
    {
      title: "שאלה על הדף",
      content: "מישהו יכול להסביר לי את הנקודה השנייה בסוגיה?",
      category: "question",
      groupId: dafYomiGroup._id,
      authorId: sara._id,
    },
    {
      title: "עדכון: השיעור השבוע יתקיים באיחור קל",
      content: "השיעור יתחיל ב-20:30 במקום 20:00",
      category: "update",
      groupId: dafYomiGroup._id,
      authorId: ravDavid._id,
    },
    {
      title: "דבר תורה לפרשת השבוע",
      content: "הפעם נתמקד בקשר שבין הפרשה לחיי היום-יום שלנו...",
      category: "dvarTorah",
      groupId: parashaGroup._id,
      authorId: miri._id,
    },
    {
      title: "בקשה לתרומת מזון למשפחה נזקקת",
      content: "יש משפחה בשכונה שזקוקה לעזרה השבוע, מי יכול לתרום?",
      category: "update",
      groupId: chesedGroup._id,
      authorId: admin._id,
    },
  ];

  const posts = await Post.insertMany(postsData);

  const commentsData = [
    { postId: posts[0]._id, authorId: sara._id, content: "חידוש יפה מאוד, תודה!" },
    { postId: posts[0]._id, authorId: avi._id, content: "מעניין, לא חשבתי על זה כך" },
    { postId: posts[1]._id, authorId: moshe._id, content: "אני חושב שהתשובה היא..." },
    { postId: posts[3]._id, authorId: rachel._id, content: "תודה על השיתוף, מחכה לשיעור" },
    { postId: posts[4]._id, authorId: naama._id, content: "אני יכולה לתרום, אשלח פרטים בהודעה" },
  ];
  await Comment.insertMany(commentsData);

  console.log(`נזרעו בהצלחה: ${users.length} משתמשים, ${groups.length} קבוצות, ${posts.length} פוסטים, ${commentsData.length} תגובות`);
  console.log('סיסמה לכל משתמשי הדמו: Password1');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error("שגיאה בזריעת נתונים:", error);
  process.exit(1);
});
