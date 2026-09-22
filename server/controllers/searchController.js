// server/controllers/searchController.js
// חיפוש גלובלי אחד שמחפש גם בקבוצות וגם בפוסטים (בנוסף לשני מסכי החיפוש הממוקדים הקיימים -
// FR-011/FR-012 - שנשארים זמינים לחיפוש מתקדם עם יותר פרמטרים). נעשה לפי בקשת המשתמש.

const Group = require("../models/Group");
const Post = require("../models/Post");

// GET /search?q=... - מריץ את שתי שאילתות החיפוש הקיימות (קבוצות + פוסטים) עם אותה מילת חיפוש,
// ומציג את שתי התוצאות יחד בעמוד אחד
async function globalSearch(req, res) {
  const q = (req.query.q || "").trim();
  let groups = [];
  let posts = [];

  if (q) {
    const [groupResults, postResults] = await Promise.all([
      Group.search({ topic: q }),
      Post.search({ keyword: q }, { page: 1, pageSize: 20 }),
    ]);
    groups = groupResults;
    posts = postResults.posts;
  }

  res.render("search", { q, groups, posts });
}

module.exports = { globalSearch };
