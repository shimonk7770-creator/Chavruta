// server/middleware/upload.js
// הגדרות multer להעלאת קבצים: וידאו לפוסטים (BR-008), תמונות לגלריית פוסט, ותמונת פרופיל (אווטאר).
// כל הקבצים נשמרים בתיקיית /uploads בשרת - רק הנתיב (לא הקובץ עצמו) נשמר ב-Firestore (סעיף 2.3 ב-SRS)

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - BR-008
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];

const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB לכל תמונה - סביר לגלריית פוסט/אווטאר
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// אחסון משותף לכל סוגי הקבצים - שם קובץ אקראי מונע התנגשויות וחשיפת שמות קבצים מקוריים
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString("hex");
    cb(null, `${randomName}${path.extname(file.originalname)}`);
  },
});

function makeFileFilter(allowedMimeTypes, errorMessage) {
  return function fileFilter(req, file, cb) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(errorMessage));
    }
    cb(null, true);
  };
}

const uploadVideo = multer({
  storage,
  fileFilter: makeFileFilter(VIDEO_MIME_TYPES, "קובץ הווידאו חייב להיות בפורמט mp4 או webm"),
  limits: { fileSize: VIDEO_MAX_SIZE_BYTES },
});

// גלריית תמונות לפוסט - עד 6 תמונות בפעם אחת (ראו postController.uploadImages)
const uploadImages = multer({
  storage,
  fileFilter: makeFileFilter(IMAGE_MIME_TYPES, "התמונות חייבות להיות בפורמט JPG, PNG, WEBP או GIF"),
  limits: { fileSize: IMAGE_MAX_SIZE_BYTES, files: 6 },
});

// תמונת פרופיל (אווטאר) - קובץ בודד בלבד
const uploadAvatar = multer({
  storage,
  fileFilter: makeFileFilter(IMAGE_MIME_TYPES, "תמונת הפרופיל חייבת להיות בפורמט JPG, PNG, WEBP או GIF"),
  limits: { fileSize: IMAGE_MAX_SIZE_BYTES, files: 1 },
});

module.exports = { uploadVideo, uploadImages, uploadAvatar, UPLOAD_DIR };
