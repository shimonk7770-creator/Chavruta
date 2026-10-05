// server/routes/statusRoutes.js
// נתיבי פיצ'ר "סטטוס" (סטוריז) - עדכון בעקבות בקשת המשתמש ("וואטסאפ-ification")

const express = require("express");
const router = express.Router();
const statusController = require("../controllers/statusController");
const { isAuthenticated } = require("../middleware/auth");
const { uploadStatusPhoto } = require("../middleware/upload");

router.get("/status/new", isAuthenticated, statusController.showNewStatusForm);
router.post("/status/text", isAuthenticated, statusController.createTextStatus);
router.post("/status/image", isAuthenticated, uploadStatusPhoto.single("statusImage"), statusController.createImageStatus);

router.get("/status/u/:userId", isAuthenticated, statusController.viewUserStatuses);
router.post("/status/:id/view", isAuthenticated, statusController.recordView);
router.post("/status/:id/delete", isAuthenticated, statusController.deleteStatus);

module.exports = router;
