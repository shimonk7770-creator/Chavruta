// server/routes/prayerRoutes.js
// נתיבי "נוסח תפילה" - ציבוריים (בלי isAuthenticated), כמו "מעגל השנה" ו"זמני היום"

const express = require("express");
const router = express.Router();
const prayerController = require("../controllers/prayerController");

router.get("/prayers", prayerController.chooseForm);
// חשוב: נתיב ה-JSON (3 מקטעים) לא מתנגש עם נתיב העמוד (2 מקטעים) - אבל נרשם ראשון ליתר ביטחון
router.get("/prayers/data/:nusach/:prayer", prayerController.prayerData);
router.get("/prayers/:nusach/:prayer", prayerController.showPrayer);

module.exports = router;
