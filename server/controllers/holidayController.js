// server/controllers/holidayController.js
// לוגיקה עסקית לתוכן "מעגל השנה" - FR-028 (ניהול, אדמין בלבד) ו-FR-029 (צפייה, לכולם כולל אורחים)

const Holiday = require("../models/Holiday");
const Group = require("../models/Group");
const sanitizeHtml = require("sanitize-html"); // ניקוי HTML נגד XSS (NFR-006), כמו בפוסטים/פרופיל
const { buildYearGrid } = require("../utils/calendarGrid"); // לוח שנה גרגוריאני ויזואלי (עדכון: בקשת המשתמש ללוח אמיתי, לא רק רשימת מאמרים)

function clean(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// gregorianDate הוא שדה אופציונלי בפורמט "YYYY-MM-DD" בלבד (כמו ש-<input type="date"> שולח) - אחרת מתעלמים ממנו
function cleanGregorianDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}

// GET /holidays - FR-029: עמוד ציבורי, כולל לאורחים - לוח שנה ויזואלי + המועד המובלט + ארכיון שאר המועדים
async function listHolidays(req, res) {
  const all = await Holiday.listAll();
  const featured = all.find((h) => h.isFeatured) || null;
  const archive = all.filter((h) => !featured || h.id !== featured.id);
  const calendarMonths = buildYearGrid(all, new Date(), 12); // 12 חודשים קדימה מהיום, ראו server/utils/calendarGrid.js
  res.render("holidays/index", { featured, archive, calendarMonths });
}

// GET /holidays/:id - צפייה במאמר בודד, כולל קישור לקבוצת ה"ועד" הרלוונטי אם הוגדר
async function showHoliday(req, res, next) {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) {
    res.status(404);
    return next(new Error("מאמר החג המבוקש לא נמצא")); // מטופל ע"י errorHandler.js הגלובלי - מרנדר error.ejs עם statusCode+message
  }
  const linkedGroup = holiday.linkedGroupId ? await Group.findById(holiday.linkedGroupId) : null;
  res.render("holidays/show", { holiday, linkedGroup });
}

// GET /holidays/new - טופס יצירת מאמר חדש (אדמין בלבד)
async function newHolidayForm(req, res) {
  const groups = await Group.listAll();
  res.render("holidays/new", { groups, error: null });
}

// POST /holidays - FR-028: יצירת מאמר חג (אדמין בלבד - BR-012)
async function createHoliday(req, res) {
  const { holidayName, dateHint, whatWeDo, whatWePray, customs, linkedGroupId, order, isFeatured, gregorianDate } = req.body;
  if (!holidayName || !holidayName.trim()) {
    const groups = await Group.listAll();
    return res.render("holidays/new", { groups, error: "יש להזין שם חג" });
  }
  await Holiday.create({
    holidayName: clean(holidayName),
    dateHint: clean(dateHint),
    whatWeDo: clean(whatWeDo),
    whatWePray: clean(whatWePray),
    customs: clean(customs),
    linkedGroupId: linkedGroupId || "",
    gregorianDate: cleanGregorianDate(gregorianDate),
    order,
    isFeatured: isFeatured === "on",
    authorId: req.session.userId,
  });
  res.redirect("/holidays");
}

// GET /holidays/:id/edit - טופס עריכה (אדמין בלבד)
async function editHolidayForm(req, res, next) {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) {
    res.status(404);
    return next(new Error("מאמר החג המבוקש לא נמצא"));
  }
  const groups = await Group.listAll();
  res.render("holidays/edit", { holiday, groups, error: null });
}

// POST /holidays/:id - עדכון מאמר קיים (אדמין בלבד)
async function updateHoliday(req, res) {
  const { holidayName, dateHint, whatWeDo, whatWePray, customs, linkedGroupId, order, isFeatured, gregorianDate } = req.body;
  if (!holidayName || !holidayName.trim()) {
    const holiday = await Holiday.findById(req.params.id);
    const groups = await Group.listAll();
    return res.render("holidays/edit", { holiday, groups, error: "יש להזין שם חג" });
  }
  await Holiday.update(req.params.id, {
    holidayName: clean(holidayName),
    dateHint: clean(dateHint),
    whatWeDo: clean(whatWeDo),
    whatWePray: clean(whatWePray),
    customs: clean(customs),
    linkedGroupId: linkedGroupId || "",
    gregorianDate: cleanGregorianDate(gregorianDate),
    order,
    isFeatured: isFeatured === "on",
  });
  res.redirect("/holidays/" + req.params.id);
}

// POST /holidays/:id/delete - מחיקת מאמר (אדמין בלבד)
async function deleteHoliday(req, res) {
  await Holiday.remove(req.params.id);
  res.redirect("/holidays");
}

module.exports = { listHolidays, showHoliday, newHolidayForm, createHoliday, editHolidayForm, updateHoliday, deleteHoliday };
