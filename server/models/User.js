// server/models/User.js
// מודל המשתמש - Model במבנה ה-MVC
// תואם לסכמת המסד ולדרישות ה-RBAC בסעיף 3 וה-FR-001..FR-005 במסמך ה-SRS

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "יש להזין שם מלא"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "יש להזין שם משתמש"],
      unique: true, // BR-001: שם משתמש ייחודי
      trim: true,
      minlength: [3, "שם משתמש חייב להכיל לפחות 3 תווים"],
      maxlength: [20, "שם משתמש לא יכול להכיל יותר מ-20 תווים"],
    },
    email: {
      type: String,
      required: [true, "יש להזין כתובת אימייל"],
      unique: true, // BR-003: אימייל ייחודי
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "כתובת האימייל אינה תקינה"],
    },
    // חשוב: לעולם לא לשלוח שדה זה חזרה בתגובת API (NFR-003) - select:false מסתיר אותו כברירת מחדל
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    // תפקיד המשתמש - קובע הרשאות (RBAC), ראו סעיף 3 ב-SRS
    role: {
      type: String,
      enum: ["member", "manager", "admin"],
      default: "member",
    },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 300 },

    // מחיקה רכה - BR-011 / FR-005 - לא מוחקים משתמש פיזית כדי לשמר שלמות תוכן
    isActive: { type: Boolean, default: true },

    // BR-010: נעילת חשבון זמנית אחרי 5 ניסיונות התחברות כושלים
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  {
    timestamps: true, // מוסיף אוטומטית createdAt ו-updatedAt
  }
);

// שיטת עזר - בודקת אם המשתמש נעול כרגע (BR-010)
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

module.exports = mongoose.model("User", userSchema);
