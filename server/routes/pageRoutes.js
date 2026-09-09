// server/routes/pageRoutes.js
// נתיבי דפים כלליים (לא קשורים ישירות לאימות)

const express = require("express");
const router = express.Router();

// דף הבית - אם המשתמש מחובר נציג לו את הפיד (בהמשך), אחרת מסך פתיחה
router.get("/", (req, res) => {
  res.render("home", {
    isLoggedIn: !!req.session.userId,
    userName: req.session.userName || null,
  });
});

module.exports = router;
