// server/services/googleLoginService.js
// התחברות/הרשמה עם Google דרך Firebase Authentication.
// הדפדפן (או האפליקציה) מתחבר מול Google ומקבל idToken; כאן השרת מאמת אותו מול Firebase Admin
// (חתימה, תפוגה, ושהטוקן שייך לפרויקט שלנו) ורק אז מחבר/יוצר משתמש. לעולם לא סומכים על אימייל שהגיע מהלקוח.
//
// כללים:
//  - אימייל קיים במערכת -> מתחברים לאותו חשבון (Google כבר אימת את הבעלות על האימייל)
//  - אימייל חדש -> נוצר חבר חדש (role: member) עם שם משתמש פנוי, ו-passwordHash אקראי שאין דרך לנחש
//  - חשבון לא פעיל (נמחק/הושבת) לא יכול להתחבר
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const G = require("../utils/googleAuth");

// אימות הטוקן בפועל (נטען בעצלתיים כדי שבדיקות לא יצטרכו את firebase-admin)
async function defaultVerify(idToken) {
  const admin = require("firebase-admin");
  return admin.auth().verifyIdToken(idToken);
}

// deps מאפשר להזריק תלויות בבדיקות: { verify, users, hash }
async function signInWithGoogle(idToken, deps = {}) {
  const verify = deps.verify || defaultVerify;
  const users = deps.users || User;
  const hash = deps.hash || ((s) => bcrypt.hash(s, 10));

  if (!idToken || typeof idToken !== "string") return { ok: false, reason: "noToken" };

  let decoded;
  try {
    decoded = await verify(idToken);
  } catch {
    return { ok: false, reason: "invalid" }; // טוקן מזויף / פג תוקף / מפרויקט אחר
  }

  const claims = G.validateClaims(decoded);
  if (!claims.ok) return claims;

  const existing = await users.findByEmail(claims.email);
  if (existing) {
    if (existing.isActive === false) return { ok: false, reason: "inactive" };
    return { ok: true, user: existing, created: false };
  }

  const username = await G.pickUsername(claims.email, async (u) => !!(await users.findByUsername(u)));
  const passwordHash = await hash(crypto.randomBytes(32).toString("hex"));
  const user = await users.create({
    fullName: claims.name,
    username,
    email: claims.email,
    passwordHash,
    role: "member",
    avatarUrl: claims.picture,
  });
  return { ok: true, user, created: true };
}

module.exports = { signInWithGoogle };
