// server/test/calendarGrid.test.js
// בדיקות אוטומטיות (node:test) לפונקציה הטהורה שבונה את לוח השנה הגרגוריאני בעמוד /holidays.

const { test, describe } = require("node:test");
const assert = require("node:assert");
const { buildYearGrid } = require("../utils/calendarGrid");

describe("buildYearGrid", () => {
  test("מחזיר 12 חודשים כברירת מחדל, החל מהחודש של תאריך הייחוס", () => {
    const months = buildYearGrid([], new Date(2026, 8, 22)); // 22.9.2026
    assert.strictEqual(months.length, 12);
    assert.strictEqual(months[0].monthIndex, 8); // ספטמבר
    assert.strictEqual(months[0].year, 2026);
    assert.strictEqual(months[11].monthIndex, 7); // אוגוסט 2027 - חודש 12 אחורה מספטמבר
    assert.strictEqual(months[11].year, 2027);
  });

  test("מכבד monthsCount מותאם אישית", () => {
    const months = buildYearGrid([], new Date(2026, 0, 1), 3);
    assert.strictEqual(months.length, 3);
  });

  test("כל שבוע מכיל בדיוק 7 תאים (כולל ריפוד null בתחילת/סוף החודש)", () => {
    const months = buildYearGrid([], new Date(2026, 8, 1), 1);
    months[0].weeks.forEach((week) => assert.strictEqual(week.length, 7));
  });

  test("חג עם gregorianDate תקין מופיע בתא הנכון", () => {
    const holidays = [{ id: "h1", holidayName: "יום כיפור", gregorianDate: "2026-09-21" }];
    const months = buildYearGrid(holidays, new Date(2026, 8, 1), 1);
    const flatCells = months[0].weeks.flat().filter(Boolean);
    const cell = flatCells.find((c) => c.day === 21);
    assert.ok(cell, "התא של ה-21 בחודש קיים");
    assert.strictEqual(cell.holidays.length, 1);
    assert.strictEqual(cell.holidays[0].holidayName, "יום כיפור");
  });

  test("חג בלי gregorianDate לא מופיע בשום תא בלוח", () => {
    const holidays = [{ id: "h2", holidayName: "ללא תאריך" }];
    const months = buildYearGrid(holidays, new Date(2026, 8, 1), 1);
    const allHolidaysInGrid = months[0].weeks.flat().filter(Boolean).flatMap((c) => c.holidays);
    assert.strictEqual(allHolidaysInGrid.length, 0);
  });

  test("חג עם תאריך מחודש אחר לא מופיע בחודש הנוכחי", () => {
    const holidays = [{ id: "h3", holidayName: "פסח", gregorianDate: "2027-04-22" }];
    const months = buildYearGrid(holidays, new Date(2026, 8, 1), 1); // רק ספטמבר 2026
    const allHolidaysInGrid = months[0].weeks.flat().filter(Boolean).flatMap((c) => c.holidays);
    assert.strictEqual(allHolidaysInGrid.length, 0);
  });
});
