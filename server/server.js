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
const messageRoutes = require("./routes/messageRoutes"); // עדכון: צ'אט פרטי 1-על-1 ("וואטסאפ-ification")
const statusRoutes = require("./routes/statusRoutes"); // עדכון: פיצ'ר "סטטוס" (סטוריז) - "וואטסאפ-ification"
const statsRoutes = require("./routes/statsRoutes"); // שבוע 4 - נתוני גרפי D3
const holidayRoutes = require("./routes/holidayRoutes"); // "מעגל השנה" - FR-028, FR-029
const zmanimRoutes = require("./routes/zmanimRoutes"); // "זמני היום" - עלות השחר, הנץ, חצות, שקיעה וכו' (ציבורי)
const prayerRoutes = require("./routes/prayerRoutes"); // "נוסח תפילה" - שחרית/מנחה/ערבית מ-Sefaria (ציבורי)
const minyanRoutes = require("./routes/minyanRoutes"); // "מניינים" - חיפוש מניינים קרובים (צפייה ציבורית, הוספה למחוברים)
const compassRoutes = require("./routes/compassRoutes"); // "מצפן" - כיוון תפילה לירושלים (ציבורי)
const aiRoutes = require("./routes/aiRoutes"); // פיצ'ר AI (Gemini) - סיכום פוסטים ושאלות על פוסט/קבוצה (דרישת המרצה #2)
const adminRoutes = require("./routes/adminRoutes"); // לוח בקרה למנהל מערכת
const notificationRoutes = require("./routes/notificationRoutes"); // פעמון התראות בזמן אמת
const mobileRoutes = require("./routes/mobileRoutes"); // API לאפליקציית המובייל (React Native/Expo) - דרישת המרצה
const mobileBridge = require("./middleware/mobileBridge"); // גשר טוקן: האפליקציה משתמשת באותם בקרים של האתר (תשובות JSON)
const { makeRouterAsyncSafe } = require("./utils/asyncSafe"); // בקר async שזורק שגיאה לא "תוקע" את הבקשה

const app = express();

// מאחורי Render/Railway (reverse proxy) כל הבקשות מגיעות ב-HTTP פנימי; trust proxy גורם ל-req.protocol להיות https
// (חשוב לכתובות מלאות שהאפליקציה מקבלת) ול-rate-limit לזהות את כתובת ה-IP האמיתית של המשתמש
app.set("trust proxy", 1);

// helmet מוסיף אוטומטית כמה HTTP headers מגנים בסיסיים (מניעת clickjacking, sniffing סוג קובץ וכו').
// contentSecurityPolicy מבוטלת בכוונה: האתר טוען סקריפטים חיצוניים מ-CDN (jQuery, React, D3, Babel, Socket.io-client, Google Fonts) -
// מדיניות CSP ברירת המחדל של helmet הייתה חוסמת את כל אלה. בפרויקט אמיתי (לא לימודי) היינו מגדירים CSP מדויקת במקום לבטל אותה.
// crossOriginOpenerPolicy: "same-origin-allow-popups" - ברירת המחדל של helmet (same-origin) חוסמת את חלון ההתחברות
// הקופץ של Google (Firebase signInWithPopup), כי הוא לא יכול להחזיר את התוצאה לחלון האתר.
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } }));

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

// ===== גשר האפליקציה (חייב לבוא *לפני* express-session) =====
// כל הבקשות של האפליקציה ל-/api/mobile/* מקבלות CORS (אימות בטוקן בכותרת, לא בעוגייה).
// ותחת /api/mobile/web/* מופעלים אותם routers של האתר, אבל עם session שנבנה מהטוקן ותשובות JSON (ראו middleware/mobileBridge.js).
const webRouters = [
  authRoutes, pageRoutes, groupRoutes, postRoutes, commentRoutes, learningLogRoutes, chatRoutes, messageRoutes,
  statusRoutes, statsRoutes, holidayRoutes, zmanimRoutes, prayerRoutes, minyanRoutes, compassRoutes, aiRoutes,
  adminRoutes, notificationRoutes,
];
webRouters.forEach(makeRouterAsyncSafe);
makeRouterAsyncSafe(mobileRoutes);
app.use("/api/mobile", mobileBridge.mobileCors);
const bridgeRouter = express.Router();
bridgeRouter.use(mobileBridge.bridgeAuth);
webRouters.forEach((router) => bridgeRouter.use("/", router));
bridgeRouter.use((req, res) => res.status(404).json({ success: false, message: "הכתובת המבוקשת לא נמצאה" }));
app.use("/api/mobile/web", bridgeRouter);

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

// משתמש שהושבת ע"י אדמין (או מחק חשבון) מנותק מיד, גם אם ה-session שלו עדיין בתוקף
app.use(require("./middleware/activeUser").rejectInactiveSession);

// middleware גלובלי נוסף - שם בהישג יד של *כל* תבנית EJS את מצב ההתחברות של המשתמש (res.locals.isLoggedIn/userName/userRole).
// זה מתקן בעיה שהייתה קיימת: לפני התוספת הזו, רק חלק מהקונטרולרים טרחו להעביר isLoggedIn ל-render בעצמם,
// ולכן בעמודים ששכחו להעביר אותו (למשל קבוצות/פוסטים/פרופיל) התפריט העליון "שכח" שהמשתמש מחובר
// והציג שוב את כפתורי "התחברות/הרשמה" גם למשתמש שכבר מחובר. עכשיו זה מחושב פעם אחת, במקום אחד, לכל בקשה.
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!(req.session && req.session.userId);
  res.locals.userName = (req.session && req.session.userName) || null;
  res.locals.userRole = (req.session && req.session.userRole) || null;
  res.locals.userAvatarUrl = (req.session && req.session.userAvatarUrl) || "";
  // עדכון: userId גלובלי לכל תבנית - נדרש ע"י partials/statusBar.ejs כדי לבנות את קישור "הסטטוס שלי"
  res.locals.userId = (req.session && req.session.userId) || null;
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
app.use("/", messageRoutes); // צ'אט פרטי 1-על-1
app.use("/", statusRoutes); // סטטוס (סטוריז)
app.use("/", statsRoutes); // שבוע 4
app.use("/", holidayRoutes); // מעגל השנה
app.use("/", zmanimRoutes); // זמני היום
app.use("/", prayerRoutes); // נוסח תפילה
app.use("/", minyanRoutes); // מניינים
app.use("/", compassRoutes); // מצפן
app.use("/", aiRoutes); // AI - סיכום ושאלות (POST /api/ai/...)
app.use("/", adminRoutes); // לוח בקרה למנהל
app.use("/", notificationRoutes); // פעמון התראות
app.use("/", mobileRoutes); // API לאפליקציית המובייל

// גרסת ה-web של האפליקציה (Expo export, ראו chavruta-mobile/package.json -> export:web): מוגשת מ-/app,
// כך שקישור אחד (למשל https://<השרת>/app) פותח את האפליקציה בכל מכשיר. SPA: כל נתיב לא מוכר תחת /app מחזיר את index.html
const appWebDir = path.join(__dirname, "public", "app");
app.use("/app", express.static(appWebDir));
app.get("/app/*", (req, res, next) => {
  res.sendFile(path.join(appWebDir, "index.html"), (err) => err && next());
});

// טיפול בשגיאות - חייב להיות אחרון (סעיף 8 ב-SRS)
app.use(notFound);
app.use(errorHandler);

// שבוע 4: עוטפים את Express בשרת HTTP "גולמי" כדי שגם Express וגם Socket.io יאזינו על אותו פורט -
// זו התבנית הסטנדרטית לחיבור Socket.io ל-Express (לא ניתן פשוט עם app.listen)
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: true } }); // cors: לקוח ה-web של האפליקציה יכול לרוץ מכתובת אחרת (האימות בטוקן, לא בעוגייה)
io.engine.use(sessionMiddleware); // "משתילים" את אותו session גם לתוך כל handshake של Socket.io
io.use(mobileBridge.socketAuth); // לקוח האפליקציה מזדהה בטוקן (auth.token) במקום בעוגייה
require("./sockets/ioInstance").setIo(io); // חושף את io גם לקונטרולרים REST רגילים (למשל commentController.js) לצורך התראות
require("./sockets/chatSocket")(io); // רישום כל מאזיני אירועי הצ'אט (join/send/typing/disconnect) + התראות פעמון

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`שרת חברותא רץ על פורט ${PORT} (כולל Socket.io לצ'אט בזמן אמת)`);
});
