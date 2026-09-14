// server/controllers/authController.js
// Controller לניהול הרשמה, התחברות והתנתקות - לוגיקה עסקית (Business Logic)
// תואם ל-FR-001, FR-002, FR-003 ולכללים BR-001, BR-002, BR-003, BR-010 במסמך ה-SRS

const bcrypt = require("bcryptjs");
const sanitizeHtml = require("sanitize-html");
const User = require("../models/User");

const MAX_FAILED_ATTEMPTS = 5; // BR-010
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 דקות

// GET /register - מציג את טופס ההרשמה
function showRegisterForm(req, res) {
  res.render("register", { error: null });
}

// POST /register - FR-001: הרשמת משתמש חדש
async function register(req, res) {
  try {
    const { fullName, username, email, password } = req.body;

    // ולידציה בסיסית בצד שרת (חובה! גם אם יש ולידציה בצד לקוח - ראו סעיף 7 ב-SRS)
    if (!fullName || !username || !email || !password) {
      return res.render("register", { error: "יש למלא את כל השדות" });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      // BR-002: סיסמה חייבת 8 תווים לפחות, אות גדולה וספרה
      return res.render("register", {
        error: "הסיסמה חייבת לכלול לפחות 8 תווים, אות גדולה אחת וספרה אחת",
      });
    }

    // בדיקת ייחודיות אימייל/שם משתמש (BR-001, BR-003)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.render("register", {
        error: "כתובת האימייל או שם המשתמש כבר תפוסים במערכת",
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
    req.session.userId = newUser._id;
    req.session.userRole = newUser.role;
    req.session.userName = newUser.fullName;

    res.redirect("/");
  } catch (error) {
    console.error("שגיאה בהרשמה:", error);
    res.render("register", { error: "אירעה שגיאה, נסה שוב" });
  }
}

// GET /login - מציג את טופס ההתחברות
function showLoginForm(req, res) {
  res.render("login", { error: null });
}

// POST /login - FR-002: התחברות משתמש
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // מביאים את המשתמש כולל שדה הסיסמה (ברירת המחדל select:false מוסתרת, כאן צריך אותה בפירוש)
    const user = await User.findOne({ email, isActive: true }).select("+passwordHash");

    // הודעת שגיאה כללית - לא חושפים אם האימייל קיים או שהסיסמה שגויה (מניעת enumeration)
    const genericError = "אימייל או סיסמה שגויים";

    if (!user) {
      return res.render("login", { error: genericError });
    }

    // BR-010: בדיקת נעילת חשבון זמנית
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.render("login", {
        error: `החשבון נעול זמנית עקב ניסיונות כושלים רבים. נסה שוב בעוד כ-${minutesLeft} דקות`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // עדכון מונה ניסיונות כושלים
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.render("login", { error: genericError });
    }

    // התחברות מוצלחת - איפוס מונה הכשלונות
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userName = user.fullName;

    res.redirect("/");
  } catch (error) {
    console.error("שגיאה בהתחברות:", error);
    res.render("login", { error: "אירעה שגיאה, נסה שוב" });
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
  const existing = await User.findOne({ username });
  res.json({ available: !existing });
}

// GET /profile - FR-004: מסך עריכת פרופיל אישי
async function showProfileForm(req, res) {
  const user = await User.findById(req.session.userId);
  res.render("profile", { profileUser: user, error: null, success: null });
}

// POST /profile - FR-004: עדכון פרופיל אישי (שם, ביוגרפיה, אווטאר, ולחלופין סיסמה חדשה)
async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.session.userId).select("+passwordHash");
    const { fullName, bio, avatarUrl, currentPassword, newPassword } = req.body;

    if (fullName && fullName.trim()) user.fullName = fullName.trim();
    // ניקוי HTML מהביוגרפיה - הגנה מפני XSS (NFR-006)
    user.bio = sanitizeHtml(bio || "", { allowedTags: [], allowedAttributes: {} }).trim();
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl.trim();

    // שינוי סיסמה - דורש הזנת הסיסמה הנוכחית לאימות (FR-004)
    if (newPassword) {
      const isMatch = await bcrypt.compare(currentPassword || "", user.passwordHash);
      if (!isMatch) {
        return res.render("profile", { profileUser: user, error: "הסיסמה הנוכחית שגויה", success: null });
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.render("profile", {
          profileUser: user,
          error: "הסיסמה החדשה חייבת לכלול לפחות 8 תווים, אות גדולה וספרה",
          success: null,
        });
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    req.session.userName = user.fullName;
    res.render("profile", { profileUser: user, error: null, success: "הפרטים עודכנו בהצלחה" });
  } catch (error) {
    console.error("שגיאה בעדכון פרופיל:", error);
    res.render("profile", { profileUser: req.body, error: "אירעה שגיאה, נסה שוב", success: null });
  }
}

// POST /profile/delete - FR-005: מחיקת חשבון (רכה - isActive:false, לא מחיקה פיזית - BR-011)
async function deleteAccount(req, res) {
  await User.findByIdAndUpdate(req.session.userId, { isActive: false });
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
  deleteAccount,
};
