// server/server.js
// נקודת הכניסה הראשית לשרת - מגדיר Express, מחבר את כל החלקים יחד
// לפי סעיף 10 (ארכיטקטורה טכנית) במסמך ה-SRS

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const methodOverride = require("method-override");

const { connectDB } = require("./config/db");

// מתחברים ל-Firestore *לפני* טעינת הראוטים/קונטרולרים,
// כדי שכל מודול שמשתמש במסד הנתונים ימצא אותו כבר מוכן
connectDB();

const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const groupRoutes = require("./routes/groupRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const learningLogRoutes = require("./routes/learningLogRoutes");

const app = express();

// מנוע התצוגה - EJS (חלק ה-View במבנה ה-MVC)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// קבצים סטטיים (CSS, JS, תמונות)
app.use(express.static(path.join(__dirname, "public")));

// קבצי וידאו שהועלו על ידי משתמשים (BR-008) - מוגשים כ-static מתיקיית /uploads בשורש הפרויקט
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// פענוח גוף הבקשה (טפסים, JSON)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// תמיכה ב-PUT/DELETE מטפסי HTML רגילים
app.use(methodOverride("_method"));

// ניהול session - נשמר בזיכרון השרת (מספיק לפרויקט לימודי בתהליך יחיד; ה-DB עצמו הוא Firestore)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "chavruta_dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 60 * 1000, // NFR-005: תפוגת session אחרי 30 דקות חוסר פעילות
    },
  })
);

// נתיבים (Routes)
app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/", groupRoutes);
app.use("/", postRoutes);
app.use("/", commentRoutes);
app.use("/", learningLogRoutes);

// טיפול בשגיאות - חייב להיות אחרון (סעיף 8 ב-SRS)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`שרת חברותא רץ על פורט ${PORT}`);
});
