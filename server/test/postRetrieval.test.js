// server/test/postRetrieval.test.js
// בדיקות לבחירת הפוסטים הרלוונטיים לשאלה (utils/postRetrieval.js) - לפני שליחתם ל-AI
const test = require("node:test");
const assert = require("node:assert");
const { extractTerms, scorePost, pickRelevantPosts } = require("../utils/postRetrieval");

const posts = [
  { id: "1", title: "הלכות שבת", content: "דיון על הדלקת נרות בערב שבת" },
  { id: "2", title: "פרשת השבוע", content: "חידוש על הפרשה, מוזכרת גם השבת" },
  { id: "3", title: "מתכון לחלה", content: "קמח ושמרים" },
  { id: "4", title: "תפילת מנחה", content: "זמני המניין" },
];

test("extractTerms: מסיר מילות עצירה ופיסוק, ומוסיף צורה בלי אות שימוש", () => {
  const terms = extractTerms("מה למדו על השבת?");
  assert.ok(terms.includes("למדו") && terms.includes("השבת") && terms.includes("שבת"));
  assert.ok(!terms.includes("מה") && !terms.includes("על"));
  assert.deepStrictEqual(extractTerms("מה זה"), []);
  assert.deepStrictEqual(extractTerms(""), []);
});

test("scorePost: כותרת שווה יותר מתוכן", () => {
  assert.strictEqual(scorePost({ title: "שבת", content: "" }, ["שבת"]), 3);
  assert.strictEqual(scorePost({ title: "", content: "שבת" }, ["שבת"]), 1);
  assert.strictEqual(scorePost({ title: "שבת", content: "שבת" }, ["שבת"]), 4);
});

test("pickRelevantPosts: בוחר לפי רלוונטיות ומתעלם מפוסטים לא קשורים", () => {
  const picked = pickRelevantPosts(posts, "מה כתוב על שבת?");
  assert.deepStrictEqual(picked.map((p) => p.id), ["1", "2"]);
  assert.deepStrictEqual(pickRelevantPosts(posts, "שאלה על כדורגל"), []);
});

test("pickRelevantPosts: מכבד limit, שאלה ריקה ורשימה ריקה", () => {
  assert.strictEqual(pickRelevantPosts(posts, "שבת", 1).length, 1);
  assert.deepStrictEqual(pickRelevantPosts(posts, ""), []);
  assert.deepStrictEqual(pickRelevantPosts(undefined, "שבת"), []);
});

test("ניקוד/ניקוד עברי: התעלמות מניקוד בתוכן", () => {
  assert.ok(scorePost({ title: "שַׁבָּת", content: "" }, ["שבת"]) >= 3);
});
