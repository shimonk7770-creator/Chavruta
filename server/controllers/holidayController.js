// server/controllers/holidayController.js
// לוגיקה עסקית לתוכן "מעגל השנה" - FR-028 (ניהול, אדמין בלבד) ו-FR-029 (צפייה, לכולם כולל אורחים)

const Holiday = require("../models/Holiday");
const Group = require("../models/Group");
const sanitizeHtml = require("sanitize-html"); // ניקוי HTML נגד XSS (NFR-006), כמו בפוסטים/פרופיל
const { buildMonth } = require("../utils/calendarGrid"); // לוח שנה גרגוריאני ויזואלי (עדכון: בקשת המשתמש ללוח אמיתי, לא רק רשימת מאמרים)
const { findUpcomingHoliday } = require("../utils/upcomingHoliday"); // עדכון: "המועד הקרוב" מחושב אוטומטית - ראו תיעוד בקובץ

function clean(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} }).trim();
}

// gregorianDate הוא שדה אופציונלי בפורמט "YYYY-MM-DD" בלבד (כמו ש-<input type="date"> שולח) - אחרת מתעלמים ממנו
function cleanGregorianDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}


// GET /holidays - FR-029: עמוד ציבורי, כולל לאורחים - לוח שנה ויזואלי + המועד המובלט + ארכיון שאר המועדים
// עדכון (בקשת המשתמש): קודם הוצגו 12 חודשים קדימה יחד - עכשיו מוצג רק החודש הנוכחי (ברירת מחדל),
// עם אפשרות ניווט לחודש/שנה אחרים דרך query params ?year=YYYY&month=M (M הוא 1-12, לא 0-11, לנוחות ב-URL).
async function listHolidays(req, res) {
  const all = await Holiday.listAll();
  const today = new Date();
  const featured = findUpcomingHoliday(all, today); // מחושב אוטומטית - ראו הערה למעלה
  const archive = all.filter((h) => !featured || h.id !== featured.id);

  let year = parseInt(req.query.year, 10);
  let month1based = parseInt(req.query.month, 10); // כפי שמגיע מה-URL: 1=ינואר ... 12=דצמבר

  // ולידציה - אם חסר/לא תקין, חוזרים לחודש הנוכחי (ברירת המחדל שהמשתמש ביקש)
  if (!Number.isInteger(year) || year < 1900 || year > 2200) year = today.getFullYear();
  if (!Number.isInteger(month1based) || month1based < 1 || month1based > 12) {
    month1based = today.getMonth() + 1;
  }
  const monthIndex = month1based - 1; // buildMonth מצפה ל-0-11

  const calendarMonth = buildMonth(all, year, monthIndex);

  // חישוב "חודש קודם"/"חודש הבא" לקישורי הניווט (כולל מעבר בין שנים בקצוות ינואר/דצמבר)
  const prev = monthIndex === 0 ? { year: year - 1, month: 12 } : { year, month: month1based - 1 };
  const next = monthIndex === 11 ? { year: year + 1, month: 1 } : { year, month: month1based + 1 };
  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth();

  res.render("holidays/index", {
    featured,
    archive,
    calendarMonth,
    prev,
    next,
    isCurrentMonth,
    todayYear: today.getFullYear(),
    todayMonth1based: today.getMonth() + 1,
  });
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
// עדכון: כולל תמיכה בתמונה אופציונלית (req.file, דרך uploadHolidayPhoto.single ב-routes) - בקשת המשתמש
async function createHoliday(req, res) {
  const { holidayName, dateHint, whatWeDo, whatWePray, customs, linkedGroupId, order, gregorianDate } = req.body;
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
    imageUrl: req.file ? `/uploads/${req.file.filename}` : "",
    order,
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
// עדכון: תמונה חדשה (req.file) מחליפה את הקיימת; אם לא הועלתה תמונה חדשה - משאירים את ה-imageUrl הקיים כמו שהוא
async function updateHoliday(req, res) {
  const { holidayName, dateHint, whatWeDo, whatWePray, customs, linkedGroupId, order, gregorianDate } = req.body;
  if (!holidayName || !holidayName.trim()) {
    const holiday = await Holiday.findById(req.params.id);
    const groups = await Group.listAll();
    return res.render("holidays/edit", { holiday, groups, error: "יש להזין שם חג" });
  }
  const patch = {
    holidayName: clean(holidayName),
    dateHint: clean(dateHint),
    whatWeDo: clean(whatWeDo),
    whatWePray: clean(whatWePray),
    customs: clean(customs),
    linkedGroupId: linkedGroupId || "",
    gregorianDate: cleanGregorianDate(gregorianDate),
    order,
  };
  if (req.file) patch.imageUrl = `/uploads/${req.file.filename}`;
  await Holiday.update(req.params.id, patch);
  res.redirect("/holidays/" + req.params.id);
}

// POST /holidays/:id/delete - מחיקת מאמר (אדמין בלבד)
async function deleteHoliday(req, res) {
  await Holiday.remove(req.params.id);
  res.redirect("/holidays");
}

module.exports = { listHolidays, showHoliday, newHolidayForm, createHoliday, editHolidayForm, updateHoliday, deleteHoliday };
