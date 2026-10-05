// server/test/goalProgress.test.js
// בדיקות ל-server/utils/goalProgress.js - לוגיקה טהורה, בלי חיבור ל-DB (ראו upcomingHoliday.test.js לדפוס דומה)

const test = require("node:test");
const assert = require("node:assert");
const { computeGoalProgress } = require("../utils/goalProgress");

test("רשימה ריקה מחזירה 0 מתוך 0 ו-0 אחוז", () => {
  const result = computeGoalProgress([]);
  assert.deepStrictEqual(result, { done: 0, total: 0, percent: 0 });
});

test("undefined מתנהג כמו רשימה ריקה", () => {
  const result = computeGoalProgress(undefined);
  assert.deepStrictEqual(result, { done: 0, total: 0, percent: 0 });
});

test("כל היעדים בוצעו - 100 אחוז", () => {
  const goals = [{ done: true }, { done: true }, { done: true }];
  const result = computeGoalProgress(goals);
  assert.deepStrictEqual(result, { done: 3, total: 3, percent: 100 });
});

test("אף יעד לא בוצע - 0 אחוז", () => {
  const goals = [{ done: false }, { done: false }];
  const result = computeGoalProgress(goals);
  assert.deepStrictEqual(result, { done: 0, total: 2, percent: 0 });
});

test("חלק בוצעו - אחוז מעוגל נכון (1 מתוך 3 = 33%)", () => {
  const goals = [{ done: true }, { done: false }, { done: false }];
  const result = computeGoalProgress(goals);
  assert.deepStrictEqual(result, { done: 1, total: 3, percent: 33 });
});

test("עיגול תקין גם כשהתוצאה לא עגולה (2 מתוך 3 = 67%)", () => {
  const goals = [{ done: true }, { done: true }, { done: false }];
  const result = computeGoalProgress(goals);
  assert.deepStrictEqual(result, { done: 2, total: 3, percent: 67 });
});
