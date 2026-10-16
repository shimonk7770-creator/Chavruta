// server/test/activeUser.test.js
// בדיקות למנגנון אכיפת השבתת משתמש (middleware/activeUser.js): מטמון קצר, ביטול מיידי, ו-fail-open בתקלת DB
const test = require("node:test");
const assert = require("node:assert");
const { createActiveUserGuard } = require("../middleware/activeUser");

test("משתמש פעיל / מושבת / לא קיים", async () => {
  const users = { a: { isActive: true }, b: { isActive: false }, c: {} };
  const guard = createActiveUserGuard({ findUser: async (id) => users[id] || null });
  assert.strictEqual(await guard.isActive("a"), true);
  assert.strictEqual(await guard.isActive("b"), false);
  assert.strictEqual(await guard.isActive("c"), true); // בלי שדה isActive = פעיל (משתמשים ישנים)
  assert.strictEqual(await guard.isActive("zzz"), false);
});

test("מטמון: אין קריאה חוזרת בתוך ה-TTL, יש אחרי פקיעה, ו-invalidate מבטל מיד", async () => {
  let t = 0, reads = 0;
  const user = { isActive: true };
  const guard = createActiveUserGuard({ findUser: async () => { reads++; return user; }, ttlMs: 1000, now: () => t });
  await guard.isActive("u"); await guard.isActive("u");
  assert.strictEqual(reads, 1);
  user.isActive = false;
  assert.strictEqual(await guard.isActive("u"), true); // עדיין מהמטמון
  guard.invalidate("u");
  assert.strictEqual(await guard.isActive("u"), false); // השבתה נכנסת לתוקף מיד
  user.isActive = true; t = 5000;
  assert.strictEqual(await guard.isActive("u"), true); // אחרי פקיעת ה-TTL
  assert.strictEqual(reads, 3);
});

test("תקלת DB: לא מנתקים משתמשים (fail-open) ולא שומרים במטמון", async () => {
  let fail = true, reads = 0;
  const guard = createActiveUserGuard({ findUser: async () => { reads++; if (fail) throw new Error("db"); return { isActive: false }; } });
  assert.strictEqual(await guard.isActive("u"), true);
  fail = false;
  assert.strictEqual(await guard.isActive("u"), false); // נבדק שוב כי התקלה לא נשמרה
  assert.strictEqual(reads, 2);
});
