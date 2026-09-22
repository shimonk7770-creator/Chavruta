// server/routes/pageRoutes.js
// נתיבי דפים כלליים (לא קשורים ישירות לאימות)

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { globalSearch } = require("../controllers/searchController");

// דף הבית - אם המשתמש מחובר נציג לו את הפיד (בהמשך), אחרת מסך פתיחה
router.get("/", (req, res) => {
  res.render("home", {
    isLoggedIn: !!req.session.userId,
    userName: req.session.userName || null,
  });
});

// GET /study-room - "בית המדרש האישי": מודול React עם Canvas להצגת מעקב הלימוד (FR-020)
router.get("/study-room", isAuthenticated, (req, res) => {
  res.render("studyRoom", {
    isLoggedIn: true,
    userName: req.session.userName,
  });
});

// GET /search - חיפוש גלובלי אחד שמחפש גם בקבוצות וגם בפוסטים ביחד (בנוסף לחיפושים הממוקדים הקיימים)
router.get("/search", globalSearch);

// GET /permissions - עמוד הסבר מלא על מערכת ההרשאות (RBAC) - למי מותר מה, ואיך משיגים כל תפקיד
router.get("/permissions", (req, res) => {
  res.render("permissions");
});

module.exports = router;
