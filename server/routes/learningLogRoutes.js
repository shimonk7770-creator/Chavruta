// server/routes/learningLogRoutes.js
// נתיבי מעקב הלימוד האישי (FR-018, FR-019, FR-020) - כולם דורשים התחברות, מידע אישי לכל משתמש

const express = require("express");
const router = express.Router();
const learningLogController = require("../controllers/learningLogController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyLearningLog } = require("../middleware/permissions");

router.get("/learning", isAuthenticated, learningLogController.index);
router.post("/learning", isAuthenticated, learningLogController.create);
router.get("/learning/:id/edit", isAuthenticated, canModifyLearningLog, learningLogController.showEditForm);
router.put("/learning/:id", isAuthenticated, canModifyLearningLog, learningLogController.update);
router.delete("/learning/:id", isAuthenticated, canModifyLearningLog, learningLogController.remove);

// FR-020: API לנתוני ה-heatmap שמוצג ב-Canvas (React)
router.get("/api/learning/heatmap", isAuthenticated, learningLogController.heatmapData);

module.exports = router;
