// server/utils/calendarGrid.js
// פונקציה טהורה (בלי תלות ב-DB) לבניית "לוח שנה" ויזואלי אמיתי לעמוד /holidays - FR-029.
//
// חשוב מאוד להבנת ההיקף: זהו לוח **גרגוריאני (לועזי) רגיל** בלבד, בנוי על Date המובנה של JS -
// אין כאן שום חישוב אסטרונומי של הלוח העברי (זה מוגדר במפורש כמחוץ להיקף המערכת, סעיף 2.2 ב-SRS).
// חג יופיע בלוח רק אם לאדמין הוגדר לו ידנית Holiday.gregorianDate ("YYYY-MM-DD") לשנה הנוכחית -
// בדיוק כמו לוח קיר שמישהו תולה וממלא בעצמו כל שנה מחדש, לא לוח שמחשב תאריכים עבריים בעצמו.

const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const DAY_LETTERS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]; // ראשון עד שבת

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// holidays: מערך מסמכי Holiday (חייבים שדה gregorianDate תקין כדי להופיע בלוח)
// referenceDate: מאיזה חודש להתחיל (ברירת מחדל: היום)
// monthsCount: כמה חודשים קדימה להציג (ברירת מחדל: 12 - "שנה קדימה")
function buildYearGrid(holidays, referenceDate, monthsCount) {
  const ref = referenceDate || new Date();
  const count = monthsCount || 12;
  const todayIso = isoOf(new Date());

  // מיפוי מהיר: "YYYY-MM-DD" -> רשימת חגים החלים באותו תאריך
  const byDate = {};
  (holidays || []).forEach((h) => {
    if (!h || !h.gregorianDate) return;
    if (!byDate[h.gregorianDate]) byDate[h.gregorianDate] = [];
    byDate[h.gregorianDate].push(h);
  });

  const months = [];
  let year = ref.getFullYear();
  let month = ref.getMonth();

  for (let i = 0; i < count; i++) {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstOfMonth.getDay(); // 0=ראשון ... 6=שבת

    const cells = [];
    for (let pad = 0; pad < startWeekday; pad++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        iso,
        holidays: byDate[iso] || [],
        isToday: iso === todayIso,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null); // השלמת השבוע האחרון לרוחב מלא

    const weeks = [];
    for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));

    months.push({ year, monthIndex: month, monthName: MONTH_NAMES_HE[month], weeks });

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return months;
}

module.exports = { buildYearGrid, MONTH_NAMES_HE, DAY_LETTERS_HE };
