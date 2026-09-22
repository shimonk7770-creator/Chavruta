// server/controllers/authController.js
// Controller לניהול הרשמה, התחברות, התנתקות ופרופיל אישי - לוגיקה עסקית (Business Logic)
// תואם ל-FR-001..FR-005 ולכללים BR-001, BR-002, BR-003, BR-010 במסמך ה-SRS
// שכבת הנתונים (User model) עובדת מול Firestore

const bcrypt = require("bcryptjs");
const sanitizeHtml = require("sanitize-html");
const User = require("../models/User");
const { isValidPassword } = require("../utils/validators"); // BR-002, נבדק גם אוטומטית ב-server/test/validators.test.js

const MAX_FAILED_ATTEMPTS = 5; // BR-010
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 דקות

// GET /register - מציג את טופס ההרשמה
function showRegisterForm(req, res) {
  res.render("register", { error: null, fullName: "", username: "", email: "" });
}

// POST /register - FR-001: הרשמת משתמש חדש
async function register(req, res) {
  // שדות שאינם סיסמה - נשמרים ומועברים בחזרה לטופס בכל מקרה של שגיאה,
  // כדי שהמשתמש לא יצטרך להקליד מחדש את כל הטופס בגלל טעות בסיסמה בלבד (חוויית משתמש)
  const { fullName, username, email, password, confirmPassword } = req.body;
  const keepValues = { fullName: fullName || "", username: username || "", email: email || "" };

  try {
    // ולידציה בסיסית בצד שרת (חובה! גם אם יש ולידציה בצד לקוח - ראו סעיף 7 ב-SRS)
    if (!fullName || !username || !email || !password || !confirmPassword) {
      return res.render("register", { error: "יש למלא את כל השדות", ...keepValues });
    }
    if (password !== confirmPassword) {
      // אימות שדה "הזן שוב את הסיסמה" - מונע רישום עם סיסמה שהוקלדה בטעות
      return res.render("register", { error: "הסיסמאות שהוזנו אינן תואמות", ...keepValues });
    }
    if (!isValidPassword(password)) {
      // BR-002: סיסמה חייבת 8 תווים לפחות, אות גדולה וספרה
      return res.render("register", {
        error: "הסיסמה חייבת לכלול לפחות 8 תווים, אות גדולה אחת וספרה אחת",
        ...keepValues,
      });
    }

    // בדיקת ייחודיות אימייל/שם משתמש (BR-001, BR-003)
    const existingUser = await User.findByEmailOrUsername(email, username);
    if (existingUser) {
      return res.render("register", {
        error: "כתובת האימייל או שם המשתמש כבר תפוסים במערכת",
        ...keepValues,
      });
    }

    // הצפנת הסיסמה - לעולם לא שומרים סיסמה כטקסט גלוי! (NFR-003)
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      username,
      email,
      passwordHash,
      role: "member", // ברירת מחדל - חבר קהילה רגיל
    });

    // יצירת session - התחברות אוטומטית לאחר הרשמה מוצלחת
    req.session.userId = newUser.id;
    req.session.userRole = newUser.role;
    req.session.userName = newUser.fullName;
    req.session.userAvatarUrl = newUser.avatarUrl || ""; // כדי שהתפריט העליון יוכל להציג אווטאר בלי לשלוף מהDB בכל בקשה

    res.redirect("/");
  } catch (error) {
    console.error("שגיאה בהרשמה:", error);
    res.render("register", { error: "אירעה שגיאה, נסה שוב", ...keepValues });
  }
}

// GET /login - מציג את טופס ההתחברות
function showLoginForm(req, res) {
  res.render("login", { error: null, email: "" });
}

// POST /login - FR-002: התחברות משתמש
async function login(req, res) {
  const { email, password } = req.body;
  // שומרים את האימייל שהוקלד גם אם ההתחברות נכשלת - אותו שיפור חוויית משתמש כמו בטופס ההרשמה
  const keepEmail = { email: email || "" };

  try {
    // activeOnly: משתמש שמחק את חשבונו (FR-005) לא יכול להתחבר יותר
    const user = await User.findByEmail(email, { activeOnly: true });

    // הודעת שגיאה כללית - לא חושפים אם האימייל קיים או שהסיסמה שגויה (מניעת enumeration)
    const genericError = "אימייל או סיסמה שגויים";

    if (!user) {
      return res.render("login", { error: genericError, ...keepEmail });
    }

    // BR-010: בדיקת נעילת חשבון זמנית
    if (User.isLocked(user)) {
      const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
      return res.render("login", {
        error: `החשבון נעול זמנית עקב ניסיונות כושלים רבים. נסה שוב בעוד כ-${minutesLeft} דקות`,
        ...keepEmail,
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // עדכון מונה ניסיונות כושלים
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const patch = { failedLoginAttempts };
      if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        patch.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        patch.failedLoginAttempts = 0;
      }
      await User.update(user.id, patch);
      return res.render("login", { error: genericError, ...keepEmail });
    }

    // התחברות מוצלחת - איפוס מונה הכשלונות
    await User.update(user.id, { failedLoginAttempts: 0, lockUntil: null });

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.fullName;
    req.session.userAvatarUrl = user.avatarUrl || "";

    res.redirect("/");
  } catch (error) {
    console.error("שגיאה בהתחברות:", error);
    res.render("login", { error: "אירעה שגיאה, נסה שוב", ...keepEmail });
  }
}

// POST /logout - FR-003: יציאה מהמערכת
function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/");
  });
}

// GET /api/check-username - שימוש ב-jQuery/Ajax (דרישה 25): בדיקת זמינות שם משתמש בזמן אמת
async function checkUsername(req, res) {
  const { username } = req.query;
  if (!username || username.length < 3) {
    return res.json({ available: false, message: "שם משתמש קצר מדי" });
  }
  const existing = await User.findByUsername(username);
  res.json({ available: !existing });
}

// GET /profile - FR-004: מסך עריכת פרופיל אישי
async function showProfileForm(req, res) {
  const user = await User.findById(req.session.userId);
  res.render("profile", { profileUser: User.toPublicUser(user), error: null, success: null });
}

// POST /profile - FR-004: עדכון פרופיל אישי (שם, ביוגרפיה, אווטאר, ולחלופין סיסמה חדשה)
async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.session.userId);
    const { fullName, bio, avatarUrl, currentPassword, newPassword } = req.body;

    const patch = {};
    if (fullName && fullName.trim()) patch.fullName = fullName.trim();
    // ניקוי HTML מהביוגרפיה - הגנה מפני XSS (NFR-006)
    patch.bio = sanitizeHtml(bio || "", { allowedTags: [], allowedAttributes: {} }).trim();
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl.trim();

    // שינוי סיסמה - דורש הזנת הסיסמה הנוכחית לאימות (FR-004)
    if (newPassword) {
      const isMatch = await bcrypt.compare(currentPassword || "", user.passwordHash);
      if (!isMatch) {
        return res.render("profile", { profileUser: User.toPublicUser(user), error: "הסיסמה הנוכחית שגויה", success: null });
      }
      if (!isValidPassword(newPassword)) {
        return res.render("profile", {
          profileUser: User.toPublicUser(user),
          error: "הסיסמה החדשה חייבת לכלול לפחות 8 תווים, אות גדולה וספרה",
          success: null,
        });
      }
      patch.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await User.update(user.id, patch);
    req.session.userName = updated.fullName;
    req.session.userAvatarUrl = updated.avatarUrl || "";
    res.render("profile", { profileUser: User.toPublicUser(updated), error: null, success: "הפרטים עודכנו בהצלחה" });
  } catch (error) {
    console.error("שגיאה בעדכון פרופיל:", error);
    res.render("profile", { profileUser: req.body, error: "אירעה שגיאה, נסה שוב", success: null });
  }
}

// POST /profile/avatar - העלאת תמונת פרופיל אמיתית (קובץ, לא רק קישור) - אותו דפוס בדיוק כמו
// postController.uploadVideo/uploadImages, רק שכאן מעדכנים את מסמך המשתמש במקום מסמך פוסט
async function uploadAvatar(req, res) {
  const user = await User.findById(req.session.userId);
  if (!req.file) {
    return res.render("profile", { profileUser: User.toPublicUser(user), error: "יש לבחור קובץ תמונה", success: null });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  const updated = await User.update(user.id, { avatarUrl });
  req.session.userAvatarUrl = avatarUrl; // מעדכנים גם את ה-session כדי שהתפריט העליון יציג את התמונה החדשה מיד
  res.render("profile", { profileUser: User.toPublicUser(updated), error: null, success: "תמונת הפרופיל עודכנה בהצלחה" });
}

// POST /profile/delete - FR-005: מחיקת חשבון (רכה - isActive:false, לא מחיקה פיזית - BR-011)
async function deleteAccount(req, res) {
  await User.update(req.session.userId, { isActive: false });
  req.session.destroy(() => {
    res.redirect("/");
  });
}

module.exports = {
  showRegisterForm,
  register,
  showLoginForm,
  login,
  logout,
  checkUsername,
  showProfileForm,
  updateProfile,
  uploadAvatar,
  deleteAccount,
};
