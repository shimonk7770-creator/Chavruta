// server/test/validators.test.js
// בדיקות אוטומטיות (node:test - מובנה ב-Node, לא דורש התקנת ספריית בדיקות נוספת) עבור ולידציית ההרשמה.
// מריצים עם: npm test (ראו package.json). לא דורש חיבור ל-Firestore כי validators.js הן פונקציות טהורות.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { isValidPassword, isValidUsername, isValidEmail } = require("../utils/validators");

describe("isValidPassword (BR-002)", () => {
  test("דוחה סיסמה קצרה מ-8 תווים", () => {
    assert.equal(isValidPassword("Ab1"), false);
  });
  test("דוחה סיסמה בלי אות גדולה", () => {
    assert.equal(isValidPassword("abcdefg1"), false);
  });
  test("דוחה סיסמה בלי ספרה", () => {
    assert.equal(isValidPassword("Abcdefgh"), false);
  });
  test("מקבלת סיסמה תקינה", () => {
    assert.equal(isValidPassword("Password1"), true);
  });
  test("מטפלת בקלט לא-מחרוזת בלי לזרוק שגיאה", () => {
    assert.equal(isValidPassword(undefined), false);
    assert.equal(isValidPassword(null), false);
    assert.equal(isValidPassword(12345678), false);
  });
});

describe("isValidUsername (BR-001)", () => {
  test("דוחה שם משתמש קצר מדי", () => {
    assert.equal(isValidUsername("ab"), false);
  });
  test("דוחה שם משתמש עם תווים לא חוקיים", () => {
    assert.equal(isValidUsername("shimon!!"), false);
    assert.equal(isValidUsername("שמעון"), false);
  });
  test("מקבלת שם משתמש תקין", () => {
    assert.equal(isValidUsername("shimon_k"), true);
  });
});

describe("isValidEmail (BR-003)", () => {
  test("דוחה אימייל בלי @", () => {
    assert.equal(isValidEmail("shimon.example.com"), false);
  });
  test("דוחה אימייל בלי דומיין", () => {
    assert.equal(isValidEmail("shimon@"), false);
  });
  test("מקבלת אימייל תקין", () => {
    assert.equal(isValidEmail("shimon@example.com"), true);
  });
});
