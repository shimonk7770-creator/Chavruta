// server/routes/learningLogRoutes.js
// נתיבי מעקב הלימוד האישי (FR-018, FR-019, FR-020) - כולם דורשים התחברות, מידע אישי לכל משתמש

const express = require("express");
const router = express.Router();
const learningLogController = require("../controllers/learningLogController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyLearningLog, canModifyLearningGoal } = require("../middleware/permissions");

router.get("/learning", isAuthenticated, learningLogController.index);
router.post("/learning", isAuthenticated, learningLogController.create);
router.get("/learning/:id/edit", isAuthenticated, canModifyLearningLog, learningLogController.showEditForm);
router.put("/learning/:id", isAuthenticated, canModifyLearningLog, learningLogController.update);
router.delete("/learning/:id", isAuthenticated, canModifyLearningLog, learningLogController.remove);

// תוספת לפי משוב המשתמש (אוקטובר 2026): שיתוף רישום בודד עם חברי קבוצה (כפוסט בפיד הקבוצה)
router.post("/learning/:id/share", isAuthenticated, canModifyLearningLog, learningLogController.shareToGroup);

// תוספת לפי משוב המשתמש (אוקטובר 2026): יעדי לימוד אישיים (צ'קליסט שהמשתמש מגדיר לעצמו)
router.post("/learning/goals", isAuthenticated, learningLogController.createGoal);
router.put("/learning/goals/:id", isAuthenticated, canModifyLearningGoal, learningLogController.toggleGoal);
router.delete("/learning/goals/:id", isAuthenticated, canModifyLearningGoal, learningLogController.removeGoal);

// FR-020: API לנתוני ה-heatmap שמוצג ב-Canvas (React)
router.get("/api/learning/heatmap", isAuthenticated, learningLogController.heatmapData);

module.exports = router;
