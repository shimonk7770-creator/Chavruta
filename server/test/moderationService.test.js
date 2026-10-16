// server/test/moderationService.test.js
// בדיקות לשירות הדיווח והניהול (services/moderationService.js) עם מודלים מדומים (בלי Firestore ובלי רשת):
// יצירת דיווח (כולל מקרי קצה: עצמי/כפול/לא קיים), סגירת דיווח (הסרה/דחייה) ואישור/הסרת תוכן שלא נבדק
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}

const state = { posts: {}, comments: {}, reports: [], removed: [], archivedFor: [], aiChecks: [], resolvedAll: [] };
stub("models/Post.js", {
  findById: async (id) => state.posts[id] || null,
  remove: async (id) => { state.removed.push("post:" + id); delete state.posts[id]; },
  setAiCheck: async (id, v) => { state.aiChecks.push(["post", id, v]); },
});
stub("models/Comment.js", {
  findById: async (id) => state.comments[id] || null,
  remove: async (id) => { state.removed.push("comment:" + id); delete state.comments[id]; },
  archiveByPost: async (id) => { state.archivedFor.push(id); },
  setAiCheck: async (id, v) => { state.aiChecks.push(["comment", id, v]); },
});
stub("models/Group.js", { findById: async (id) => (id === "g1" ? { id: "g1", name: "מסירת מוצרי קדושה" } : null) });
stub("models/Report.js", {
  hasOpenReportBy: async (uid, type, id) => state.reports.some((r) => r.reporterId === uid && r.targetType === type && r.targetId === id && r.status === "open"),
  create: async (d) => { const r = { id: "r" + (state.reports.length + 1), status: "open", ...d }; state.reports.push(r); return r; },
  findById: async (id) => state.reports.find((r) => r.id === id) || null,
  resolve: async (id, status) => { state.reports.find((r) => r.id === id).status = status; },
  resolveAllForTarget: async (type, id, status) => { state.resolvedAll.push([type, id, status]); },
});
const svc = require("../services/moderationService");

function reset() {
  state.posts = { p1: { id: "p1", groupId: "g1", title: "סידורים", content: "מוסר", authorId: "author", authorName: "מחבר" } };
  state.comments = { c1: { id: "c1", postId: "p1", content: "תגובה", authorId: "author", authorName: "מחבר" } };
  state.reports = []; state.removed = []; state.archivedFor = []; state.aiChecks = []; state.resolvedAll = [];
}
const reporter = { id: "u1", name: "מדווח" };

test("submitReport: יוצר דיווח עם צילום מצב ושם הקבוצה", async () => {
  reset();
  const r = await svc.submitReport({ reporter, targetType: "post", targetId: "p1", reason: "spam", details: "x" });
  assert.strictEqual(r.status, "created");
  assert.strictEqual(r.report.groupName, "מסירת מוצרי קדושה");
  assert.strictEqual(r.report.snapshot.content, "מוסר");
  assert.strictEqual(r.report.snapshot.authorName, "מחבר");
});

test("submitReport: תגובה מדווחת עם כותרת הפוסט שמעליה", async () => {
  reset();
  const r = await svc.submitReport({ reporter, targetType: "comment", targetId: "c1", reason: "offensive" });
  assert.strictEqual(r.status, "created");
  assert.match(r.report.snapshot.title, /סידורים/);
  assert.strictEqual(r.report.groupId, "g1");
});

test("submitReport: דיווח על עצמי, כפול, לא קיים ולא תקין נדחים", async () => {
  reset();
  assert.strictEqual((await svc.submitReport({ reporter: { id: "author", name: "x" }, targetType: "post", targetId: "p1", reason: "spam" })).status, "self");
  assert.strictEqual((await svc.submitReport({ reporter, targetType: "post", targetId: "p1", reason: "spam" })).status, "created");
  assert.strictEqual((await svc.submitReport({ reporter, targetType: "post", targetId: "p1", reason: "other" })).status, "duplicate");
  assert.strictEqual((await svc.submitReport({ reporter, targetType: "post", targetId: "nope", reason: "spam" })).status, "notFound");
  assert.strictEqual((await svc.submitReport({ reporter, targetType: "post", targetId: "p1", reason: "bad" })).status, "invalid");
  assert.strictEqual(state.reports.length, 1);
});

test("resolveReport: remove מוחק פוסט (ומארכב תגובות) וסוגר את כל הדיווחים; dismiss רק דוחה", async () => {
  reset();
  await svc.submitReport({ reporter, targetType: "post", targetId: "p1", reason: "spam" });
  const res = await svc.resolveReport("r1", "remove", "admin1");
  assert.deepStrictEqual(res, { status: "ok", removed: true });
  assert.deepStrictEqual(state.removed, ["post:p1"]);
  assert.deepStrictEqual(state.archivedFor, ["p1"]);
  assert.deepStrictEqual(state.resolvedAll[0], ["post", "p1", "removed"]);

  reset();
  await svc.submitReport({ reporter, targetType: "comment", targetId: "c1", reason: "spam" });
  assert.deepStrictEqual(await svc.resolveReport("r1", "dismiss", "admin1"), { status: "ok", removed: false });
  assert.strictEqual(state.reports[0].status, "dismissed");
  assert.deepStrictEqual(state.removed, []);
  assert.strictEqual((await svc.resolveReport("nope", "dismiss", "a")).status, "notFound");
  assert.strictEqual((await svc.resolveReport("r1", "weird", "a")).status, "invalid");
});

test("reviewUnchecked: approve מסמן כמאושר, remove מוחק, וסוג לא תקין נדחה", async () => {
  reset();
  assert.strictEqual((await svc.reviewUnchecked("post", "p1", "approve", "a")).status, "ok");
  assert.deepStrictEqual(state.aiChecks[0], ["post", "p1", "approved"]);
  const removed = await svc.reviewUnchecked("comment", "c1", "remove", "a");
  assert.strictEqual(removed.removed, true);
  assert.deepStrictEqual(state.removed, ["comment:c1"]);
  assert.strictEqual((await svc.reviewUnchecked("user", "x", "approve", "a")).status, "invalid");
  assert.strictEqual((await svc.reviewUnchecked("post", "p1", "nuke", "a")).status, "invalid");
});
