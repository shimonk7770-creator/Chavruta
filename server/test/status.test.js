// server/test/status.test.js
// בדיקות אוטומטיות (node:test) לפונקציית isExpired הטהורה ב-Status.js - פיצ'ר "סטטוס" (סטוריז).
// שאר הפונקציות במודל (create/listActiveByUser/listActiveFeed וכו') דורשות Firestore אמיתי,
// ולכן לא נבדקות כאן ישירות - בדיוק כמו שאר המודלים בפרויקט (Group/Post/User וכו').

const { test, describe } = require("node:test");
const assert = require("node:assert");
const { isExpired, EXPIRY_MS } = require("../models/Status");

describe("isExpired", () => {
  test("סטטוס שנוצר הרגע לא פג תוקף", () => {
    assert.strictEqual(isExpired({ createdAt: new Date() }), false);
  });

  test("סטטוס שנוצר לפני 23 שעות עדיין לא פג תוקף", () => {
    const createdAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
    assert.strictEqual(isExpired({ createdAt }), false);
  });

  test("סטטוס שנוצר לפני 25 שעות כבר פג תוקף", () => {
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    assert.strictEqual(isExpired({ createdAt }), true);
  });

  test("EXPIRY_MS שווה בדיוק ל-24 שעות", () => {
    assert.strictEqual(EXPIRY_MS, 24 * 60 * 60 * 1000);
  });

  test("תומך גם ב-Firestore Timestamp (אובייקט עם toDate())", () => {
    const fakeTimestamp = { toDate: () => new Date(Date.now() - 25 * 60 * 60 * 1000) };
    assert.strictEqual(isExpired({ createdAt: fakeTimestamp }), true);
  });
});
