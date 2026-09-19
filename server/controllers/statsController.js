// server/controllers/statsController.js
// נקודות קצה API להזנת גרפי D3 בעמוד "בית המדרש האישי" (FR-025, FR-026)
// כל הפונקציות כאן מחזירות JSON בלבד - הציור עצמו קורה בדפדפן (server/public/js/statsCharts.js)

const Post = require("../models/Post");
const Group = require("../models/Group");
const LearningLog = require("../models/LearningLog");

// GET /api/stats/posts-per-group - FR-025: פעילות (כמות פוסטים פעילים) לפי קבוצה
async function postsPerGroup(req, res, next) {
  try {
    const [counts, groups] = await Promise.all([Post.countActiveByGroup(), Group.listAll()]);

    // ממפים groupId -> שם קבוצה, כדי שהתווית בגרף תהיה קריאה (שם) ולא מזהה טכני (ID)
    const data = groups
      .map((g) => ({ groupName: g.name, count: counts[g.id] || 0 }))
      .filter((row) => row.count > 0) // FR-027: קבוצות בלי פוסטים לא "מציפות" את הגרף בעמודות אפס
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // עד 10 קבוצות מובילות - שומר על הגרף קריא גם אם יש הרבה קבוצות

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /api/stats/learning-trend - FR-026: מגמת רישומי לימוד קהילתיים (כל המשתמשים) ב-30 הימים האחרונים
async function learningTrend(req, res, next) {
  try {
    const counts = await LearningLog.countAllGroupedByDate({ days: 30 });
    const data = Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { postsPerGroup, learningTrend };
