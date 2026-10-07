// server/test/learningStats.test.js
// בדיקות לחישוב סטטיסטיקת הלימוד שנשלחת ל-AI (utils/learningStats.js)
const test = require("node:test");
const assert = require("node:assert");
const { computeLearningStats, isValidPeriod, dayKey } = require("../utils/learningStats");

const NOW = new Date(2026, 9, 7, 12, 0, 0); // 7.10.2026
const day = (offset) => new Date(2026, 9, 7 + offset); // offset ימים מהיום (שלילי = בעבר)
const log = (offset, unit) => ({ date: day(offset), unit, groupName: "", notes: "" });

test("isValidPeriod: רק week ו-month", () => {
  assert.strictEqual(isValidPeriod("week"), true);
  assert.strictEqual(isValidPeriod("month"), true);
  assert.strictEqual(isValidPeriod("year"), false);
  assert.strictEqual(isValidPeriod("__proto__"), false);
  assert.strictEqual(isValidPeriod(undefined), false);
});

test("שבוע: סופר רק 7 ימים אחרונים (כולל היום) ואת הימים הייחודיים", () => {
  const logs = [log(0, "דף א"), log(0, "דף ב"), log(-6, "דף ג"), log(-7, "ישן מדי"), log(-20, "ישן מאוד")];
  const s = computeLearningStats(logs, [], "week", NOW);
  assert.strictEqual(s.entryCount, 3);
  assert.strictEqual(s.activeDays, 2);
  assert.ok(!s.entries.some((e) => e.unit.includes("ישן")));
});

test("חודש: כולל 30 ימים אחורה", () => {
  const s = computeLearningStats([log(-20, "א"), log(-29, "ב"), log(-30, "ג")], [], "month", NOW);
  assert.strictEqual(s.entryCount, 2);
});

test("רצף: ימים רצופים עד היום; אם לא למד היום - הרצף נספר עד אתמול", () => {
  assert.strictEqual(computeLearningStats([log(0, "א"), log(-1, "ב"), log(-2, "ג"), log(-4, "ד")], [], "week", NOW).streak, 3);
  assert.strictEqual(computeLearningStats([log(-1, "א"), log(-2, "ב")], [], "week", NOW).streak, 2);
  assert.strictEqual(computeLearningStats([log(-3, "א")], [], "week", NOW).streak, 0);
});

test("יעדים: מחשב הושלמו/סה\"כ ומחזיר רק פתוחים", () => {
  const goals = [{ text: "מסכת ברכות", done: false }, { text: "פרק תהילים", done: true }];
  const s = computeLearningStats([], goals, "week", NOW);
  assert.strictEqual(s.goalsDone, 1);
  assert.strictEqual(s.goalsTotal, 2);
  assert.deepStrictEqual(s.openGoals, ["מסכת ברכות"]);
});

test("תומך בתאריכי Firestore (Timestamp עם toDate) ובתקופה לא תקינה נופל לשבוע", () => {
  const ts = { toDate: () => day(0) };
  const s = computeLearningStats([{ date: ts, unit: "א" }], [], "bogus", NOW);
  assert.strictEqual(s.entryCount, 1);
  assert.strictEqual(s.periodLabel, "השבוע האחרון");
  assert.strictEqual(dayKey(day(0)), "2026-10-07");
});
