// server/routes/postRoutes.js
// נתיבי הפוסטים (חיפוש ומחיקה - יצירה נמצאת ב-groupRoutes כי היא תמיד בתוך קבוצה)

const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyPost } = require("../middleware/permissions");

router.get("/posts/search", postController.searchPosts); // FR-012
router.delete("/posts/:id", isAuthenticated, canModifyPost, postController.deletePost); // FR-014

module.exports = router;
