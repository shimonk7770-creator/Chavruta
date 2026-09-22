// server/routes/holidayRoutes.js
// נתיבי "מעגל השנה" - FR-028 (ניהול, אדמין בלבד) ו-FR-029 (צפייה ציבורית, כולל אורחים)

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { isAdminUser } = require("../middleware/permissions");
const holidayController = require("../controllers/holidayController");

// חשוב: "/holidays/new" חייב להירשם *לפני* "/holidays/:id", אחרת "new" ייתפס כמזהה מסמך
router.get("/holidays/new", isAuthenticated, isAdminUser, holidayController.newHolidayForm);
router.post("/holidays", isAuthenticated, isAdminUser, holidayController.createHoliday);

router.get("/holidays/:id/edit", isAuthenticated, isAdminUser, holidayController.editHolidayForm);
router.post("/holidays/:id/delete", isAuthenticated, isAdminUser, holidayController.deleteHoliday);
router.post("/holidays/:id", isAuthenticated, isAdminUser, holidayController.updateHoliday);

router.get("/holidays", holidayController.listHolidays);
router.get("/holidays/:id", holidayController.showHoliday);

module.exports = router;
