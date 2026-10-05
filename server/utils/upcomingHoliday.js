// server/utils/upcomingHoliday.js
// לוגיקה טהורה לחישוב "המועד הקרוב" במעגל השנה - מופרדת מהשליפה בפועל מ-Firestore
// (שנעשית ב-server/controllers/holidayController.js) כדי שאפשר לבדוק אותה אוטומטית עם node:test
// בלי להתחבר למסד נתונים אמיתי (ראו server/test/upcomingHoliday.test.js) - אותו דפוס בדיוק
// כמו server/utils/permissionRules.js.
//
// עדכון ממשוב המשתמש (ביקורת/בקשת שיפור): בעבר "המועד הקרוב" חושב לפי דגל isFeatured שסומן
// ידנית וקבוע ע"י האדמין - התוצאה הייתה שהוא נשאר "תקוע" על אותו חג גם חודשים אחרי שהוא עבר בפועל
// (לדוגמה: ראש השנה מוצג כ"קרוב" גם באוקטובר, אחרי שכבר חלף). עכשיו זה מחושב אוטומטית בכל טעינת עמוד:
// בין כל החגים שיש להם gregorianDate תקין, בוחרים את זה עם התאריך הקרוב ביותר שעוד *לא עבר*
// (כולל היום עצמו). אם כולם כבר עברו (או שאין בכלל תאריכים מוגדרים) - מחזירים null, ופשוט לא
// מציגים הבלטה - עדיף מאשר להציג חג ישן ולא רלוונטי.

function findUpcomingHoliday(holidays, today) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = (holidays || [])
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.gregorianDate || ""))
    .map((h) => ({ holiday: h, date: new Date(h.gregorianDate + "T00:00:00") }))
    .filter((entry) => entry.date.getTime() >= todayStart.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming.length ? upcoming[0].holiday : null;
}

module.exports = { findUpcomingHoliday };
