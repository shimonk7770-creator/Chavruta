// server/routes/minyanRoutes.js
// נתיבי "מניינים": צפייה וחיפוש - ציבורי (גם לאורחים); הוספה ומחיקה - משתמש מחובר בלבד

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const minyanController = require("../controllers/minyanController");

// חשוב: "/minyanim/new" חייב להירשם *לפני* כל נתיב עם :id, אחרת "new" ייתפס כמזהה
router.get("/minyanim/new", isAuthenticated, minyanController.newForm);
router.post("/minyanim", isAuthenticated, minyanController.createMinyan);
router.post("/minyanim/:id/delete", isAuthenticated, minyanController.deleteMinyan);
router.get("/minyanim", minyanController.listMinyanim);

module.exports = router;
