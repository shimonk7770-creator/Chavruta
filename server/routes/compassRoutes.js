// server/routes/compassRoutes.js
// נתיבי "מצפן" - ציבוריים (בלי isAuthenticated)

const express = require("express");
const router = express.Router();
const compassController = require("../controllers/compassController");

router.get("/compass", compassController.showCompass);
router.get("/compass/bearing", compassController.bearingFromPoint);

module.exports = router;
