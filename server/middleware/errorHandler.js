// server/middleware/errorHandler.js
// Middleware גלובלי לטיפול בשגיאות - לפי סעיף 8 (טיפול בשגיאות) במסמך ה-SRS
// כל שגיאה לא צפויה בכל route תיתפס כאן, כדי שהשרת לעולם לא "יקרוס"

function notFound(req, res, next) {
  // דף/route שלא נמצא (404)
  res.status(404);
  const error = new Error(`הכתובת המבוקשת לא נמצאה: ${req.originalUrl}`);
  next(error);
}

function errorHandler(err, req, res, next) {
  // אם לא הוגדר קוד שגיאה ספציפי - ברירת מחדל 500 (שגיאת שרת כללית)
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  console.error("שגיאה בשרת:", err.message);

  res.status(statusCode);

  // אם הבקשה ציפתה ל-JSON (API/Ajax) - מחזירים JSON, אחרת מרנדרים דף שגיאה
  if (req.originalUrl.startsWith("/api")) {
    res.json({
      success: false,
      message: err.message || "אירעה שגיאה בשרת, נסה שוב מאוחר יותר",
    });
  } else {
    res.render("error", {
      message: err.message || "אירעה שגיאה בשרת, נסה שוב מאוחר יותר",
      statusCode,
    });
  }
}

module.exports = { notFound, errorHandler };
