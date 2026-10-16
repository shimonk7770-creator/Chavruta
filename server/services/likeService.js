// server/services/likeService.js
// לייק על פוסט/תגובה - משותף לאתר ולמובייל. מחליף מצב לייק ושולח התראה לכותב (רק בלייק חדש, לא על לייק עצמי).
// כישלון בהתראה לא מפיל את הלייק עצמו (כמו בתגובות).

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const { getIo } = require("../sockets/ioInstance");

// targetType: "post" | "comment". actor = { id, name }. מחזיר { status: "ok"|"notFound"|"invalid", liked, likeCount }
async function toggleLike({ targetType, targetId, actor }) {
  if (!["post", "comment"].includes(targetType) || !targetId) return { status: "invalid" };
  const model = targetType === "post" ? Post : Comment;
  const result = await model.toggleLike(targetId, actor.id);
  if (!result) return { status: "notFound" };

  if (result.liked && result.authorId && result.authorId !== actor.id) {
    try {
      const notif = await Notification.create({
        userId: result.authorId,
        type: "like",
        text: `${actor.name} אהב/ה את ${targetType === "post" ? "הפוסט" : "התגובה"} שלך`,
        link: "/groups",
      });
      const io = getIo();
      if (io) io.to("user:" + result.authorId).emit("notification:new", notif);
    } catch (error) {
      console.error("שגיאה ביצירת התראת לייק:", error.message);
    }
  }
  return { status: "ok", liked: result.liked, likeCount: result.likeCount };
}

module.exports = { toggleLike };
