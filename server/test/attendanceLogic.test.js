// server/test/attendanceLogic.test.js
// בדיקות ל"אני מגיע" למניין: תאריך המופע בשעון ישראל, איפוס אחרי התפילה (מופע חדש = מונה חדש), סיכום 7/10,
// חלון ההצבעה, ושירות ההצבעה עם מודלים מדומים (אין צורך ב-Firestore).
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const A = require("../utils/attendanceLogic");

test("israelDateISO / addDaysISO / occurrenceDateISO: תאריך בשעון ישראל וחיבור ימים (כולל מעבר חודש/שנה)", () => {
  // 21:30 UTC ב-5.10.2026 הוא כבר 00:30 ב-6.10 בישראל (שעון קיץ UTC+3 עד סוף אוקטובר)
  assert.strictEqual(A.israelDateISO(new Date("2026-10-05T21:30:00Z")), "2026-10-06");
  assert.strictEqual(A.israelDateISO(new Date("2026-10-05T10:00:00Z")), "2026-10-05");
  assert.strictEqual(A.addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.strictEqual(A.addDaysISO("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(A.occurrenceDateISO(new Date("2026-10-05T10:00:00Z"), 3), "2026-10-08");
});

test("attendanceDocId ו-canVote: חלון של 24 שעות (ותפילה שהתחילה כבר בתוך חלון החסד)", () => {
  assert.strictEqual(A.attendanceDocId("m1", "2026-10-06"), "m1__2026-10-06");
  assert.strictEqual(A.canVote(-120), true);
  assert.strictEqual(A.canVote(3600), true);
  assert.strictEqual(A.canVote(24 * 3600), true);
  assert.strictEqual(A.canVote(24 * 3600 + 1), false);
  assert.strictEqual(A.canVote(undefined), false);
});

test("attendanceSummary: 7/10, יש מניין ב-10, ואני מסומן רק אם אני ברשימה", () => {
  const seven = A.attendanceSummary({ attendees: ["a", "b", "c", "d", "e", "f", "me"] }, "me");
  assert.deepStrictEqual(seven, { count: 7, target: 10, going: true, hasMinyan: false, missing: 3, percent: 70 });
  const ten = A.attendanceSummary({ attendees: Array.from({ length: 10 }, (_, i) => "u" + i) }, "zzz");
  assert.strictEqual(ten.hasMinyan, true);
  assert.strictEqual(ten.going, false);
  assert.strictEqual(ten.missing, 0);
  assert.deepStrictEqual(A.attendanceSummary(undefined, undefined), { count: 0, target: 10, going: false, hasMinyan: false, missing: 10, percent: 0 });
  assert.strictEqual(A.attendanceSummary({ attendees: Array(14).fill("x") }, "q").percent, 100);
});

test("toggleAttendee: הצבעה אחת לכל משתמש - לחיצה שנייה מבטלת", () => {
  let r = A.toggleAttendee([], "u1");
  assert.deepStrictEqual(r, { attendees: ["u1"], going: true });
  r = A.toggleAttendee(r.attendees, "u2");
  r = A.toggleAttendee(r.attendees, "u1");
  assert.deepStrictEqual(r, { attendees: ["u2"], going: false });
});

// ---- שירות ההצבעה ----
function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}
const store = {};
const minyan = { id: "m1", city: "jerusalem", prayer: "mincha", time: "13:45", days: [0, 1, 2, 3, 4], synagogueName: "בית חב\"ד" };
stub("models/Minyan.js", { findById: async (id) => (id === "m1" ? minyan : null), listAll: async () => [minyan, { ...minyan, id: "m2", city: "haifa" }] });
stub("models/MinyanAttendance.js", {
  getMany: async (ids) => new Map(ids.filter((id) => store[id]).map((id) => [id, { attendees: store[id] }])),
  toggle: async (minyanId, dateISO, docId, userId) => {
    const r = A.toggleAttendee(store[docId] || [], userId);
    store[docId] = r.attendees;
    return r;
  },
});
const svc = require("../services/attendanceService");

// יום שני 5.10.2026 בשעה 12:00 בישראל (09:00 UTC) - מנחה ב-13:45 עוד היום
const monNoon = new Date("2026-10-05T09:00:00Z");

test("toggleAttendance: מסמן, מבטל, ומופע חדש (למחרת, אחרי התפילה) מתחיל מאפס", async () => {
  Object.keys(store).forEach((k) => delete store[k]);
  let r = await svc.toggleAttendance("m1", "u1", monNoon);
  assert.strictEqual(r.status, "ok");
  assert.deepStrictEqual([r.attendance.count, r.attendance.going], [1, true]);
  r = await svc.toggleAttendance("m1", "u2", monNoon);
  assert.strictEqual(r.attendance.count, 2);
  r = await svc.toggleAttendance("m1", "u1", monNoon);
  assert.deepStrictEqual([r.attendance.count, r.attendance.going], [1, false]);
  assert.ok(store["m1__2026-10-05"]);

  // 15:00 באותו יום - התפילה הסתיימה, המופע הבא הוא מחר ולכן המונה מתחיל מ-0
  const afterPrayer = new Date("2026-10-05T12:00:00Z");
  const next = await svc.decorateResults([{ minyan, dayOffset: 1, secondsUntil: 22 * 3600 }], "u2", afterPrayer);
  assert.strictEqual(next[0].attendance.count, 0);
  assert.ok(!store["m1__2026-10-06"]);
});

test("toggleAttendance: מניין לא קיים, והצבעה מוקדמת מדי נחסמת", async () => {
  assert.strictEqual((await svc.toggleAttendance("nope", "u1", monNoon)).status, "notFound");
  // שישי בערב: המופע הבא של מנחה (ימי חול א'-ה') הוא ביום ראשון - רחוק מ-24 שעות
  const friEvening = new Date("2026-10-09T15:00:00Z");
  assert.strictEqual((await svc.toggleAttendance("m1", "u1", friEvening)).status, "closed");
});

test("todaysForCity: רק מניינים של העיר שמתקיימים היום, ממוינים, עם מונה", async () => {
  Object.keys(store).forEach((k) => delete store[k]);
  store["m1__2026-10-05"] = ["a", "b", "u1"];
  const list = await svc.todaysForCity("jerusalem", "u1", monNoon);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].minyan.id, "m1");
  assert.deepStrictEqual([list[0].attendance.count, list[0].attendance.going, list[0].attendance.canVote], [3, true, true]);
  assert.strictEqual((await svc.todaysForCity("haifa", "u1", monNoon)).length, 1);
  assert.strictEqual((await svc.todaysForCity("eilat", "u1", monNoon)).length, 0);
  // אחרי שהתפילה הסתיימה היום - אין עוד מניינים להיום בעיר
  assert.strictEqual((await svc.todaysForCity("jerusalem", "u1", new Date("2026-10-05T14:00:00Z"))).length, 0);
});
