// server/controllers/statusController.js
// לוגיקה עסקית לפיצ'ר "סטטוס" (סטוריז) - עדכון בעקבות בקשת המשתמש ("וואטסאפ-ification")
// היקף מאושר במפורש ע"י המשתמש: תמונה/טקסט, נעלם אוטומטית אחרי 24 שעות, רשימת "נצפה ע"י"

const sanitizeHtml = require("sanitize-html"); // ניקוי טקסט נגד XSS (NFR-006), כמו בכל שאר התוכן שמוזן ע"י משתמשים
const Status = require("../models/Status");
const User = require("../models/User");

function clean(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// צבעי רקע מוגדרים מראש לסטטוס טקסט - בהשראת בחירת הצבעים ל"סטטוס" בוואטסאפ (לא צבע חופשי - שומר על עיצוב אחיד)
const TEXT_BG_COLORS = ["teal", "gold", "rose", "indigo", "forest"];

// GET /status/new - טופס יצירת סטטוס חדש (טקסט או תמונה)
function showNewStatusForm(req, res) {
  res.render("status/new", { bgColors: TEXT_BG_COLORS, error: null });
}

// POST /status/text - יצירת סטטוס טקסט
async function createTextStatus(req, res) {
  const content = clean(req.body.content);
  const bgColor = TEXT_BG_COLORS.includes(req.body.bgColor) ? req.body.bgColor : TEXT_BG_COLORS[0];

  if (!content) {
    return res.render("status/new", { bgColors: TEXT_BG_COLORS, error: "יש להזין טקסט לסטטוס" });
  }

  await Status.create({
    userId: req.session.userId,
    userName: req.session.userName,
    avatarUrl: req.session.userAvatarUrl || "",
    type: "text",
    content,
    bgColor,
  });
  res.redirect(`/status/u/${req.session.userId}`);
}

// POST /status/image - יצירת סטטוס תמונה (עם כיתוב אופציונלי) - אותו דפוס בדיוק כמו uploadAvatar/uploadGroupPhoto
async function createImageStatus(req, res) {
  if (!req.file) {
    return res.render("status/new", { bgColors: TEXT_BG_COLORS, error: "יש לבחור קובץ תמונה" });
  }
  const mediaUrl = `/uploads/${req.file.filename}`;
  await Status.create({
    userId: req.session.userId,
    userName: req.session.userName,
    avatarUrl: req.session.userAvatarUrl || "",
    type: "image",
    mediaUrl,
    content: clean(req.body.caption),
  });
  res.redirect(`/status/u/${req.session.userId}`);
}

// GET /status/u/:userId - צפייה בכל הסטטוסים הפעילים של משתמש מסוים ("סטורי" ברצף)
// רשימת הצופים (viewers) מועברת ל-view רק אם הצופה הנוכחי הוא בעל הסטטוס - לא חושפים מי צפה למי אחר
async function viewUserStatuses(req, res, next) {
  try {
    const targetUserId = req.params.userId;
    const myUserId = req.session.userId;
    const isOwner = targetUserId === myUserId;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404);
      return next(new Error("המשתמש המבוקש לא נמצא"));
    }

    const statuses = await Status.listActiveByUser(targetUserId);
    if (!statuses.length) {
      // מצב ריק ידידותי - אין סטטוסים פעילים (או שפגו) - חוזרים לדף הבית במקום מסך ריק מבלבל
      return res.redirect("/");
    }

    res.render("status/view", {
      targetUser: User.toPublicUser(targetUser),
      statuses,
      isOwner,
      myUserId,
    });
  } catch (error) {
    next(error);
  }
}

// POST /status/:id/view - רישום צפייה (נקרא ע"י statusViewer.js דרך fetch, לא ניווט רגיל - ולכן מחזיר JSON)
async function recordView(req, res) {
  await Status.addViewer(req.params.id, req.session.userId, req.session.userName);
  res.json({ success: true });
}

// POST /status/:id/delete - מחיקה מוקדמת ע"י הבעלים בלבד
async function deleteStatus(req, res, next) {
  try {
    const status = await Status.findById(req.params.id);
    if (!status) {
      res.status(404);
      return next(new Error("הסטטוס לא נמצא"));
    }
    if (status.userId !== req.session.userId) {
      res.status(403);
      return next(new Error("ניתן למחוק רק את הסטטוס של עצמך"));
    }
    await Status.remove(req.params.id);
    res.redirect("/");
  } catch (error) {
    next(error);
  }
}

module.exports = { showNewStatusForm, createTextStatus, createImageStatus, viewUserStatuses, recordView, deleteStatus };
