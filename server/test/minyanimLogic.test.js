// server/test/minyanimLogic.test.js
// בדיקות ללוגיקת "מניינים" (server/utils/minyanimLogic.js): מרחק, המועד הבא לפי שעון ישראל, ספירה לאחור,
// סינון ומיון לפי קרבה/זמן, תיאור ימים, ולידציית טופס. זמן "עכשיו" מוזרק כדי שהבדיקות יהיו דטרמיניסטיות.

const test = require("node:test");
const assert = require("node:assert");
const L = require("../utils/minyanimLogic");

// 6/10/2026 19:55 בשעון ישראל (קיץ, UTC+3) = 16:55 UTC, יום שלישי
const NOW = new Date("2026-10-06T16:55:00Z");

const JERUSALEM = { lat: 31.7683, lng: 35.2137 };
const TEL_AVIV = { lat: 32.0853, lng: 34.7818 };

test("haversineKm: ירושלים-תל אביב כ-54 ק\"מ, ומרחק מנקודה לעצמה 0", () => {
  const d = L.haversineKm(JERUSALEM, TEL_AVIV);
  assert.ok(d > 53 && d < 55.5, `התקבל ${d}`);
  assert.strictEqual(L.haversineKm(JERUSALEM, JERUSALEM), 0);
});

test("formatDistance: מטרים/קילומטר עשרוני/קילומטרים שלמים", () => {
  assert.strictEqual(L.formatDistance(0.85), "850 מ'");
  assert.strictEqual(L.formatDistance(1.3), '1.3 ק"מ');
  assert.strictEqual(L.formatDistance(12.4), '12 ק"מ');
});

test("localClock: מחשב יום ושעה לפי שעון ישראל ולא לפי UTC", () => {
  const c = L.localClock(NOW);
  assert.strictEqual(c.dow, 2); // שלישי
  assert.strictEqual(c.secondsOfDay, 19 * 3600 + 55 * 60);
  // 21:30 UTC ביום שלישי = 00:30 של יום רביעי בישראל
  const c2 = L.localClock(new Date("2026-10-06T21:30:00Z"));
  assert.strictEqual(c2.dow, 3);
  assert.strictEqual(c2.secondsOfDay, 30 * 60);
});

test("nextOccurrence: היום, מחר, ויום בשבוע הבא", () => {
  const daily = { time: "20:00", days: [0, 1, 2, 3, 4, 5, 6] };
  assert.deepStrictEqual(L.nextOccurrence(daily, NOW), { secondsUntil: 300, dayOffset: 0, dayLabel: "היום" });

  const earlyDaily = { time: "06:30", days: [0, 1, 2, 3, 4, 5, 6] }; // כבר עבר היום -> מחר
  const tomorrow = L.nextOccurrence(earlyDaily, NOW);
  assert.strictEqual(tomorrow.dayLabel, "מחר");
  assert.strictEqual(tomorrow.secondsUntil, 86400 + 6 * 3600 + 30 * 60 - (19 * 3600 + 55 * 60));

  const shabbatOnly = { time: "08:00", days: [6] }; // שבת בלבד, היום שלישי
  const sat = L.nextOccurrence(shabbatOnly, NOW);
  assert.strictEqual(sat.dayOffset, 4);
  assert.strictEqual(sat.dayLabel, "ביום שבת");
});

test("nextOccurrence: חלון חסד - מניין שהתחיל לפני 3 דקות עדיין מוצג, לפני 10 דקות כבר לא", () => {
  const started3 = L.nextOccurrence({ time: "19:52", days: [2] }, NOW);
  assert.strictEqual(started3.secondsUntil, -180);
  const started10 = L.nextOccurrence({ time: "19:45", days: [2] }, NOW); // עבר -> שבוע הבא
  assert.strictEqual(started10.dayOffset, 7);
});

test("nextOccurrence: נתונים לא תקינים מחזירים null", () => {
  assert.strictEqual(L.nextOccurrence({ time: "25:99", days: [1] }, NOW), null);
  assert.strictEqual(L.nextOccurrence({ time: "20:00", days: [] }, NOW), null);
});

test("formatCountdown: דקות, שעות, 'עכשיו' ו'התחיל לפני'", () => {
  assert.strictEqual(L.formatCountdown(7 * 60), "עוד 7 דק'");
  assert.strictEqual(L.formatCountdown(3600), "עוד שעה");
  assert.strictEqual(L.formatCountdown(3600 + 5 * 60), "עוד שעה ו-5 דק'");
  assert.strictEqual(L.formatCountdown(2 * 3600 + 10 * 60), "עוד 2 שעות ו-10 דק'");
  assert.strictEqual(L.formatCountdown(10), "מתחיל עכשיו");
  assert.strictEqual(L.formatCountdown(-180), "התחיל לפני 3 דק'");
});

test("daysLabel: מזהה תבניות מוכרות ומפרט ימים אחרים", () => {
  assert.strictEqual(L.daysLabel([0, 1, 2, 3, 4]), "ימי חול (א'-ה')");
  assert.strictEqual(L.daysLabel([6, 0, 1, 2, 3, 4, 5]), "כל ימות השבוע");
  assert.strictEqual(L.daysLabel([1, 3]), "שני, רביעי");
});

// מניינים לדוגמה סביב ירושלים
const sample = [
  { id: "near-arvit", prayer: "arvit", time: "20:00", days: [0, 1, 2, 3, 4], lat: 31.7700, lng: 35.2140 }, // ~0.2 ק"מ
  { id: "far-arvit", prayer: "arvit", time: "20:30", days: [0, 1, 2, 3, 4], lat: 31.8165, lng: 35.1965 }, // ~5.5 ק"מ
  { id: "mid-arvit", prayer: "arvit", time: "19:56", days: [0, 1, 2, 3, 4], lat: 31.7747, lng: 35.2130 }, // ~0.7 ק"מ, בעוד דקה
  { id: "shacharit", prayer: "shacharit", time: "06:30", days: [0, 1, 2, 3, 4], lat: 31.7690, lng: 35.2140 }, // מחר בבוקר
  { id: "shabbat-only", prayer: "mincha", time: "17:00", days: [6], lat: 31.7690, lng: 35.2140 }, // מחוץ ל-24 שעות
  { id: "no-coords", prayer: "arvit", time: "21:00", days: [0, 1, 2, 3, 4] },
];

test("searchMinyanim: ברירת מחדל - 24 שעות קדימה, ממוין לפי מרחק, בלי מניינים בלי קואורדינטות", () => {
  const res = L.searchMinyanim(sample, JERUSALEM, NOW);
  assert.deepStrictEqual(res.map((r) => r.minyan.id), ["shacharit", "near-arvit", "mid-arvit", "far-arvit"]);
  assert.strictEqual(res[0].dayLabel, "מחר"); // שחרית הכי קרובה פיזית, אבל רק מחר בבוקר
  assert.strictEqual(res[1].countdownText, "עוד 5 דק'");
  assert.strictEqual(res[1].dayLabel, "היום");
});

test("searchMinyanim: מיון לפי זמן", () => {
  const res = L.searchMinyanim(sample, JERUSALEM, NOW, { sort: "time" });
  assert.deepStrictEqual(res.map((r) => r.minyan.id), ["mid-arvit", "near-arvit", "far-arvit", "shacharit"]);
});

test("searchMinyanim: סינון לפי תפילה, רדיוס וטווח זמן", () => {
  assert.deepStrictEqual(L.searchMinyanim(sample, JERUSALEM, NOW, { prayer: "shacharit" }).map((r) => r.minyan.id), ["shacharit"]);
  assert.deepStrictEqual(
    L.searchMinyanim(sample, JERUSALEM, NOW, { prayer: "arvit", radiusKm: 1 }).map((r) => r.minyan.id),
    ["near-arvit", "mid-arvit"]
  );
  const all = L.searchMinyanim(sample, JERUSALEM, NOW, { horizonHours: 0 }).map((r) => r.minyan.id);
  assert.ok(all.includes("shabbat-only"));
});

test("searchMinyanim: canMakeItWalking - מספיקים ברגל רק אם הזמן עד המניין >= זמן ההליכה", () => {
  const res = L.searchMinyanim(sample, JERUSALEM, NOW);
  const byId = Object.fromEntries(res.map((r) => [r.minyan.id, r]));
  assert.strictEqual(byId["near-arvit"].canMakeItWalking, true); // 5 דקות, הליכה ~2-3 דקות
  assert.strictEqual(byId["mid-arvit"].canMakeItWalking, false); // בעוד דקה, הליכה ~8 דקות
});

test("validateMinyanInput: טופס תקין מנורמל; שגיאות מצטברות", () => {
  const isCity = (c) => c === "jerusalem";
  const ok = L.validateMinyanInput(
    { synagogueName: " בית כנסת דמו ", prayer: "arvit", time: "20:00", city: "jerusalem", daysPreset: "weekdays", lat: "31.77", lng: "35.21" },
    isCity
  );
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.value.synagogueName, "בית כנסת דמו");
  assert.deepStrictEqual(ok.value.days, [0, 1, 2, 3, 4]);
  assert.strictEqual(ok.value.lat, 31.77);
  assert.strictEqual(ok.value.nusach, "any");

  const bad = L.validateMinyanInput({ synagogueName: "א", prayer: "x", time: "8:00", city: "zzz", daysPreset: "nope", lat: "999", lng: "1" }, isCity);
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.length >= 6, `התקבלו ${bad.errors.length} שגיאות`);
  assert.strictEqual(bad.value.lat, null);
});
