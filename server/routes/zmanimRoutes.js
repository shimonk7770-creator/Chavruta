// server/routes/zmanimRoutes.js
// נתיב "זמני היום" - ציבורי (בלי isAuthenticated), כמו עמוד "מעגל השנה"

const express = require("express");
const router = express.Router();
const zmanimController = require("../controllers/zmanimController");

router.get("/zmanim", zmanimController.showZmanim);

module.exports = router;
