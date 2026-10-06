// server/controllers/minyanController.js
// קטגוריית "מניינים" (/minyanim): המשתמש מזין איפה הוא נמצא (מיקום המכשיר / כתובת / עיר) ורואה את המניינים הקרובים
// אליו (מרחק + "עוד X דק'" שמתעדכן בזמן אמת). צפייה - ציבורית; הוספה ומחיקה - למשתמש מחובר
// (מחיקה: רק מי שהוסיף את המניין או אדמין - בדיקה בצד השרת, כמו שאר המערכת).
// כל החישוב (מרחק, מועד הבא, מיון, ולידציה) בנפרד ב-utils/minyanimLogic.js ונבדק אוטומטית.

const sanitizeHtml = require("sanitize-html");
const Minyan = require("../models/Minyan");
const { getCityOptions, getCityInfo, isValidCityKey, DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");
const { geocodeAddress } = require("../utils/geocode");
const L = require("../utils/minyanimLogic");

function clean(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

function numberOrNull(value) {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// קובעת נקודת מוצא לחיפוש לפי סדר עדיפויות: 1) קואורדינטות מהמכשיר, 2) כתובת שהוקלדה (גיאוקוד), 3) עיר שנבחרה,
// 4) העיר השמורה של המשתמש מ"זמני שבת" (session.shabbatCity), 5) ירושלים. warning = הודעה למשתמש אם משהו נפל לחלופה
async function resolveOrigin(req) {
  const lat = numberOrNull(req.query.lat);
  const lng = numberOrNull(req.query.lng);
  if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng, label: "המיקום שלך", kind: "device", warning: "", cityKey: isValidCityKey(req.query.city) ? req.query.city : "" };
  }

  const q = clean(req.query.q);
  let warning = "";
  if (q) {
    const found = await geocodeAddress(q);
    if (found) return { lat: found.lat, lng: found.lng, label: q, kind: "address", warning: "", cityKey: "" };
    warning = `לא הצלחנו לאתר את הכתובת "${q}" - מוצגים מניינים לפי מרכז העיר שנבחרה.`;
  }

  const fallbackKey = isValidCityKey(req.query.city)
    ? req.query.city
    : isValidCityKey(req.session && req.session.shabbatCity)
    ? req.session.shabbatCity
    : DEFAULT_CITY_KEY;
  const city = getCityInfo(fallbackKey);
  return { lat: city.lat, lng: city.lng, label: `${city.label} (מרכז העיר)`, kind: "city", warning, cityKey: city.key };
}

// GET /minyanim - חיפוש מניינים קרובים. פרמטרים (כולם אופציונליים): lat,lng | q | city, prayer, sort, when, radius
async function listMinyanim(req, res, next) {
  try {
    const origin = await resolveOrigin(req);

    const prayer = L.isValidPrayer(req.query.prayer) ? req.query.prayer : "all";
    const sort = req.query.sort === "time" ? "time" : "distance";
    const when = req.query.when === "all" ? "all" : "24h";
    const radiusKm = [1, 3, 5, 10, 25].includes(Number(req.query.radius)) ? Number(req.query.radius) : 0;

    const all = await Minyan.listAll();
    const results = L.searchMinyanim(all, origin, new Date(), {
      prayer,
      radiusKm,
      sort,
      horizonHours: when === "all" ? 0 : 24,
    });

    res.render("minyanim/index", {
      results,
      origin,
      filters: { prayer, sort, when, radius: radiusKm, q: clean(req.query.q) },
      cities: getCityOptions(),
      selectedCity: origin.cityKey || (isValidCityKey(req.query.city) ? req.query.city : DEFAULT_CITY_KEY),
      prayerLabels: L.PRAYER_LABELS,
      nusachLabels: L.NUSACH_LABELS,
      daysLabel: L.daysLabel,
      totalCount: all.length,
    });
  } catch (err) {
    next(err);
  }
}

// GET /minyanim/new - טופס הוספת מניין (משתמש מחובר)
function newForm(req, res) {
  res.render("minyanim/new", {
    error: null,
    form: { city: isValidCityKey(req.session.shabbatCity) ? req.session.shabbatCity : DEFAULT_CITY_KEY, prayer: "arvit", daysPreset: "weekdays", nusach: "any" },
    cities: getCityOptions(),
    prayerLabels: L.PRAYER_LABELS,
    nusachLabels: L.NUSACH_LABELS,
    dayPresets: L.DAY_PRESETS,
  });
}

// POST /minyanim - יצירת מניין. מיקום: מיקום המכשיר (אם נשלח) > גיאוקוד הכתובת > מרכז העיר (בקירוב)
async function createMinyan(req, res, next) {
  try {
    const check = L.validateMinyanInput(req.body, isValidCityKey);
    const renderError = (message) =>
      res.status(400).render("minyanim/new", {
        error: message,
        form: req.body || {},
        cities: getCityOptions(),
        prayerLabels: L.PRAYER_LABELS,
        nusachLabels: L.NUSACH_LABELS,
        dayPresets: L.DAY_PRESETS,
      });
    if (!check.ok) return renderError(check.errors.join(". "));

    const v = check.value;
    const city = getCityInfo(v.city);
    let lat = v.lat;
    let lng = v.lng;
    let precision = "exact";
    if (lat === null || lng === null) {
      const found = v.address ? await geocodeAddress(`${v.address}, ${city.label}`) : null;
      if (found) {
        lat = found.lat;
        lng = found.lng;
        precision = "address";
      } else {
        lat = city.lat;
        lng = city.lng;
        precision = "city";
      }
    }

    await Minyan.create({
      synagogueName: clean(v.synagogueName),
      prayer: v.prayer,
      time: v.time,
      days: v.days,
      nusach: v.nusach,
      city: v.city,
      cityLabel: city.label,
      address: clean(v.address),
      notes: clean(v.notes),
      lat,
      lng,
      locationPrecision: precision,
      createdBy: req.session.userId,
      createdByName: req.session.userName || "",
    });
    res.redirect(`/minyanim?city=${encodeURIComponent(v.city)}`);
  } catch (err) {
    next(err);
  }
}

// POST /minyanim/:id/delete - מחיקה: רק מי שהוסיף את המניין או אדמין (נבדק בשרת, לא רק בהסתרת כפתור)
async function deleteMinyan(req, res, next) {
  try {
    const minyan = await Minyan.findById(req.params.id);
    if (!minyan) {
      res.status(404);
      return next(new Error("המניין לא נמצא"));
    }
    const isOwner = minyan.createdBy && minyan.createdBy === req.session.userId;
    const isAdmin = req.session.userRole === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403);
      return next(new Error("רק מי שהוסיף את המניין (או מנהל מערכת) יכול למחוק אותו"));
    }
    await Minyan.remove(req.params.id);
    res.redirect("/minyanim");
  } catch (err) {
    next(err);
  }
}

module.exports = { listMinyanim, newForm, createMinyan, deleteMinyan, resolveOrigin };
