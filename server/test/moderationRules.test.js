// server/test/moderationRules.test.js
// בדיקות לכללי הדיווח והניהול (utils/moderationRules.js): ולידציית דיווח, תוויות תפקיד, והגנות על פעולות אדמין
const test = require("node:test");
const assert = require("node:assert");
const { REPORT_REASONS, validateReport, roleLabel, canManageUser, userPatchFor } = require("../utils/moderationRules");

test("validateReport: דיווח תקין עובר וגם נחתך/מנוקה", () => {
  const r = validateReport({ targetType: "post", targetId: "p1", reason: "spam", details: "  הרבה   רווחים  " + "x".repeat(400) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.reason, "spam");
  assert.ok(r.value.details.length <= 300);
  assert.ok(!r.value.details.includes("  "));
});

test("validateReport: סוג/מזהה/סיבה לא תקינים נדחים", () => {
  assert.strictEqual(validateReport({ targetType: "user", targetId: "x", reason: "spam" }).ok, false);
  assert.strictEqual(validateReport({ targetType: "post", targetId: "", reason: "spam" }).ok, false);
  assert.strictEqual(validateReport({ targetType: "post", targetId: 5, reason: "spam" }).ok, false);
  assert.strictEqual(validateReport({ targetType: "post", targetId: "p", reason: "hack" }).ok, false);
  assert.strictEqual(validateReport({ targetType: "comment", targetId: "c", reason: "constructor" }).ok, false); // לא מקבלים מפתחות של Object
  assert.strictEqual(validateReport(null).ok, false);
  assert.ok(Object.keys(REPORT_REASONS).length >= 4);
});

test("roleLabel: אורח, חבר, מנהל קבוצה, מנהל מערכת", () => {
  assert.strictEqual(roleLabel(null), "אורח");
  assert.strictEqual(roleLabel("member"), "חבר קהילה");
  assert.strictEqual(roleLabel("member", { isGroupManager: true }), "מנהל קבוצה");
  assert.strictEqual(roleLabel("manager"), "מנהל קבוצה");
  assert.strictEqual(roleLabel("admin"), "מנהל מערכת");
});

test("canManageUser: רק אדמין, לא על עצמו, ולא מורידים את האדמין האחרון", () => {
  const admin = { id: "a1", role: "admin" };
  const member = { id: "m1", role: "member", isActive: true };
  assert.strictEqual(canManageUser({ actor: admin, target: member, action: "suspend", activeAdminCount: 1 }).ok, true);
  assert.strictEqual(canManageUser({ actor: { id: "m2", role: "member" }, target: member, action: "suspend", activeAdminCount: 1 }).ok, false);
  assert.strictEqual(canManageUser({ actor: admin, target: admin, action: "suspend", activeAdminCount: 2 }).ok, false); // לא על עצמי
  assert.strictEqual(canManageUser({ actor: admin, target: admin, action: "makeMember", activeAdminCount: 2 }).ok, false);
  const other = { id: "a2", role: "admin", isActive: true };
  assert.strictEqual(canManageUser({ actor: admin, target: other, action: "makeMember", activeAdminCount: 1 }).ok, false); // האדמין האחרון
  assert.strictEqual(canManageUser({ actor: admin, target: other, action: "makeMember", activeAdminCount: 2 }).ok, true);
  assert.strictEqual(canManageUser({ actor: admin, target: member, action: "delete", activeAdminCount: 2 }).ok, false);
  assert.strictEqual(canManageUser({ actor: admin, target: null, action: "suspend", activeAdminCount: 2 }).ok, false);
});

test("userPatchFor: מיפוי פעולה לשינוי ב-DB", () => {
  assert.deepStrictEqual(userPatchFor("suspend"), { isActive: false });
  assert.deepStrictEqual(userPatchFor("activate"), { isActive: true });
  assert.deepStrictEqual(userPatchFor("makeAdmin"), { role: "admin" });
  assert.deepStrictEqual(userPatchFor("makeMember"), { role: "member" });
  assert.strictEqual(userPatchFor("x"), null);
});
