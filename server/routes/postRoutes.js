// server/routes/postRoutes.js
// נתיבי הפוסטים (חיפוש, פיד אישי, עריכה ומחיקה - יצירה נמצאת ב-groupRoutes כי היא תמיד בתוך קבוצה)

const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyPost } = require("../middleware/permissions");

router.get("/posts/search", postController.searchPosts); // FR-012
router.get("/feed", isAuthenticated, postController.myFeed); // FR-017 - פיד אישי

router.get("/posts/:id/edit", isAuthenticated, canModifyPost, postController.showEditPostForm); // FR-014
router.put("/posts/:id", isAuthenticated, canModifyPost, postController.updatePost); // FR-014
router.delete("/posts/:id", isAuthenticated, canModifyPost, postController.deletePost); // FR-014

module.exports = router;
