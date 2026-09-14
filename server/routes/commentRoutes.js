// server/routes/commentRoutes.js
// נתיבי API לתגובות - נצרכים דרך jQuery/Ajax (ראו דרישה 25 במסמך הדרישות)

const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { isAuthenticated } = require("../middleware/auth");
const { canModifyComment } = require("../middleware/permissions");

router.get("/api/posts/:postId/comments", commentController.listComments);
router.post("/api/posts/:postId/comments", isAuthenticated, commentController.addComment);
router.delete("/api/comments/:id", isAuthenticated, canModifyComment, commentController.deleteComment);

module.exports = router;
