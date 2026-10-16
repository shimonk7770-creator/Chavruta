// server/test/mobileGroupsController.test.js
// בדיקות לבקר הקבוצות של המובייל (controllers/mobileGroupsController.js) עם מודלים מדומים (בלי Firestore ובלי רשת):
// הרשאות (חבר/בעלים/מנהל קבוצה/אדמין), ולידציה, ניקוי XSS, התראות ותגובה לחשבון לא פעיל
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

// מחליפים ב-require.cache את המודלים לפני שטוענים את הבקר
function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}

const state = { groups: [], posts: [], comments: [], users: {}, notifications: [], notifError: null, removed: [] };
stub("models/Group.js", {
  listAll: async () => state.groups,
  findById: async (id) => state.groups.find((g) => g.id === id) || null,
  addMember: async (id, uid) => {
    const g = state.groups.find((x) => x.id === id);
    if (!g) return null;
    if (!g.members.includes(uid)) g.members.push(uid);
    return g;
  },
  removeMember: async (id, uid) => {
    const g = state.groups.find((x) => x.id === id);
    if (!g) return null;
    g.members = g.members.filter((m) => m !== uid);
    return g;
  },
});
stub("models/Post.js", {
  findById: async (id) => state.posts.find((p) => p.id === id) || null,
  listByGroup: async (gid) => state.posts.filter((p) => p.groupId === gid),
  create: async (data) => { const p = { id: "newp", createdAt: new Date(0), ...data }; state.posts.push(p); return p; },
  remove: async (id) => { state.removed.push(id); },
});
stub("models/Comment.js", {
  findById: async (id) => state.comments.find((c) => c.id === id) || null,
  listByPost: async (pid) => state.comments.filter((c) => c.postId === pid),
  create: async (data) => { const c = { id: "newc", createdAt: new Date(0), ...data }; state.comments.push(c); return c; },
  remove: async (id) => { state.removed.push(id); },
});
stub("models/User.js", { findById: async (id) => state.users[id] || null });
stub("models/Notification.js", {
  create: async (n) => { if (state.notifError) throw state.notifError; state.notifications.push(n); return n; },
});
stub("sockets/ioInstance.js", { getIo: () => null });
const ctrl = require("../controllers/mobileGroupsController");

const baseReq = (over = {}) => ({ protocol: "http", get: () => "h:3000", params: {}, query: {}, body: {}, mobileUserId: "u2", ...over });
function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const next = (e) => { throw e; };

function reset() {
  state.groups = [{ id: "g1", name: "דף יומי", topic: "גמרא", managerId: "u1", managerName: "מנהל", members: ["u1", "u2"] }, { id: "g2", name: "פרשת שבוע", topic: "תורה", managerId: "u1", members: ["u1"] }];
  state.posts = [{ id: "p1", groupId: "g1", title: "כותרת", content: "תוכן", authorId: "u2", authorName: "ב" }];
  state.comments = [{ id: "c1", postId: "p1", authorId: "u2", authorName: "ב", content: "תגובה" }];
  state.users = {
    u1: { id: "u1", fullName: "מנהל", username: "m", role: "member", isActive: true },
    u2: { id: "u2", fullName: "בעל פוסט", username: "b", role: "member", isActive: true },
    u3: { id: "u3", fullName: "זר", username: "z", role: "member", isActive: true },
    u9: { id: "u9", fullName: "אדמין", username: "a", role: "admin", isActive: true },
    u5: { id: "u5", fullName: "נמחק", username: "d", role: "member", isActive: false },
  };
  state.notifications = []; state.notifError = null; state.removed = [];
}

test("listGroups: מחזיר הכול, מסנן לפי q ו-mine=1", async () => {
  reset();
  let res = mockRes();
  await ctrl.listGroups(baseReq(), res, next);
  assert.strictEqual(res.body.groups.length, 2);
  res = mockRes();
  await ctrl.listGroups(baseReq({ query: { q: "גמרא" } }), res, next);
  assert.deepStrictEqual(res.body.groups.map((g) => g.id), ["g1"]);
  res = mockRes();
  await ctrl.listGroups(baseReq({ query: { mine: "1" } }), res, next); // u2 חבר רק ב-g1
  assert.deepStrictEqual(res.body.groups.map((g) => g.id), ["g1"]);
});

test("getGroup: 404 לקבוצה לא קיימת; אחרת פרטים+חברים+פוסטים עם canDelete", async () => {
  reset();
  let res = mockRes();
  await ctrl.getGroup(baseReq({ params: { id: "nope" } }), res, next);
  assert.strictEqual(res.statusCode, 404);
  res = mockRes();
  await ctrl.getGroup(baseReq({ params: { id: "g1" } }), res, next);
  assert.strictEqual(res.body.group.isMember, true);
  assert.deepStrictEqual(res.body.members.map((m) => m.id), ["u1", "u2"]);
  assert.strictEqual(res.body.posts[0].canDelete, true); // u2 הוא בעל הפוסט
});

test("חשבון לא פעיל (נמחק) מקבל 401 בפעולות שדורשות פרטי משתמש", async () => {
  reset();
  const res = mockRes();
  await ctrl.getGroup(baseReq({ params: { id: "g1" }, mobileUserId: "u5" }), res, next);
  assert.strictEqual(res.statusCode, 401);
});

test("join/leave: הצטרפות, 404, ומנהל הקבוצה לא יכול לעזוב", async () => {
  reset();
  let res = mockRes();
  await ctrl.joinGroup(baseReq({ params: { id: "g2" } }), res, next);
  assert.strictEqual(res.body.group.isMember, true);
  res = mockRes();
  await ctrl.joinGroup(baseReq({ params: { id: "none" } }), res, next);
  assert.strictEqual(res.statusCode, 404);
  res = mockRes();
  await ctrl.leaveGroup(baseReq({ params: { id: "g1" }, mobileUserId: "u1" }), res, next);
  assert.strictEqual(res.statusCode, 400);
  res = mockRes();
  await ctrl.leaveGroup(baseReq({ params: { id: "g1" } }), res, next);
  assert.strictEqual(res.body.group.isMember, false);
});

test("createPost: רק חבר קבוצה; ולידציה; ניקוי תגיות; קטגוריה לא תקינה -> update; המחבר נקבע בשרת", async () => {
  reset();
  let res = mockRes();
  await ctrl.createPost(baseReq({ params: { id: "g1" }, mobileUserId: "u3", body: { title: "א", content: "ב" } }), res, next);
  assert.strictEqual(res.statusCode, 403); // זר
  res = mockRes();
  await ctrl.createPost(baseReq({ params: { id: "g1" }, body: { title: "  ", content: "ב" } }), res, next);
  assert.strictEqual(res.statusCode, 400);
  res = mockRes();
  await ctrl.createPost(baseReq({ params: { id: "g1" }, body: { title: "כ".repeat(151), content: "ב" } }), res, next);
  assert.strictEqual(res.statusCode, 400);
  res = mockRes();
  await ctrl.createPost(baseReq({ params: { id: "g1" }, body: { title: "<b>כותרת</b>", content: "<script>alert(1)</script>טקסט", category: "hacker", authorName: "מתחזה", authorId: "u1" } }), res, next);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.post.title, "כותרת");
  assert.ok(!res.body.post.content.includes("<script"), "תגיות סקריפט אמורות להיות מנוקות");
  assert.strictEqual(res.body.post.category, "update");
  assert.strictEqual(res.body.post.authorId, "u2");
  assert.strictEqual(res.body.post.authorName, "בעל פוסט");
});

test("deletePost: זר 403, בעלים/מנהל קבוצה/אדמין מותר, לא קיים 404", async () => {
  reset();
  let res = mockRes();
  await ctrl.deletePost(baseReq({ params: { id: "p1" }, mobileUserId: "u3" }), res, next);
  assert.strictEqual(res.statusCode, 403);
  for (const uid of ["u2", "u1", "u9"]) {
    state.removed = [];
    res = mockRes();
    await ctrl.deletePost(baseReq({ params: { id: "p1" }, mobileUserId: uid }), res, next);
    assert.strictEqual(res.body.success, true, `משתמש ${uid} אמור להיות מורשה`);
    assert.deepStrictEqual(state.removed, ["p1"]);
  }
  res = mockRes();
  await ctrl.deletePost(baseReq({ params: { id: "zzz" } }), res, next);
  assert.strictEqual(res.statusCode, 404);
});

test("listComments: מחזיר תגובות עם canDelete; פוסט ארכיוני/לא קיים 404", async () => {
  reset();
  let res = mockRes();
  await ctrl.listComments(baseReq({ params: { id: "p1" } }), res, next);
  assert.strictEqual(res.body.comments.length, 1);
  assert.strictEqual(res.body.comments[0].canDelete, true);
  state.posts[0].isArchived = true;
  res = mockRes();
  await ctrl.listComments(baseReq({ params: { id: "p1" } }), res, next);
  assert.strictEqual(res.statusCode, 404);
});

test("addComment: תגובה ריקה/ארוכה נדחית, ניקוי תגיות, והתראה לבעל הפוסט רק כשמגיב מישהו אחר", async () => {
  reset();
  let res = mockRes();
  await ctrl.addComment(baseReq({ params: { id: "p1" }, body: { content: "<i></i>   " } }), res, next);
  assert.strictEqual(res.statusCode, 400);
  res = mockRes();
  await ctrl.addComment(baseReq({ params: { id: "p1" }, body: { content: "א".repeat(1001) } }), res, next);
  assert.strictEqual(res.statusCode, 400);

  res = mockRes(); // u2 מגיב על הפוסט של עצמו - בלי התראה
  await ctrl.addComment(baseReq({ params: { id: "p1" }, body: { content: "אני עצמי" } }), res, next);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(state.notifications.length, 0);

  res = mockRes(); // u3 מגיב - מגיעה התראה ל-u2
  await ctrl.addComment(baseReq({ params: { id: "p1" }, mobileUserId: "u3", body: { content: "<b>יפה</b>" } }), res, next);
  assert.strictEqual(res.body.comment.content, "יפה");
  assert.strictEqual(res.body.comment.authorName, "זר");
  assert.strictEqual(state.notifications.length, 1);
  assert.strictEqual(state.notifications[0].userId, "u2");
});

test("addComment: כישלון ביצירת התראה לא מפיל את התגובה", async () => {
  reset();
  state.notifError = new Error("boom");
  const res = mockRes();
  await ctrl.addComment(baseReq({ params: { id: "p1" }, mobileUserId: "u3", body: { content: "תגובה" } }), res, next);
  assert.strictEqual(res.statusCode, 201);
});

test("deleteComment: זר 403, בעלים/מנהל קבוצה/אדמין מותר, לא קיים 404", async () => {
  reset();
  let res = mockRes();
  await ctrl.deleteComment(baseReq({ params: { id: "c1" }, mobileUserId: "u3" }), res, next);
  assert.strictEqual(res.statusCode, 403);
  for (const uid of ["u2", "u1", "u9"]) {
    res = mockRes();
    await ctrl.deleteComment(baseReq({ params: { id: "c1" }, mobileUserId: uid }), res, next);
    assert.strictEqual(res.body.success, true, `משתמש ${uid} אמור להיות מורשה`);
  }
  res = mockRes();
  await ctrl.deleteComment(baseReq({ params: { id: "nope" } }), res, next);
  assert.strictEqual(res.statusCode, 404);
});
