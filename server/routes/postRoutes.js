// server/routes/postRoutes.js
// נתיבי הפוסטים (חיפוש, פיד אישי, עריכה ומחיקה - יצירה נמצאת ב-groupRoutes כי היא תמיד בתוך קבוצה)

const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyPost } = require("../middleware/permissions");
const { uploadVideo, uploadImages } = require("../middleware/upload");

router.get("/posts/search", postController.searchPosts); // FR-012
router.get("/feed", isAuthenticated, postController.myFeed); // FR-017 - פיד אישי
router.get("/api/videos/library", isAuthenticated, postController.videoLibrary); // דרישה 26 - נתונים למרכיב React "הספרייה שלי"

router.get("/posts/:id/edit", isAuthenticated, canModifyPost, postController.showEditPostForm); // FR-014
router.put("/posts/:id", isAuthenticated, canModifyPost, postController.updatePost); // FR-014
router.post("/posts/:id/video", isAuthenticated, canModifyPost, uploadVideo.single("video"), postController.uploadVideo); // BR-008
router.post("/posts/:id/images", isAuthenticated, canModifyPost, uploadImages.array("images", 6), postController.uploadImages); // גלריית תמונות
router.delete("/posts/:id", isAuthenticated, canModifyPost, postController.deletePost); // FR-014

module.exports = router;
