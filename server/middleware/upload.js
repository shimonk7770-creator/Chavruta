// server/middleware/upload.js
// הגדרת multer להעלאת קבצי וידאו - BR-008: עד 50MB, פורמטים mp4/webm בלבד
// הקבצים נשמרים בתיקיית /uploads בשרת - רק הנתיב (לא הקובץ עצמו) נשמר ב-Firestore (סעיף 2.3 ב-SRS)

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["video/mp4", "video/webm"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // שם קובץ אקראי - מונע התנגשויות ומונע חשיפת שמות קבצים מקוריים
    const randomName = crypto.randomBytes(16).toString("hex");
    cb(null, `${randomName}${path.extname(file.originalname)}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("קובץ הווידאו חייב להיות בפורמט mp4 או webm"));
  }
  cb(null, true);
}

const uploadVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = { uploadVideo, UPLOAD_DIR };
