// server/routes/pageRoutes.js
// נתיבי דפים כלליים (לא קשורים ישירות לאימות)

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { globalSearch } = require("../controllers/searchController");
const shabbatTimes = require("../utils/shabbatTimes"); // כרטיס "זמני שבת" בדף הבית
const Status = require("../models/Status"); // עדכון: שורת "סטטוס" (סטוריז) בדף הבית - "וואטסאפ-ification"

// דף הבית - אם המשתמש מחובר נציג לו את הפיד (בהמשך), אחרת מסך פתיחה
// async: מחשבים את זמני השבת הקרובים לפי עיר המשתמש (או ירושלים כברירת מחדל לאורח)
router.get("/", async (req, res) => {
  const cityKey = (req.session && req.session.shabbatCity) || shabbatTimes.DEFAULT_CITY_KEY;

  // עוטפים ב-try/catch כדי שדף הבית לעולם לא ייפול בגלל תקלה בחישוב האסטרונומי -
  // אם הוא נכשל מסיבה כלשהי, פשוט לא נציג את הכרטיס (shabbat=null) במקום להראות שגיאת שרת
  let shabbat = null;
  try {
    shabbat = await shabbatTimes.getUpcomingShabbat(cityKey);
  } catch (error) {
    console.error("שגיאה בחישוב זמני שבת:", error);
  }

  // עדכון: שורת "סטטוס" (סטוריז) בדף הבית - רק למשתמש מחובר. עטוף ב-try/catch מאותה סיבה בדיוק כמו
  // למעלה - תקלה בפיצ'ר הסטטוס לעולם לא תפיל את דף הבית כולו.
  let statusFeed = [];
  let myActiveStatusCount = 0;
  if (req.session && req.session.userId) {
    try {
      statusFeed = await Status.listActiveFeed(req.session.userId, req.session.userId);
      myActiveStatusCount = (await Status.listActiveByUser(req.session.userId)).length;
    } catch (error) {
      console.error("שגיאה בטעינת שורת הסטטוסים:", error);
    }
  }

  res.render("home", {
    isLoggedIn: !!req.session.userId,
    userName: req.session.userName || null,
    shabbat,
    statusFeed,
    myActiveStatusCount,
  });
});

// GET /study-room - "בית המדרש האישי": מודול React עם Canvas להצגת מעקב הלימוד (FR-020)
router.get("/study-room", isAuthenticated, (req, res) => {
  res.render("studyRoom", {
    isLoggedIn: true,
    userName: req.session.userName,
  });
});

// GET /search - חיפוש גלובלי אחד שמחפש גם בקבוצות וגם בפוסטים ביחד (בנוסף לחיפושים הממוקדים הקיימים)
router.get("/search", globalSearch);

// GET /permissions - עמוד הסבר מלא על מערכת ההרשאות (RBAC) - למי מותר מה, ואיך משיגים כל תפקיד
router.get("/permissions", (req, res) => {
  res.render("permissions");
});

module.exports = router;
