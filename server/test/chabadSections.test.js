// server/test/chabadSections.test.js
// בדיקות ל"בית חב״ד": הגדרת המדורים הקבועים וכלל "חברות במדור אחד מכל סוג" (utils/chabadSections.js +
// services/groupMembershipService.js). המודל מוחלף ב-require.cache, לכן אין צורך ב-Firestore או ברשת.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { SECTIONS, SECTION_KEYS, sectionDocId, getSection, isSectionGroup, findSectionConflict } = require("../utils/chabadSections");

test("יש שישה מדורים קבועים עם מפתחות ייחודיים, שם ורמז נושא ל-AI", () => {
  assert.strictEqual(SECTIONS.length, 6);
  assert.strictEqual(new Set(SECTION_KEYS).size, 6);
  for (const s of SECTIONS) {
    assert.ok(s.name && s.emoji && s.description && s.topicHint, `חסר שדה במדור ${s.key}`);
  }
  assert.deepStrictEqual(SECTION_KEYS, ["tanya", "minyan", "torah", "women", "lostfound", "kodesh"]);
});

test("מזהה מסמך קבוע לכל מדור, ו-getSection מחזיר null למפתח לא מוכר", () => {
  assert.strictEqual(sectionDocId("kodesh"), "section_kodesh");
  assert.strictEqual(getSection("nope"), null);
  assert.strictEqual(getSection("tanya").name, "שיעור תניא");
});

test("isSectionGroup מזהה רק קבוצה עם sectionKey חוקי", () => {
  assert.strictEqual(isSectionGroup({ sectionKey: "torah" }), true);
  assert.strictEqual(isSectionGroup({ sectionKey: "" }), false);
  assert.strictEqual(isSectionGroup({ sectionKey: "nope" }), false);
  assert.strictEqual(isSectionGroup(null), false);
});

test("findSectionConflict: אותו sectionKey בקבוצה אחרת = התנגשות; קבוצה רגילה או מדור אחר = אין", () => {
  const mine = [{ id: "a", sectionKey: "kodesh" }, { id: "b", sectionKey: "tanya" }, { id: "c", sectionKey: "" }];
  assert.strictEqual(findSectionConflict(mine, { id: "x", sectionKey: "kodesh" }).id, "a");
  assert.strictEqual(findSectionConflict(mine, { id: "a", sectionKey: "kodesh" }), null); // אותה קבוצה - לא התנגשות עם עצמה
  assert.strictEqual(findSectionConflict(mine, { id: "y", sectionKey: "women" }), null);
  assert.strictEqual(findSectionConflict(mine, { id: "z", sectionKey: "" }), null);
  assert.strictEqual(findSectionConflict(undefined, { id: "x", sectionKey: "kodesh" }), null);
});

// ---- שירות ההצטרפות, עם מודל קבוצה מדומה ----
const state = { groups: [] };
const groupPath = require.resolve(path.join("..", "models/Group.js"));
require.cache[groupPath] = {
  id: groupPath,
  filename: groupPath,
  loaded: true,
  exports: {
    findById: async (id) => state.groups.find((g) => g.id === id) || null,
    findByMember: async (uid) => state.groups.filter((g) => g.members.includes(uid)),
    addMember: async (id, uid) => {
      const g = state.groups.find((x) => x.id === id);
      g.members.push(uid);
      return g;
    },
  },
};
const { joinGroupWithRules, conflictMessage } = require("../services/groupMembershipService");

test("joinGroupWithRules: מצטרף, חוסם מדור כפול מאותו סוג ומתעלם מהצטרפות חוזרת", async () => {
  state.groups = [
    { id: "k1", name: "מוצרי קדושה א", sectionKey: "kodesh", members: [] },
    { id: "k2", name: "מוצרי קדושה ב", sectionKey: "kodesh", members: [] },
    { id: "t1", name: "תניא", sectionKey: "tanya", members: [] },
    { id: "r1", name: "רגילה", sectionKey: "", members: [] },
  ];
  assert.strictEqual((await joinGroupWithRules("k1", "u1")).status, "joined");
  assert.strictEqual((await joinGroupWithRules("k1", "u1")).status, "already"); // BR-005
  const blocked = await joinGroupWithRules("k2", "u1");
  assert.strictEqual(blocked.status, "conflict");
  assert.strictEqual(blocked.conflict.id, "k1");
  assert.match(conflictMessage(blocked.conflict), /מוצרי קדושה א/);
  assert.deepStrictEqual(state.groups[1].members, []); // לא נוסף
  assert.strictEqual((await joinGroupWithRules("t1", "u1")).status, "joined"); // מדור אחר - מותר
  assert.strictEqual((await joinGroupWithRules("r1", "u1")).status, "joined"); // קבוצה רגילה - ללא הגבלה
  assert.strictEqual((await joinGroupWithRules("nope", "u1")).status, "notFound");
});
