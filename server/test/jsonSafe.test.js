// בדיקות ל-utils/jsonSafe.js ול-utils/bridgeResponse.js - הגשר שמאפשר לאפליקציה להשתמש בבקרים של האתר
const test = require("node:test");
const assert = require("node:assert");
const { jsonSafe } = require("../utils/jsonSafe");
const { adaptResponse, parseRedirectOutcome } = require("../utils/bridgeResponse");
const { makeRouterAsyncSafe } = require("../utils/asyncSafe");

test("jsonSafe: Timestamp של Firestore הופך למחרוזת ISO", () => {
  const ts = { toDate: () => new Date("2026-01-02T03:04:05.000Z") };
  assert.strictEqual(jsonSafe(ts), "2026-01-02T03:04:05.000Z");
  assert.strictEqual(jsonSafe({ _seconds: 0, _nanoseconds: 0 }), "1970-01-01T00:00:00.000Z");
});

test("jsonSafe: שדות רגישים לא יוצאים החוצה גם בתוך מערכים מקוננים", () => {
  const out = jsonSafe({ users: [{ id: "1", fullName: "א", passwordHash: "x", lockUntil: "y", loginAttempts: 3 }] });
  assert.deepStrictEqual(out, { users: [{ id: "1", fullName: "א" }] });
});

test("jsonSafe: פונקציות מוסרות ועומק מוגבל", () => {
  assert.deepStrictEqual(jsonSafe({ a: 1, f() {} }), { a: 1 });
  const loop = {};
  loop.self = loop;
  assert.doesNotThrow(() => JSON.stringify(jsonSafe(loop)));
});

test("parseRedirectOutcome: error/memberError הן כישלון, message הצלחה", () => {
  assert.deepStrictEqual(parseRedirectOutcome("/groups/1?memberError=%D7%A9%D7%92%D7%99%D7%90%D7%94"), { success: false, message: "שגיאה" });
  assert.deepStrictEqual(parseRedirectOutcome("/admin/users?message=ok"), { success: true, message: "ok" });
  assert.deepStrictEqual(parseRedirectOutcome("/learning"), { success: true, message: "" });
});

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return adaptResponse(res);
}

test("bridgeResponse: render מחזיר JSON עם data, ושגיאת טופס הופכת ל-400", () => {
  const ok = fakeRes();
  ok.render("minyanim/index", { results: [1], when: { toDate: () => new Date(0) } });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.body.success, true);
  assert.strictEqual(ok.body.data.when, "1970-01-01T00:00:00.000Z");

  const bad = fakeRes();
  bad.render("learning/index", { error: "יש למלא תאריך", logs: [] });
  assert.strictEqual(bad.statusCode, 400);
  assert.strictEqual(bad.body.success, false);
  assert.strictEqual(bad.body.message, "יש למלא תאריך");
});

test("bridgeResponse: redirect מחזיר JSON (הצלחה / שגיאה)", () => {
  const ok = fakeRes();
  ok.redirect("/learning");
  assert.deepStrictEqual(ok.body, { success: true, redirect: "/learning", message: "" });
  const bad = fakeRes();
  bad.redirect(302, "/admin/users?error=no");
  assert.strictEqual(bad.statusCode, 400);
  assert.strictEqual(bad.body.message, "no");
});

test("asyncSafe: דחיית Promise בבקר מועברת ל-next", async () => {
  const router = { stack: [{ route: { stack: [{ handle: async () => { throw new Error("boom"); } }] } }] };
  makeRouterAsyncSafe(router);
  let received = null;
  router.stack[0].route.stack[0].handle({}, {}, (err) => (received = err));
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(received.message, "boom");
});
