// server/controllers/likeController.js
// POST /api/posts/:id/like  ו-  POST /api/comments/:id/like  - לייק/ביטול לייק (כל משתמש מחובר). מחזיר JSON { liked, likeCount }

const likes = require("../services/likeService");

function handler(targetType) {
  return async (req, res) => {
    try {
      const result = await likes.toggleLike({
        targetType,
        targetId: req.params.id,
        actor: { id: req.session.userId, name: req.session.userName },
      });
      if (result.status === "notFound") return res.status(404).json({ success: false, message: "התוכן לא נמצא" });
      if (result.status !== "ok") return res.status(400).json({ success: false, message: "בקשה לא תקינה" });
      return res.json({ success: true, liked: result.liked, likeCount: result.likeCount });
    } catch (error) {
      console.error("שגיאה בלייק:", error.message);
      return res.status(500).json({ success: false, message: "אירעה שגיאה בשרת" });
    }
  };
}

module.exports = { likePost: handler("post"), likeComment: handler("comment") };
