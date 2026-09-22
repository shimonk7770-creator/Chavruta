// server/test/notificationRecipients.test.js
// בדיקות אוטומטיות (node:test) לפונקציה הטהורה שקובעת מי מקבל התראת פעמון על הודעת צ'אט חדשה.

const { test, describe } = require("node:test");
const assert = require("node:assert");
const { pickNotificationRecipients } = require("../utils/notificationRecipients");

describe("pickNotificationRecipients", () => {
  test("לא כולל את השולח עצמו", () => {
    const result = pickNotificationRecipients(["u1", "u2", "u3"], "u1", []);
    assert.deepStrictEqual(result, ["u2", "u3"]);
  });

  test("לא כולל חברים שכבר נמצאים (active) בחדר הצ'אט", () => {
    const result = pickNotificationRecipients(["u1", "u2", "u3"], "u1", ["u2"]);
    assert.deepStrictEqual(result, ["u3"]);
  });

  test("מקבל גם Set וגם מערך עבור activeUserIds", () => {
    const withSet = pickNotificationRecipients(["u1", "u2"], "u1", new Set(["u2"]));
    const withArray = pickNotificationRecipients(["u1", "u2"], "u1", ["u2"]);
    assert.deepStrictEqual(withSet, []);
    assert.deepStrictEqual(withArray, []);
  });

  test("מחזיר מערך ריק אם כולם או השולח או active", () => {
    const result = pickNotificationRecipients(["u1", "u2"], "u1", ["u2"]);
    assert.deepStrictEqual(result, []);
  });

  test("רשימת חברים ריקה/undefined לא קורסת", () => {
    assert.deepStrictEqual(pickNotificationRecipients([], "u1", []), []);
    assert.deepStrictEqual(pickNotificationRecipients(undefined, "u1", []), []);
  });
});
