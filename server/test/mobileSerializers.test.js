// server/test/mobileSerializers.test.js
// בדיקות ל-utils/mobileSerializers.js - הפיכת מסמכי Firestore ל-JSON נקי לאפליקציית המובייל
const test = require("node:test");
const assert = require("node:assert");
const s = require("../utils/mobileSerializers");

const req = { protocol: "http", get: () => "192.168.1.5:3000" };

test("toAbsoluteUrl: כתובת יחסית הופכת למלאה, מלאה נשארת, ריקה נשארת ריקה", () => {
  assert.strictEqual(s.toAbsoluteUrl(req, "/uploads/a.jpg"), "http://192.168.1.5:3000/uploads/a.jpg");
  assert.strictEqual(s.toAbsoluteUrl(req, "https://x.com/a.jpg"), "https://x.com/a.jpg");
  assert.strictEqual(s.toAbsoluteUrl(req, ""), "");
  assert.strictEqual(s.toAbsoluteUrl(req, undefined), "");
});

test("toIso: Timestamp של Firestore, Date, מחרוזת, וערך לא תקין", () => {
  const d = new Date("2026-10-07T10:00:00.000Z");
  assert.strictEqual(s.toIso({ toDate: () => d }), "2026-10-07T10:00:00.000Z");
  assert.strictEqual(s.toIso(d), "2026-10-07T10:00:00.000Z");
  assert.strictEqual(s.toIso("2026-10-07T10:00:00.000Z"), "2026-10-07T10:00:00.000Z");
  assert.strictEqual(s.toIso(null), "");
  assert.strictEqual(s.toIso("לא תאריך"), "");
});

test("serializeGroup: מסמן isMember/isManager וסופר חברים, ותמונת הקבוצה הופכת לכתובת מלאה", () => {
  const group = { id: "g1", name: "דף יומי", managerId: "u1", members: ["u1", "u2"], groupPhotoUrl: "/uploads/g.png" };
  const asManager = s.serializeGroup(req, group, "u1");
  assert.deepStrictEqual([asManager.isMember, asManager.isManager, asManager.memberCount], [true, true, 2]);
  assert.strictEqual(asManager.groupPhotoUrl, "http://192.168.1.5:3000/uploads/g.png");
  const stranger = s.serializeGroup(req, group, "u9");
  assert.deepStrictEqual([stranger.isMember, stranger.isManager], [false, false]);
  // קבוצה "חסרה" (בלי members/שדות) לא קורסת
  assert.strictEqual(s.serializeGroup(req, { id: "g2" }, "u1").memberCount, 0);
});

test("serializePost: לא מדליף hash פנימי, תאריך ב-ISO, וכלל canDelete (בעלים/מנהל קבוצה/אדמין/זר)", () => {
  const post = { id: "p1", title: "כ", content: "ת", authorId: "u2", createdAt: new Date("2026-01-01T00:00:00Z"), aiSummaryHash: "SECRET", imageUrls: ["/uploads/1.jpg"] };
  const asOwner = s.serializePost(req, post, { id: "u2", role: "member" }, "u1");
  assert.strictEqual(asOwner.canDelete, true);
  assert.strictEqual(asOwner.createdAt, "2026-01-01T00:00:00.000Z");
  assert.deepStrictEqual(asOwner.imageUrls, ["http://192.168.1.5:3000/uploads/1.jpg"]);
  assert.ok(!("aiSummaryHash" in asOwner));
  assert.strictEqual(s.serializePost(req, post, { id: "u1", role: "member" }, "u1").canDelete, true); // מנהל הקבוצה
  assert.strictEqual(s.serializePost(req, post, { id: "u7", role: "admin" }, "u1").canDelete, true); // אדמין
  assert.strictEqual(s.serializePost(req, post, { id: "u7", role: "member" }, "u1").canDelete, false); // זר
});

test("serializeComment ו-serializeMember: שדות נכונים ובלי סיסמה", () => {
  const c = s.serializeComment({ id: "c1", postId: "p1", authorId: "u2", content: "שלום", createdAt: new Date(0) }, { id: "u2", role: "member" }, "u1");
  assert.deepStrictEqual([c.canDelete, c.content], [true, "שלום"]);
  const m = s.serializeMember(req, { id: "u1", fullName: "א", username: "a", avatarUrl: "/uploads/a.png", passwordHash: "X" }, { managerId: "u1" });
  assert.ok(!("passwordHash" in m));
  assert.deepStrictEqual([m.isManager, m.avatarUrl], [true, "http://192.168.1.5:3000/uploads/a.png"]);
});
