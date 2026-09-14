// server/models/Post.js
// מודל הפוסט (דבר תורה / שאלה / עדכון / תוכן חג) - Model במבנה ה-MVC
// תואם ל-FR-013..FR-017 ולסכמת המסד בסעיף 9 ב-SRS

const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "יש להזין כותרת"],
      trim: true,
      maxlength: 150,
    },
    content: {
      type: String,
      required: [true, "יש להזין תוכן"],
      minlength: [1, "תוכן הפוסט לא יכול להיות ריק"],
      maxlength: [5000, "תוכן הפוסט ארוך מדי (מקסימום 5000 תווים)"], // BR-007
    },
    category: {
      type: String,
      enum: ["dvarTorah", "question", "update", "holiday"],
      default: "update",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videoUrl: { type: String, default: "" },

    // ארכוב לוגי - כשקבוצה נמחקת, הפוסטים שלה מסומנים כארכיביים ולא נמחקים פיזית (BR-011)
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// אינדקס טקסט לחיפוש חופשי (FR-012) על כותרת ותוכן
postSchema.index({ title: "text", content: "text" });

module.exports = mongoose.model("Post", postSchema);
