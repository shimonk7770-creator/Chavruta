// server/test/relevanceIntegration.test.js
// בדיקת חיבור: בקר ה-API של המובייל חוסם פוסט/תגובה שלא מתאימים למדור (422, בלי שמירה),
// ומפרסם עם aiCheck="unchecked" כשה-AI לא זמין (fail-open). שירות הרלוונטיות מוחלף ב-require.cache.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}

const state = { posts: [], comments: [], verdict: { status: "approved", reason: "" }, lastCheck: null };
const group = { id: "section_kodesh", name: "מסירת מוצרי קדושה", sectionKey: "kodesh", managerId: "system", members: ["u1"] };
const plainGroup = { id: "g2", name: "רגילה", sectionKey: "", managerId: "m", members: ["u1"] };
stub("models/Group.js", { findById: async (id) => [group, plainGroup].find((g) => g.id === id) || null, addMember: async () => group, removeMember: async () => group, listAll: async () => [group], findByMember: async () => [] });
stub("models/Post.js", {
  findById: async (id) => ({ id, groupId: group.id, title: "סידורים", authorId: "u9" }),
  create: async (d) => { const p = { id: "p1", createdAt: new Date(0), ...d }; state.posts.push(p); return p; },
});
stub("models/Comment.js", { create: async (d) => { const c = { id: "c1", createdAt: new Date(0), ...d }; state.comments.push(c); return c; } });
stub("models/User.js", { findById: async () => ({ id: "u1", fullName: "משתמש", role: "member", isActive: true }) });
stub("models/Notification.js", { create: async (n) => n });
stub("sockets/ioInstance.js", { getIo: () => null });
stub("services/relevanceService.js", {
  checkRelevance: async (input) => { state.lastCheck = input; return state.verdict; },
  rejectionMessage: (section, kind, reason) => `נחסם: ${section.name} ${reason}`,
});
const ctrl = require("../controllers/mobileGroupsController");

const mkRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const mkReq = (over) => ({ protocol: "http", get: () => "h", params: {}, query: {}, body: {}, mobileUserId: "u1", ...over });

test("פוסט שנחסם ע\"י AI: 422 OFF_TOPIC ולא נשמר", async () => {
  state.posts = []; state.verdict = { status: "rejected", reason: "חולצות אינן מוצרי קדושה" };
  const res = mkRes();
  await ctrl.createPost(mkReq({ params: { id: group.id }, body: { title: "חולצות", content: "מוסר חולצות" } }), res, (e) => { throw e; });
  assert.strictEqual(res.code, 422);
  assert.strictEqual(res.body.code, "OFF_TOPIC");
  assert.match(res.body.message, /חולצות אינן מוצרי קדושה/);
  assert.strictEqual(state.posts.length, 0);
  assert.strictEqual(state.lastCheck.section.key, "kodesh");
});

test("פוסט עם AI לא זמין: מתפרסם עם aiCheck=unchecked (fail-open)", async () => {
  state.posts = []; state.verdict = { status: "unchecked", reason: "" };
  const res = mkRes();
  await ctrl.createPost(mkReq({ params: { id: group.id }, body: { title: "סידורים", content: "מוסר סידורים" } }), res, (e) => { throw e; });
  assert.strictEqual(res.code, 201);
  assert.strictEqual(state.posts[0].aiCheck, "unchecked");
});

test("קבוצה רגילה: נשלח section=null (לא נבדק) והפוסט מתפרסם", async () => {
  state.posts = []; state.verdict = { status: "skipped", reason: "" };
  const res = mkRes();
  await ctrl.createPost(mkReq({ params: { id: plainGroup.id }, body: { title: "נושא", content: "תוכן" } }), res, (e) => { throw e; });
  assert.strictEqual(res.code, 201);
  assert.strictEqual(state.lastCheck.section, null);
});

test("תגובה שנחסמה: 422 ולא נשמרה; תגובה מאושרת נשמרת עם aiCheck", async () => {
  state.comments = []; state.verdict = { status: "rejected", reason: "לא קשור" };
  let res = mkRes();
  await ctrl.addComment(mkReq({ params: { id: "p1" }, body: { content: "מוכר טלפונים זולים" } }), res, (e) => { throw e; });
  assert.strictEqual(res.code, 422);
  assert.strictEqual(state.comments.length, 0);
  state.verdict = { status: "approved", reason: "" };
  res = mkRes();
  await ctrl.addComment(mkReq({ params: { id: "p1" }, body: { content: "מעוניין מאוד בסידורים" } }), res, (e) => { throw e; });
  assert.strictEqual(res.code, 201);
  assert.strictEqual(state.comments[0].aiCheck, "approved");
  assert.strictEqual(state.lastCheck.kind, "comment");
  assert.strictEqual(state.lastCheck.context, "סידורים");
});
