// server/utils/googleAuth.js
// לוגיקה טהורה (בלי רשת/DB, ולכן ניתנת לבדיקה) להתחברות עם Google:
//  - validateClaims: בודק את הנתונים שחזרו מאימות הטוקן של Firebase (חייב אימייל מאומת)
//  - pickUsername: בוחר שם משתמש פנוי (3-20 תווים, אותיות קטנות/ספרות/קו תחתון) מתוך האימייל
//  - buildWebConfig: מרכיב את הגדרות ה-Firebase הציבוריות לדפדפן מתוך משתני סביבה (או null אם לא הוגדר)

const USERNAME_MAX = 20;
const USERNAME_MIN = 3;

// בדיקת תוכן הטוקן המאומת. email_verified חובה: בלי זה מישהו יכול היה "לטעון" אימייל של אחר
function validateClaims(decoded) {
  if (!decoded || typeof decoded !== "object") return { ok: false, reason: "invalid" };
  const email = String(decoded.email || "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "noEmail" };
  if (decoded.email_verified !== true) return { ok: false, reason: "unverified" };
  return {
    ok: true,
    uid: decoded.uid || decoded.sub || "",
    email,
    name: String(decoded.name || "").trim() || email.split("@")[0],
    picture: String(decoded.picture || "").trim(),
  };
}

// "dan.cohen+test@gmail.com" -> "dancohentest" (רק a-z0-9_, באורך תקין)
function baseUsername(email) {
  let base = String(email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (base.length < USERNAME_MIN) base = (base + "user").slice(0, USERNAME_MIN + 2);
  return base.slice(0, USERNAME_MAX - 5); // משאירים מקום לסיומת מספרית
}

// isTaken(username) -> Promise<boolean>. מנסה את הבסיס, ואז base2, base3 ... ובסוף סיומת אקראית
async function pickUsername(email, isTaken, random = Math.random) {
  const base = baseUsername(email);
  if (!(await isTaken(base))) return base;
  for (let i = 2; i <= 20; i += 1) {
    const candidate = `${base}${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}${Math.floor(random() * 90000 + 10000)}`;
}

// הגדרות Firebase לצד הדפדפן. apiKey של Web אינו סוד (הוא מיועד להיות גלוי), אבל לא נשמר בגיט - מגיע מ-.env
function buildWebConfig(env, projectId) {
  const apiKey = (env.FIREBASE_WEB_API_KEY || "").trim();
  if (!apiKey || !projectId) return null; // לא הוגדר -> הכפתור לא מוצג והאתר ממשיך לעבוד כרגיל
  return {
    apiKey,
    authDomain: (env.FIREBASE_AUTH_DOMAIN || "").trim() || `${projectId}.firebaseapp.com`,
    projectId,
  };
}

const REASON_MESSAGES = {
  invalid: "ההתחברות עם Google נכשלה. נסו שוב.",
  noEmail: "חשבון Google לא מחזיר כתובת אימייל, לא ניתן להתחבר.",
  unverified: "כתובת האימייל בחשבון Google לא מאומתת.",
  inactive: "החשבון הזה הושבת או נמחק.",
  noToken: "חסר אסימון התחברות.",
};

function reasonMessage(reason) {
  return REASON_MESSAGES[reason] || REASON_MESSAGES.invalid;
}

module.exports = { validateClaims, baseUsername, pickUsername, buildWebConfig, reasonMessage };
