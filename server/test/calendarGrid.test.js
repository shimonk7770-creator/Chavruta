// server/test/calendarGrid.test.js
// בדיקות אוטומטיות (node:test) לפונקציה הטהורה שבונה את לוח השנה הגרגוריאני בעמוד /holidays.

const { test, describe } = require("node:test");
const assert = require("node:assert");
const { buildYearGrid, buildMonth } = require("../utils/calendarGrid");

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

// עדכון (בקשת המשתמש): עמוד /holidays עבר מ-12 חודשים יחד לחודש בודד + ניווט - buildMonth היא הפונקציה שמממשת זאת
describe("buildMonth", () => {
  test("מחזיר חודש בודד עם year/monthIndex/monthName נכונים", () => {
    const m = buildMonth([], 2026, 9); // אוקטובר 2026 (monthIndex 9)
    assert.strictEqual(m.year, 2026);
    assert.strictEqual(m.monthIndex, 9);
    assert.strictEqual(m.monthName, "אוקטובר");
  });

  test("כל שבוע בחודש הבודד מכיל בדיוק 7 תאים", () => {
    const m = buildMonth([], 2026, 9);
    m.weeks.forEach((week) => assert.strictEqual(week.length, 7));
  });

  test("חג עם gregorianDate תקין מופיע בתא הנכון בחודש הבודד", () => {
    const holidays = [{ id: "h1", holidayName: "יום כיפור", gregorianDate: "2026-09-21" }];
    const m = buildMonth(holidays, 2026, 8); // ספטמבר (monthIndex 8)
    const cell = m.weeks.flat().filter(Boolean).find((c) => c.day === 21);
    assert.ok(cell);
    assert.strictEqual(cell.holidays[0].holidayName, "יום כיפור");
  });

  test("buildYearGrid עם monthsCount=1 זהה לתוצאה של buildMonth על אותו חודש", () => {
    const holidays = [{ id: "h1", holidayName: "חג", gregorianDate: "2026-10-05" }];
    const viaYearGrid = buildYearGrid(holidays, new Date(2026, 9, 1), 1)[0];
    const viaMonth = buildMonth(holidays, 2026, 9);
    assert.deepStrictEqual(viaYearGrid, viaMonth);
  });
});
