// server/controllers/compassController.js
// קטגוריית "מצפן" (/compass): מצפן שמראה את כיוון התפילה (ירושלים / הר הבית) - ציבורי (גם לאורחים).
// השרת מחשב את הכיוון מהעיר שנבחרה (ברירת מחדל: העיר השמורה של המשתמש מ"זמני שבת"), והדפדפן משפר אותו לפי
// מיקום המכשיר (Geolocation) ומסובב את המחוג לפי חיישן הכיוון של הטלפון (DeviceOrientation) - ראו public/js/compass.js.
// החישוב עצמו בלבד ב-utils/compassLogic.js ונבדק אוטומטית.

const { getCityOptions, getCityInfo, isValidCityKey, DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");
const { prayerDirection, TEMPLE_MOUNT } = require("../utils/compassLogic");

// GET /compass[?city=tel-aviv]
function showCompass(req, res) {
  let cityKey = req.query.city;
  if (!isValidCityKey(cityKey)) cityKey = req.session && req.session.shabbatCity;
  if (!isValidCityKey(cityKey)) cityKey = DEFAULT_CITY_KEY;
  const city = getCityInfo(cityKey);
  const direction = prayerDirection(city);

  res.render("compass/index", {
    city,
    cities: getCityOptions(),
    direction,
    target: TEMPLE_MOUNT,
  });
}

// GET /compass/bearing?lat=..&lng=.. - JSON עם הכיוון מנקודה נתונה (הדפדפן קורא לו אחרי שקיבל מיקום מהמכשיר),
// כך שהחישוב נשאר במקום אחד בשרת ולא מוכפל בצד הלקוח
function bearingFromPoint(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, message: "קואורדינטות לא תקינות" });
  }
  const d = prayerDirection({ lat, lng });
  return res.json({
    success: true,
    bearing: d.bearing,
    bearingRounded: d.bearingRounded,
    pointHe: d.pointHe,
    distanceKm: Math.round(d.distanceKm * 10) / 10,
    isAtTarget: d.isAtTarget,
  });
}

module.exports = { showCompass, bearingFromPoint };
