// server/models/Group.js
// מודל הקבוצה (קהילה/שיעור/ועד) - Model במבנה ה-MVC
// תואם ל-FR-006..FR-010 ולסכמת המסד בסעיף 9 ב-SRS

const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "יש להזין שם קבוצה"],
      trim: true,
      minlength: [2, "שם הקבוצה חייב להכיל לפחות 2 תווים"],
      maxlength: [60, "שם הקבוצה לא יכול להכיל יותר מ-60 תווים"],
    },
    description: { type: String, default: "", maxlength: 1000 },

    // קטגוריה: שיעור תורני / ועד קהילתי / קהילה כללית
    category: {
      type: String,
      enum: ["shiur", "vaad", "community"],
      default: "community",
    },

    // שדות המשמשים לחיפוש (FR-011): נושא, יום, שעה, רמה
    topic: { type: String, default: "", trim: true },
    dayOfWeek: { type: String, default: "" }, // לדוגמה: "ראשון", "שלישי"
    time: { type: String, default: "" }, // לדוגמה: "20:00"
    level: {
      type: String,
      enum: ["beginners", "intermediate", "advanced", ""],
      default: "",
    },

    // מנהל הקבוצה - חייב תמיד להיות מוגדר (BR-009)
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // רשימת חברי הקבוצה
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// אינדקס טקסט לחיפוש חופשי לפי שם/נושא (בנוסף לסינון לפי day/time/level)
groupSchema.index({ name: "text", topic: "text" });

module.exports = mongoose.model("Group", groupSchema);
