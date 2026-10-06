// server/utils/compassLogic.js
// הלוגיקה הטהורה (נבדקת אוטומטית) של קטגוריית "מצפן": כיוון התפילה מכל נקודה בעולם אל הר הבית בירושלים.
// הלכתית - מתפללים לכיוון ירושלים, ובתוכה הר הבית/בית המקדש (ברכות ל"ד:). לכן נקודת היעד היא הר הבית.
// הכיוון המחושב הוא "זווית התחלתית על מעגל גדול" (great-circle initial bearing) - הקו הקצר ביותר על פני כדור הארץ,
// שהוא גם הכיוון שבו מצפן אמיתי מצביע (ולא "קו ישר על מפה שטוחה", שבו ניו יורק-ירושלים היה נראה מזרחה).
// זווית נמדדת במעלות עם כיוון השעון מצפון: 0=צפון, 90=מזרח, 180=דרום, 270=מערב.

const { haversineKm } = require("./minyanimLogic"); // אותה נוסחת מרחק כמו ב"מניינים" - לא מכפילים קוד

// הר הבית (כיפת הסלע) - קואורדינטות מקורבות
const TEMPLE_MOUNT = { lat: 31.778, lng: 35.2354, label: "הר הבית, ירושלים" };

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// מנרמל זווית לטווח [0,360)
function normalizeDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

// כיוון התחלתי ממקור ליעד, במעלות מצפון עם כיוון השעון
function initialBearing(from, to) {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLambda = toRad(to.lng - from.lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}

// שמות 16 כיווני רוח בעברית, לפי טווחים של 22.5 מעלות
const POINTS = [
  "צפון", "צפון-צפון-מזרח", "צפון-מזרח", "מזרח-צפון-מזרח",
  "מזרח", "מזרח-דרום-מזרח", "דרום-מזרח", "דרום-דרום-מזרח",
  "דרום", "דרום-דרום-מערב", "דרום-מערב", "מערב-דרום-מערב",
  "מערב", "מערב-צפון-מערב", "צפון-מערב", "צפון-צפון-מערב",
];
function compassPointHe(deg) {
  return POINTS[Math.round(normalizeDegrees(deg) / 22.5) % 16];
}

// כיוון התפילה מנקודה נתונה: { bearing, bearingRounded, pointHe, distanceKm, isAtTarget }
function prayerDirection(from) {
  const distanceKm = haversineKm(from, TEMPLE_MOUNT);
  // קרוב מאוד להר הבית (פחות מ-50 מ') הכיוון לא מוגדר - מחזירים "אתם כאן"
  const isAtTarget = distanceKm < 0.05;
  const bearing = isAtTarget ? 0 : initialBearing(from, TEMPLE_MOUNT);
  return {
    bearing,
    bearingRounded: Math.round(bearing),
    pointHe: isAtTarget ? "" : compassPointHe(bearing),
    distanceKm,
    isAtTarget,
  };
}

// הפרש הזוויות הקצר ביותר (בטווח [-180,180]) - למניעת "סיבוב שלם" של המחוג כשעוברים מ-359° ל-1°
function shortestAngleDelta(fromDeg, toDeg_) {
  return ((toDeg_ - fromDeg + 540) % 360) - 180;
}

// זווית המחוג על המסך: כמה לסובב אותו מ"למעלה" כדי שיצביע לירושלים, בהינתן שהמכשיר פונה ל-heading (מעלות מצפון)
function needleAngle(bearing, heading) {
  return normalizeDegrees(bearing - heading);
}

module.exports = {
  TEMPLE_MOUNT,
  normalizeDegrees,
  initialBearing,
  compassPointHe,
  prayerDirection,
  shortestAngleDelta,
  needleAngle,
};
