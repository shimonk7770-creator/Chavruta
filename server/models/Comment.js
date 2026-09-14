// server/models/Comment.js
// מודל התגובה - Model במבנה ה-MVC
// תואם ל-FR-015, FR-016 ב-SRS

const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "התגובה לא יכולה להיות ריקה"],
      maxlength: [1000, "התגובה ארוכה מדי (מקסימום 1000 תווים)"], // BR-007
    },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
