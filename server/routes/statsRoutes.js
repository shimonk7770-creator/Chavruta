// server/routes/statsRoutes.js
// נתיבי API לנתוני הגרפים (D3) בעמוד "בית המדרש האישי" - FR-025, FR-026
// פתוחים רק למשתמשים מחוברים (הנתונים משקפים פעילות קהילתית פנימית, לא ציבורית)

const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/api/stats/posts-per-group", isAuthenticated, statsController.postsPerGroup);
router.get("/api/stats/learning-trend", isAuthenticated, statsController.learningTrend);

module.exports = router;
