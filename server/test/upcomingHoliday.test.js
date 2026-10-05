// server/test/upcomingHoliday.test.js
// בדיקות ל-server/utils/upcomingHoliday.js - לוגיקה טהורה, בלי צורך בחיבור ל-Firestore
// (אותו דפוס בדיוק כמו permissionRules.test.js / calendarGrid.test.js)

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { findUpcomingHoliday } = require("../utils/upcomingHoliday");

const HOLIDAYS = [
  { holidayName: "ראש השנה", gregorianDate: "2026-09-12" },
  { holidayName: "יום כיפור", gregorianDate: "2026-09-21" },
  { holidayName: "סוכות", gregorianDate: "2026-09-26" },
  { holidayName: "חנוכה", gregorianDate: "2026-12-05" },
  { holidayName: "פורים", gregorianDate: "2027-03-23" },
  { holidayName: "פסח", gregorianDate: "2027-04-22" },
];

describe("findUpcomingHoliday", () => {
  it("בוחר את החג הקרוב ביותר שעוד לא עבר, לא חג ישן שכבר חלף (הבאג המקורי)", () => {
    // תאריך דוגמה: אחרי ראש השנה/יום כיפור/סוכות, לפני חנוכה - בעבר (עם isFeatured ידני) זה היה
    // ממשיך להציג "ראש השנה" לנצח; עכשיו צריך להציג את "חנוכה" כי זה הקרוב הבא בפועל
    const today = new Date("2026-10-05T12:00:00");
    const result = findUpcomingHoliday(HOLIDAYS, today);
    assert.equal(result.holidayName, "חנוכה");
  });

  it("עובר לחג הבא אחרי שהחג הנוכחי כבר חלף", () => {
    const today = new Date("2026-12-10T12:00:00");
    const result = findUpcomingHoliday(HOLIDAYS, today);
    assert.equal(result.holidayName, "פורים");
  });

  it("מחזיר null אם כל החגים כבר עברו (עדיף מלהציג חג לא רלוונטי)", () => {
    const today = new Date("2027-05-01T12:00:00");
    const result = findUpcomingHoliday(HOLIDAYS, today);
    assert.equal(result, null);
  });

  it("מתעלם מחגים בלי gregorianDate תקין", () => {
    const withBadDate = [...HOLIDAYS, { holidayName: "בלי תאריך", gregorianDate: "" }, { holidayName: "תאריך שגוי", gregorianDate: "לא-תאריך" }];
    const today = new Date("2026-10-05T12:00:00");
    const result = findUpcomingHoliday(withBadDate, today);
    assert.equal(result.holidayName, "חנוכה");
  });

  it("כולל את היום עצמו (חג שחל היום נחשב 'קרוב', לא 'עבר')", () => {
    const today = new Date("2026-12-05T08:00:00");
    const result = findUpcomingHoliday(HOLIDAYS, today);
    assert.equal(result.holidayName, "חנוכה");
  });

  it("מחזיר null עבור רשימה ריקה", () => {
    assert.equal(findUpcomingHoliday([], new Date("2026-10-05")), null);
  });
});
