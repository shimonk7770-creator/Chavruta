// server/server.js
// נקודת הכניסה הראשית לשרת - מגדיר Express, מחבר את כל החלקים יחד
// לפי סעיף 10 (ארכיטקטורה טכנית) במסמך ה-SRS

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const methodOverride = require("method-override");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const groupRoutes = require("./routes/groupRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();

// חיבור למסד הנתונים MongoDB
connectDB();

// מנוע התצוגה - EJS (חלק ה-View במבנה ה-MVC)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// קבצים סטטיים (CSS, JS, תמונות)
app.use(express.static(path.join(__dirname, "public")));

// פענוח גוף הבקשה (טפסים, JSON)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// תמיכה ב-PUT/DELETE מטפסי HTML רגילים
app.use(methodOverride("_method"));

// ניהול session - שומר את המידע שלו במסד הנתונים עצמו, כדי שלא ייעלם באתחול שרת
app.use(
  session({
    secret: process.env.SESSION_SECRET || "chavruta_dev_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
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

// טיפול בשגיאות - חייב להיות אחרון (סעיף 8 ב-SRS)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`שרת חברותא רץ על פורט ${PORT}`);
});
