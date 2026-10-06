// server/controllers/zmanimController.js
// עמוד "זמני היום" (/zmanim) - ציבורי (גם לאורחים), כמו עמוד "מעגל השנה".
// כל החישוב האסטרונומי נמצא ב-server/utils/zmanimTimes.js - הקונטרולר רק בוחר עיר+תאריך ומרנדר.

const { getZmanim, shiftDateISO, getCityOptions } = require("../utils/zmanimTimes");
const { isValidCityKey, DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");

// GET /zmanim?city=tel-aviv&date=2026-10-06
// עיר: קודם מה-URL, אחרת העיר ששמורה אצל המשתמש (session.shabbatCity - אותה בחירה כמו בכרטיס "זמני שבת"), אחרת ירושלים.
// תאריך: מה-URL (YYYY-MM-DD), אחרת "היום" באזור הזמן של העיר (מחושב ב-getZmanim).
async function showZmanim(req, res, next) {
  try {
    let cityKey = req.query.city;
    if (!isValidCityKey(cityKey)) cityKey = req.session && req.session.shabbatCity;
    if (!isValidCityKey(cityKey)) cityKey = DEFAULT_CITY_KEY;

    const data = await getZmanim(cityKey, req.query.date);

    res.render("zmanim/index", {
      zmanim: data,
      cities: getCityOptions(),
      prevDate: shiftDateISO(data.dateISO, -1),
      nextDate: shiftDateISO(data.dateISO, 1),
    });
  } catch (err) {
    next(err); // errorHandler.js הגלובלי מרנדר את error.ejs
  }
}

module.exports = { showZmanim };
