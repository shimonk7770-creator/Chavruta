// server/test/googleLogin.test.js
// בדיקות להתחברות עם Google: ולידציית טוקן, בחירת שם משתמש פנוי, הגדרות דפדפן, ושירות ההתחברות (עם תלויות מוזרקות)
const test = require("node:test");
const assert = require("node:assert/strict");

const G = require("../utils/googleAuth");
const { signInWithGoogle } = require("../services/googleLoginService");

test("validateClaims: דורש אימייל מאומת", () => {
  assert.equal(G.validateClaims(null).ok, false);
  assert.equal(G.validateClaims({ uid: "u" }).reason, "noEmail");
  assert.equal(G.validateClaims({ email: "a@b.com", email_verified: false }).reason, "unverified");
  const ok = G.validateClaims({ uid: "u1", email: " Dan@Gmail.com ", email_verified: true, name: "דן", picture: "http://x/p.jpg" });
  assert.deepEqual([ok.ok, ok.email, ok.name, ok.uid], [true, "dan@gmail.com", "דן", "u1"]);
});

test("validateClaims: בלי שם - משתמשים בחלק המקומי של האימייל", () => {
  assert.equal(G.validateClaims({ email: "moshe@x.com", email_verified: true }).name, "moshe");
});

test("baseUsername: מנקה תווים ושומר על אורך תקין", () => {
  assert.equal(G.baseUsername("dan.cohen+t@gmail.com"), "dancohent");
  assert.ok(G.baseUsername("a@b.com").length >= 3);
  assert.ok(G.baseUsername("averyveryveryverylongusername@x.com").length <= 15);
});

test("pickUsername: מדלג על שמות תפוסים", async () => {
  const taken = new Set(["dan", "dan2"]);
  const picked = await G.pickUsername("dan@x.com", async (u) => taken.has(u));
  assert.equal(picked, "dan3");
});

test("pickUsername: אם הכול תפוס - סיומת אקראית", async () => {
  const picked = await G.pickUsername("dan@x.com", async () => true, () => 0.5);
  assert.match(picked, /^dan\d{5}$/);
});

test("buildWebConfig: null בלי מפתח, ו-authDomain ברירת מחדל", () => {
  assert.equal(G.buildWebConfig({}, "proj"), null);
  assert.equal(G.buildWebConfig({ FIREBASE_WEB_API_KEY: "k" }, ""), null);
  assert.deepEqual(G.buildWebConfig({ FIREBASE_WEB_API_KEY: "k" }, "proj"), {
    apiKey: "k",
    authDomain: "proj.firebaseapp.com",
    projectId: "proj",
  });
});

// תלויות מזויפות לשירות
function fakeUsers(initial = []) {
  const list = [...initial];
  return {
    list,
    findByEmail: async (e) => list.find((u) => u.email === e) || null,
    findByUsername: async (n) => list.find((u) => u.username === n) || null,
    create: async (d) => {
      const u = { id: `id${list.length + 1}`, isActive: true, ...d };
      list.push(u);
      return u;
    },
  };
}
const goodToken = async () => ({ uid: "g1", email: "new@x.com", email_verified: true, name: "חדש" });

test("signInWithGoogle: טוקן לא תקין נדחה", async () => {
  const r = await signInWithGoogle("bad", { verify: async () => { throw new Error("bad"); }, users: fakeUsers() });
  assert.deepEqual([r.ok, r.reason], [false, "invalid"]);
  assert.equal((await signInWithGoogle("", { users: fakeUsers() })).reason, "noToken");
});

test("signInWithGoogle: אימייל חדש יוצר חבר חדש עם סיסמה אקראית", async () => {
  const users = fakeUsers();
  const r = await signInWithGoogle("t", { verify: goodToken, users, hash: async (s) => `h:${s.length}` });
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  assert.equal(r.user.role, "member");
  assert.equal(r.user.username, "new");
  assert.match(r.user.passwordHash, /^h:64$/);
});

test("signInWithGoogle: אימייל קיים מתחבר לאותו חשבון בלי ליצור כפילות", async () => {
  const users = fakeUsers([{ id: "u1", email: "new@x.com", username: "new", isActive: true, role: "admin" }]);
  const r = await signInWithGoogle("t", { verify: goodToken, users });
  assert.deepEqual([r.ok, r.created, r.user.id], [true, false, "u1"]);
  assert.equal(users.list.length, 1);
});

test("signInWithGoogle: חשבון לא פעיל נדחה, ואימייל לא מאומת נדחה", async () => {
  const users = fakeUsers([{ id: "u1", email: "new@x.com", username: "new", isActive: false }]);
  assert.equal((await signInWithGoogle("t", { verify: goodToken, users })).reason, "inactive");
  const unverified = async () => ({ email: "z@x.com", email_verified: false });
  assert.equal((await signInWithGoogle("t", { verify: unverified, users: fakeUsers() })).reason, "unverified");
});
