// server/test/zmanimTimes.test.js
// בדיקות ל"זמני היום" (server/utils/zmanimTimes.js) - מריצים עם `npm test` (node:test המובנה).
// הבדיקה המרכזית: השוואה לטבלה האמיתית של אתר חב"ד לתל אביב ב-6/10/2026 (נלקחה ידנית מצילום מסך).
// הסבילות היא 3 דקות - החישוב כאן אסטרונומי עצמאי (Hebcal) ולא העתקה, ולכן דקה-שתיים הפרש הן צפויות
// (למשל שקיעה 18:20 אצלנו מול 18:18 בחב"ד). הסבילות נועדה לתפוס טעויות אמיתיות (שעה, הגדרה שגויה), לא רעש.

const test = require("node:test");
const assert = require("node:assert");
const { getZmanim, parseDateParam, shiftDateISO, candleMinutesFor } = require("../utils/zmanimTimes");

// "HH:MM" -> דקות מחצות
function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

test("parseDateParam: מקבל תאריך תקין ודוחה פורמט שגוי/תאריך שלא קיים/מחוץ לטווח", () => {
  assert.deepStrictEqual(parseDateParam("2026-10-06"), { y: 2026, mo: 10, d: 6 });
  assert.strictEqual(parseDateParam("2026-02-31"), null); // פברואר אין לו 31
  assert.strictEqual(parseDateParam("06/10/2026"), null);
  assert.strictEqual(parseDateParam(""), null);
  assert.strictEqual(parseDateParam(undefined), null);
  assert.strictEqual(parseDateParam("1500-01-01"), null);
});

test("shiftDateISO: מעבר בין חודשים ושנים (יום קודם/הבא)", () => {
  assert.strictEqual(shiftDateISO("2026-10-06", 1), "2026-10-07");
  assert.strictEqual(shiftDateISO("2026-10-31", 1), "2026-11-01");
  assert.strictEqual(shiftDateISO("2026-01-01", -1), "2025-12-31");
});

test("candleMinutesFor: ירושלים 40, חיפה 30, ערי ישראל אחרות 20, חו\"ל 18", () => {
  assert.strictEqual(candleMinutesFor("jerusalem", true), 40);
  assert.strictEqual(candleMinutesFor("haifa", true), 30);
  assert.strictEqual(candleMinutesFor("tel-aviv", true), 20);
  assert.strictEqual(candleMinutesFor("new-york", false), 18);
});

test("getZmanim: מחזיר את כל 13 הזמנים + שבת, בסדר כרונולוגי", async () => {
  const z = await getZmanim("tel-aviv", "2026-10-06");
  const keys = z.rows.map((r) => r.key);
  assert.deepStrictEqual(keys, [
    "alotEarly", "alotLate", "tefillin", "sunrise", "shema", "tfila", "chatzot",
    "minchaGedola", "minchaKetana", "plag", "sunset", "tzeit", "chatzotNight",
  ]);
  for (let i = 1; i < z.rows.length; i++) {
    assert.ok(z.rows[i].ts > z.rows[i - 1].ts, `${z.rows[i].key} צריך להיות אחרי ${z.rows[i - 1].key}`);
  }
  z.rows.forEach((r) => assert.match(r.time, /^\d{2}:\d{2}$/));
  assert.match(z.shabbat.candleTime, /^\d{2}:\d{2}$/);
  assert.match(z.shabbat.havdalahTime, /^\d{2}:\d{2}$/);
  assert.ok(z.shabbat.havdalahTs > z.shabbat.candleTs);
});

test("getZmanim: תל אביב 6/10/2026 קרוב (עד 3 דקות) לטבלת חב\"ד", async () => {
  const z = await getZmanim("tel-aviv", "2026-10-06");
  const byKey = Object.fromEntries(z.rows.map((r) => [r.key, r.time]));
  const chabad = {
    alotEarly: "04:40", alotLate: "05:27", tefillin: "05:48", sunrise: "06:39", shema: "09:32",
    tfila: "10:32", chatzot: "12:29", minchaGedola: "12:59", minchaKetana: "15:53", plag: "17:06",
    sunset: "18:18", tzeit: "18:43",
  };
  for (const [key, expected] of Object.entries(chabad)) {
    const diff = Math.abs(toMin(byKey[key]) - toMin(expected));
    assert.ok(diff <= 3, `${key}: אצלנו ${byKey[key]}, בחב"ד ${expected} (הפרש ${diff} דקות)`);
  }
  // כניסת שבת 9/10: חב"ד 17:53, צאת שבת 10/10: חב"ד 18:50
  assert.ok(Math.abs(toMin(z.shabbat.candleTime) - toMin("17:53")) <= 4);
  assert.ok(Math.abs(toMin(z.shabbat.havdalahTime) - toMin("18:50")) <= 3);
});

test("getZmanim: עלות מקדימה = 120 דקות לפני הנץ, מאחרת = 72 דקות", async () => {
  const z = await getZmanim("jerusalem", "2026-03-15");
  const r = Object.fromEntries(z.rows.map((x) => [x.key, x.ts]));
  assert.strictEqual(r.sunrise - r.alotEarly, 120 * 60000);
  assert.strictEqual(r.sunrise - r.alotLate, 72 * 60000);
  assert.strictEqual(r.minchaGedola - r.chatzot, 30 * 60000);
});

test("getZmanim: תאריך/עיר לא תקינים נופלים לברירת מחדל בלי לקרוס", async () => {
  const z = await getZmanim("not-a-city", "2026-02-31");
  assert.strictEqual(z.cityKey, "jerusalem");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(z.dateISO));
  assert.strictEqual(z.isToday, true); // תאריך שגוי -> היום
});

test("getZmanim: כניסת שבת היא בערב שישי הקרוב (גם כשהתאריך שנבחר הוא שבת)", async () => {
  const fri = await getZmanim("jerusalem", "2026-10-09"); // שישי
  assert.strictEqual(fri.shabbat.fridayISO, "2026-10-09");
  const sat = await getZmanim("jerusalem", "2026-10-10"); // שבת -> השבת הבאה
  assert.strictEqual(sat.shabbat.fridayISO, "2026-10-16");
  const tue = await getZmanim("jerusalem", "2026-10-06"); // שלישי
  assert.strictEqual(tue.shabbat.fridayISO, "2026-10-09");
});

test("getZmanim: זמנים מוצגים לפי אזור הזמן של העיר (ניו יורק בקיץ)", async () => {
  const z = await getZmanim("new-york", "2026-06-21");
  const sunrise = z.rows.find((r) => r.key === "sunrise").time;
  const h = toMin(sunrise) / 60;
  assert.ok(h > 5 && h < 5.5, `הנץ בניו יורק ב-21/6 אמור להיות סביב 05:25, התקבל ${sunrise}`);
});
