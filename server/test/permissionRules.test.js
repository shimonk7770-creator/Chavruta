// server/test/permissionRules.test.js
// בדיקות אוטומטיות ללוגיקת ההרשאות (מי מורשה לערוך/למחוק תוכן) - AC-002, AC-003 ב-SRS.
// בודק את הפונקציה הטהורה בלבד (בלי Firestore אמיתי) - ראו server/utils/permissionRules.js

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { canModifyContent } = require("../utils/permissionRules");

describe("canModifyContent", () => {
  test("הבעלים של התוכן מורשה לשנות אותו", () => {
    const allowed = canModifyContent({ userId: "u1", userRole: "member", ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, true);
  });

  test("משתמש רגיל שאינו הבעלים ואינו מנהל הקבוצה - חסום (AC-002)", () => {
    const allowed = canModifyContent({ userId: "u3", userRole: "member", ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, false);
  });

  test("מנהל מערכת (admin) מורשה תמיד, גם אם אינו הבעלים", () => {
    const allowed = canModifyContent({ userId: "u9", userRole: "admin", ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, true);
  });

  test("מנהל הקבוצה הרלוונטית מורשה, גם אם אינו הבעלים", () => {
    const allowed = canModifyContent({ userId: "u2", userRole: "manager", ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, true);
  });

  test("מנהל קבוצה *אחרת* (לא זו שהתוכן שייך אליה) - חסום (AC-003)", () => {
    // המשתמש הוא manager באופן כללי, אבל לא מנהל *הקבוצה הספציפית* הזו (groupManagerId שונה)
    const allowed = canModifyContent({ userId: "u5", userRole: "manager", ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, false);
  });

  test("אין userId בכלל (לא מחובר) - חסום", () => {
    const allowed = canModifyContent({ userId: undefined, userRole: undefined, ownerId: "u1", groupManagerId: "u2" });
    assert.equal(allowed, false);
  });
});
