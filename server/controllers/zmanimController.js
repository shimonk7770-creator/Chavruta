// server/controllers/zmanimController.js
// עמוד "זמני היום" (/zmanim) - ציבורי (גם לאורחים), כמו עמוד "מעגל השנה".
// כל החישוב האסטרונומי נמצא ב-server/utils/zmanimTimes.js - הקונטרולר רק בוחר עיר+תאריך ומרנדר.

const { getZmanim, shiftDateISO, getCityOptions } = require("../utils/zmanimTimes");
const { isValidCityKey, DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");
const attendance = require("../services/attendanceService"); // מניינים של היום + "אני מגיע"

// GET /zmanim?city=tel-aviv&date=2026-10-06
// עיר: קודם מה-URL, אחרת העיר ששמורה אצל המשתמש (session.shabbatCity - אותה בחירה כמו בכרטיס "זמני שבת"), אחרת ירושלים.
// תאריך: מה-URL (YYYY-MM-DD), אחרת "היום" באזור הזמן של העיר (מחושב ב-getZmanim).
async function showZmanim(req, res, next) {
  try {
    let cityKey = req.query.city;
    if (!isValidCityKey(cityKey)) cityKey = req.session && req.session.shabbatCity;
    if (!isValidCityKey(cityKey)) cityKey = DEFAULT_CITY_KEY;

    const data = await getZmanim(cityKey, req.query.date);

    // בקשת המרצה: ליד זמני התפילות מוצגים מנייני היום בעיר עם מונה "אני מגיע" (רק כשצופים ביום הנוכחי)
    let todaysMinyanim = [];
    if (data.isToday) {
      try {
        todaysMinyanim = await attendance.todaysForCity(data.cityKey, req.session && req.session.userId);
      } catch (error) {
        console.error("שגיאה בטעינת מנייני היום:", error.message); // תקלה במניינים לא אמורה להפיל את עמוד הזמנים
      }
    }

    res.render("zmanim/index", {
      zmanim: data,
      todaysMinyanim,
      prayerLabels: require("../utils/minyanimLogic").PRAYER_LABELS,
      cities: getCityOptions(),
      prevDate: shiftDateISO(data.dateISO, -1),
      nextDate: shiftDateISO(data.dateISO, 1),
    });
  } catch (err) {
    next(err); // errorHandler.js הגלובלי מרנדר את error.ejs
  }
}

module.exports = { showZmanim };
