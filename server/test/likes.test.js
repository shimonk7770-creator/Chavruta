// server/test/likes.test.js
// בדיקות ללייקים ❤️: הלוגיקה הטהורה (utils/likes.js), שירות הלייק עם התראה (services/likeService.js),
// וסידור התוצאה של הפוסט/תגובה למובייל. המודלים מוחלפים ב-require.cache (בלי Firestore).
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { likedByOf, likeSummary, toggleInList } = require("../utils/likes");

test("toggleInList: מוסיף לייק, מסיר בלחיצה שנייה, ולא יוצר כפילות", () => {
  let r = toggleInList(undefined, "u1");
  assert.deepStrictEqual(r, { likedBy: ["u1"], liked: true });
  r = toggleInList(r.likedBy, "u2");
  assert.deepStrictEqual(r.likedBy, ["u1", "u2"]);
  r = toggleInList(r.likedBy, "u1");
  assert.deepStrictEqual(r, { likedBy: ["u2"], liked: false });
});

test("likeSummary: ספירה ו-likedByMe בלי לחשוף את הרשימה", () => {
  assert.deepStrictEqual(likeSummary({ likedBy: ["a", "b"] }, "a"), { likeCount: 2, likedByMe: true });
  assert.deepStrictEqual(likeSummary({ likedBy: ["a"] }, "z"), { likeCount: 1, likedByMe: false });
  assert.deepStrictEqual(likeSummary({}, "z"), { likeCount: 0, likedByMe: false });
  assert.deepStrictEqual(likeSummary({ likedBy: ["a"] }, undefined), { likeCount: 1, likedByMe: false });
  assert.deepStrictEqual(likedByOf(null), []);
});

// ---- שירות הלייק ----
function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}
const state = { lists: { post: {}, comment: {} }, notifs: [], notifError: null };
const makeModel = (kind) => ({
  toggleLike: async (id, uid) => {
    const item = state.lists[kind][id];
    if (!item) return null;
    const r = toggleInList(item.likedBy, uid);
    item.likedBy = r.likedBy;
    return { liked: r.liked, likeCount: r.likedBy.length, authorId: item.authorId };
  },
});
stub("models/Post.js", makeModel("post"));
stub("models/Comment.js", makeModel("comment"));
stub("models/Notification.js", { create: async (n) => { if (state.notifError) throw state.notifError; state.notifs.push(n); return n; } });
stub("sockets/ioInstance.js", { getIo: () => null });
const svc = require("../services/likeService");

test("toggleLike: לייק, ביטול, התראה לכותב רק בלייק חדש ולא על לייק עצמי", async () => {
  state.lists.post = { p1: { authorId: "author", likedBy: [] } };
  state.notifs = [];
  const actor = { id: "u1", name: "דני" };
  assert.deepStrictEqual(await svc.toggleLike({ targetType: "post", targetId: "p1", actor }), { status: "ok", liked: true, likeCount: 1 });
  assert.strictEqual(state.notifs.length, 1);
  assert.strictEqual(state.notifs[0].userId, "author");
  assert.match(state.notifs[0].text, /דני אהב\/ה את הפוסט/);
  assert.deepStrictEqual(await svc.toggleLike({ targetType: "post", targetId: "p1", actor }), { status: "ok", liked: false, likeCount: 0 });
  assert.strictEqual(state.notifs.length, 1); // ביטול לא שולח התראה
  await svc.toggleLike({ targetType: "post", targetId: "p1", actor: { id: "author", name: "הכותב" } });
  assert.strictEqual(state.notifs.length, 1); // לייק עצמי - בלי התראה
});

test("toggleLike: תגובה, לא קיים, סוג לא תקין, וכישלון התראה לא מפיל את הלייק", async () => {
  state.lists.comment = { c1: { authorId: "a", likedBy: [] } };
  state.notifError = new Error("boom");
  const orig = console.error;
  console.error = () => {};
  const r = await svc.toggleLike({ targetType: "comment", targetId: "c1", actor: { id: "u9", name: "x" } });
  console.error = orig;
  state.notifError = null;
  assert.deepStrictEqual(r, { status: "ok", liked: true, likeCount: 1 });
  assert.strictEqual((await svc.toggleLike({ targetType: "comment", targetId: "nope", actor: { id: "u" } })).status, "notFound");
  assert.strictEqual((await svc.toggleLike({ targetType: "user", targetId: "x", actor: { id: "u" } })).status, "invalid");
  assert.strictEqual((await svc.toggleLike({ targetType: "post", targetId: "", actor: { id: "u" } })).status, "invalid");
});

test("סידור למובייל: likeCount ו-likedByMe מוחזרים והרשימה לא נחשפת", () => {
  const { serializePost, serializeComment } = require("../utils/mobileSerializers");
  const req = { protocol: "http", get: () => "h" };
  const actor = { id: "me", role: "member" };
  const post = serializePost(req, { id: "p", authorId: "x", likedBy: ["me", "b"], createdAt: new Date(0) }, actor, "m");
  assert.strictEqual(post.likeCount, 2);
  assert.strictEqual(post.likedByMe, true);
  assert.ok(!("likedBy" in post));
  const c = serializeComment({ id: "c", authorId: "x", likedBy: [], createdAt: new Date(0) }, actor, "m");
  assert.deepStrictEqual([c.likeCount, c.likedByMe], [0, false]);
});
