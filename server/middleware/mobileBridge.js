// server/middleware/mobileBridge.js
// "גשר האפליקציה": מאפשר לאפליקציה (Expo / גרסת ה-web שלה) להשתמש בדיוק באותם בקרים של האתר, בלי להעתיק לוגיקה.
// הרעיון: כל הבקשות תחת /api/mobile/web/* מגיעות עם Authorization: Bearer <token> (אותו טוקן של /api/mobile/login),
// והמידלוור כאן בונה מהטוקן אובייקט req.session "מזויף" (userId/role/name) - כך כל ה-middleware וה-controllers הקיימים
// (isAuthenticated, isGroupManagerOf, canModifyPost...) עובדים ללא שינוי, והתשובות הופכות ל-JSON (ראו utils/bridgeResponse.js).
// הגשר רץ *לפני* express-session, ולכן אין cookie ואין מעקב session בזיכרון השרת לבקשות האפליקציה.
const MobileToken = require("../models/MobileToken");
const User = require("../models/User");
const { guard } = require("./activeUser");
const { DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");
const { adaptResponse } = require("../utils/bridgeResponse");

// אובייקט session מינימלי עם אותו מבנה ש-authController.startSession בונה באתר
function buildBridgeSession(user) {
  return {
    userId: user.id,
    userRole: user.role,
    userName: user.fullName,
    userAvatarUrl: user.avatarUrl || "",
    shabbatCity: user.shabbatCity || DEFAULT_CITY_KEY,
    destroy(callback) {
      if (callback) callback();
    },
    save(callback) {
      if (callback) callback();
    },
  };
}

// מזהה את המשתמש לפי הטוקן; מחזיר { user } או { error } (הודעה למשתמש)
async function resolveUserFromToken(token) {
  if (!token) return { user: null };
  const userId = await MobileToken.findUserIdByToken(token);
  if (!userId) return { error: "טוקן לא תקף - יש להתחבר מחדש" };
  if (!(await guard.isActive(userId))) return { error: "החשבון הושבת או נמחק - יש להתחבר מחדש" };
  const user = await User.findById(userId);
  if (!user || user.isActive === false) return { error: "החשבון הושבת או נמחק - יש להתחבר מחדש" };
  return { user };
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

// Express middleware: בונה session מהטוקן ומתאים את res ל-JSON. בלי טוקן - session ריק (isAuthenticated יחזיר 401 JSON)
async function bridgeAuth(req, res, next) {
  try {
    adaptResponse(res, req);
    const { user, error } = await resolveUserFromToken(readBearer(req));
    if (error) return res.status(401).json({ success: false, message: error });
    req.session = user
      ? buildBridgeSession(user)
      : { destroy: (cb) => cb && cb(), save: (cb) => cb && cb() };
    req.isMobileBridge = true;
    req.mobileToken = readBearer(req);
    next();
  } catch (error) {
    next(error);
  }
}

// Socket.io: לקוח האפליקציה שולח { auth: { token } } בחיבור; כאן הוא מקבל session כמו משתמש באתר, ולכן chatSocket.js עובד ללא שינוי
async function socketAuth(socket, next) {
  const token = socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(); // לקוח האתר - ה-session מגיע מהעוגייה (io.engine.use(sessionMiddleware))
  try {
    const { user, error } = await resolveUserFromToken(token);
    if (error || !user) return next(new Error("unauthorized"));
    socket.request.session = buildBridgeSession(user);
    next();
  } catch (error) {
    next(new Error("unauthorized"));
  }
}

// CORS לנתיבי האפליקציה בלבד. האימות הוא בטוקן בכותרת (לא בעוגייה), ולכן אין סיכון CSRF - אפשר לאפשר כל מקור.
// נדרש כשגרסת ה-web של האפליקציה רצה מכתובת אחרת מהשרת (למשל Expo בפיתוח על localhost:8081).
function mobileCors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

module.exports = { bridgeAuth, socketAuth, mobileCors, buildBridgeSession, resolveUserFromToken };
