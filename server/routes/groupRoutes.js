// server/routes/groupRoutes.js
// נתיבי הקבוצות - כולל בדיקות הרשאה (RBAC) על כל route רגיש

const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const postController = require("../controllers/postController");
const { isAuthenticated, hasRole } = require("../middleware/auth");
const { isGroupManagerOf } = require("../middleware/permissions");

router.get("/groups", groupController.listGroups);
router.get("/groups/search", groupController.searchGroups); // FR-011

// יצירת קבוצה - מנהל קבוצה או אדמין בלבד (FR-006)
router.get("/groups/new", isAuthenticated, hasRole("manager", "admin"), groupController.showNewGroupForm);
router.post("/groups", isAuthenticated, hasRole("manager", "admin"), groupController.createGroup);

router.get("/groups/:id", groupController.showGroup);

// עריכה/מחיקה - מנהל הקבוצה הספציפית הזו בלבד (FR-007, FR-008)
router.get("/groups/:id/edit", isAuthenticated, isGroupManagerOf, groupController.showEditGroupForm);
router.put("/groups/:id", isAuthenticated, isGroupManagerOf, groupController.updateGroup);
router.delete("/groups/:id", isAuthenticated, isGroupManagerOf, groupController.deleteGroup);

// הצטרפות/עזיבה (FR-009)
router.post("/groups/:id/join", isAuthenticated, groupController.joinGroup);
router.post("/groups/:id/leave", isAuthenticated, groupController.leaveGroup);

// יצירת פוסט בתוך קבוצה מסוימת (FR-013)
router.post("/groups/:groupId/posts", isAuthenticated, postController.createPost);

module.exports = router;
