// server/controllers/mobileController.js
// API ייעודי לאפליקציית המובייל (React Native/Expo) - דרישת המרצה הנוספת מס' 1.
// מחזיר JSON בלבד (לא EJS!) ומשתמש בטוקן (ראו mobileAuth.js + MobileToken.js) במקום session,
// כי זו אפליקציה נפרדת לגמרי מהאתר, שרצה כקוד משלה על הטלפון ולא חולקת עוגיות עם הדפדפן.
const { verifyCredentials } = require("../services/loginService");
const { likeSummary } = require("../utils/likes");
const MobileToken = require("../models/MobileToken");
const { signInWithGoogle } = require("../services/googleLoginService");
const googleAuth = require("../utils/googleAuth");
const Group = require("../models/Group");
const Post = require("../models/Post");

// הופך כתובת יחסית כמו "/uploads/x.jpg" לכתובת מלאה (כולל host) - הכרחי במובייל: בניגוד לדפדפן,
// ש-<img src="/uploads/x.jpg"> בו נפתר אוטומטית מול כתובת העמוד, רכיב ה-Image של React Native חייב
// לקבל כתובת מלאה. req.get("host") הוא בדיוק הכתובת שהטלפון עצמו פנה אליה (למשל 192.168.1.23:3000),
// כך שזה עובד אוטומטית גם אם כתובת ה-IP המקומית של המחשב משתנה (למשל במעבר בין רשתות WiFi).
function toAbsoluteUrl(req, relativeUrl) {
  if (!relativeUrl) return "";
  return `${req.protocol}://${req.get("host")}${relativeUrl}`;
}

// POST /api/mobile/login - מסך ההתחברות באפליקציה
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "יש למלא אימייל וסיסמה" });
  }

  const result = await verifyCredentials(email, password);

  if (!result.ok) {
    if (result.reason === "locked") {
      return res.status(403).json({ success: false, message: `החשבון נעול זמנית. נסה שוב בעוד כ-${result.minutesLeft} דקות` });
    }
    // "invalid" - לא חושפים אם האימייל קיים או שהסיסמה שגויה (מניעת enumeration), בדיוק כמו באתר
    return res.status(401).json({ success: false, message: "אימייל או סיסמה שגויים" });
  }

  const user = result.user;
  const token = await MobileToken.create(user.id);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      avatarUrl: toAbsoluteUrl(req, user.avatarUrl),
    },
  });
}

// POST /api/mobile/login/google - גוף: { idToken } של Firebase (האפליקציה התחברה מול Google). מחזיר טוקן אפליקציה כמו login רגיל
async function googleLogin(req, res) {
  try {
    const result = await signInWithGoogle(req.body && req.body.idToken);
    if (!result.ok) return res.status(401).json({ success: false, message: googleAuth.reasonMessage(result.reason) });
    const user = result.user;
    const token = await MobileToken.create(user.id);
    res.json({
      success: true,
      token,
      user: { id: user.id, fullName: user.fullName, username: user.username, avatarUrl: toAbsoluteUrl(req, user.avatarUrl) },
    });
  } catch (error) {
    console.error("שגיאה בהתחברות Google (מובייל):", error.message);
    res.status(500).json({ success: false, message: "אירעה שגיאה בהתחברות עם Google. נסו שוב." });
  }
}

// POST /api/mobile/logout
async function logout(req, res) {
  await MobileToken.remove(req.mobileToken);
  res.json({ success: true });
}

// GET /api/mobile/feed - "פיד פוסטים אישי" (הנתונים שהמשתמש בחר שיוצגו באפליקציה) -
// מקביל ל-GET /feed באתר (postController.myFeed), רק כ-JSON וכתובות תמונה מלאות
async function feed(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 10;

    // tab=community -> הפיד הציבורי (כל הפוסטים האחרונים); אחרת הפיד האישי (קבוצות שאני חבר בהן)
    let result;
    if (req.query.tab === "community") {
      result = await Post.listRecent({ page, pageSize });
    } else {
      const myGroups = await Group.findByMember(req.mobileUserId);
      result = await Post.listByGroupIds(myGroups.map((g) => g.id), { page, pageSize });
    }
    const { posts, total } = result;

    const mobilePosts = posts.map((p) => ({
      ...likeSummary(p, req.mobileUserId), // likeCount + likedByMe
      groupId: p.groupId || "",
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      groupName: p.groupName,
      authorName: p.authorName,
      imageUrls: (p.imageUrls || []).map((url) => toAbsoluteUrl(req, url)),
      createdAt: p.createdAt,
    }));

    res.json({ success: true, posts: mobilePosts, total, page, pageSize });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, googleLogin, logout, feed };
