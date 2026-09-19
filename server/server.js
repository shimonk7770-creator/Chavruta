// server/server.js
// נקודת הכניסה הראשית לשרת - מגדיר Express, מחבר את כל החלקים יחד
// לפי סעיף 10 (ארכיטקטורה טכנית) במסמך ה-SRS

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const methodOverride = require("method-override");
const helmet = require("helmet"); // NFR - חיזוק אבטחה בסיסי: headers מגנים (X-Frame-Options, X-Content-Type-Options ועוד)
const http = require("http"); // דרוש כדי לחבר גם Express וגם Socket.io לאותו שרת HTTP (שבוע 4)
const { Server } = require("socket.io");

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
const chatRoutes = require("./routes/chatRoutes"); // שבוע 4 - צ'אט קבוצתי
const statsRoutes = require("./routes/statsRoutes"); // שבוע 4 - נתוני גרפי D3

const app = express();

// helmet מוסיף אוטומטית כמה HTTP headers מגנים בסיסיים (מניעת clickjacking, sniffing סוג קובץ וכו').
// contentSecurityPolicy מבוטלת בכוונה: האתר טוען סקריפטים חיצוניים מ-CDN (jQuery, React, D3, Babel, Socket.io-client, Google Fonts) -
// מדיניות CSP ברירת המחדל של helmet הייתה חוסמת את כל אלה. בפרויקט אמיתי (לא לימודי) היינו מגדירים CSP מדויקת במקום לבטל אותה.
app.use(helmet({ contentSecurityPolicy: false }));

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

// middleware גלובלי - שם את נתיב הבקשה הנוכחי בהישג יד של כל תבנית EJS (res.locals.currentPath).
// משמש ב-partials/header.ejs כדי להדגיש (class "active") את קטגוריית הניווט המתאימה לעמוד הנוכחי
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// ניהול session - נשמר בזיכרון השרת (מספיק לפרויקט לימודי בתהליך יחיד; ה-DB עצמו הוא Firestore).
// מחולץ למשתנה נפרד (לא ישר ל-app.use) כדי שנוכל לחבר את אותו session גם ל-Socket.io למטה -
// בלי session משותף, ה-socket לא היה יודע "מי אתה" (socket.request.session.userId)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "chavruta_dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000, // NFR-005: תפוגת session אחרי 30 דקות חוסר פעילות
  },
});
app.use(sessionMiddleware);

// middleware גלובלי נוסף - שם בהישג יד של *כל* תבנית EJS את מצב ההתחברות של המשתמש (res.locals.isLoggedIn/userName/userRole).
// זה מתקן בעיה שהייתה קיימת: לפני התוספת הזו, רק חלק מהקונטרולרים טרחו להעביר isLoggedIn ל-render בעצמם,
// ולכן בעמודים ששכחו להעביר אותו (למשל קבוצות/פוסטים/פרופיל) התפריט העליון "שכח" שהמשתמש מחובר
// והציג שוב את כפתורי "התחברות/הרשמה" גם למשתמש שכבר מחובר. עכשיו זה מחושב פעם אחת, במקום אחד, לכל בקשה.
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!(req.session && req.session.userId);
  res.locals.userName = (req.session && req.session.userName) || null;
  res.locals.userRole = (req.session && req.session.userRole) || null;
  next();
});

// נתיבים (Routes)
app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/", groupRoutes);
app.use("/", postRoutes);
app.use("/", commentRoutes);
app.use("/", learningLogRoutes);
app.use("/", chatRoutes); // שבוע 4
app.use("/", statsRoutes); // שבוע 4

// טיפול בשגיאות - חייב להיות אחרון (סעיף 8 ב-SRS)
app.use(notFound);
app.use(errorHandler);

// שבוע 4: עוטפים את Express בשרת HTTP "גולמי" כדי שגם Express וגם Socket.io יאזינו על אותו פורט -
// זו התבנית הסטנדרטית לחיבור Socket.io ל-Express (לא ניתן פשוט עם app.listen)
const server = http.createServer(app);

const io = new Server(server);
io.engine.use(sessionMiddleware); // "משתילים" את אותו session גם לתוך כל handshake של Socket.io
require("./sockets/chatSocket")(io); // רישום כל מאזיני אירועי הצ'אט (join/send/typing/disconnect)

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`שרת חברותא רץ על פורט ${PORT} (כולל Socket.io לצ'אט בזמן אמת)`);
});
