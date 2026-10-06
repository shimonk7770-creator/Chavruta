// server/utils/shabbatTimes.js
// עוטף את חבילת @hebcal/core (חישוב אסטרונומי אמיתי ומבוסס-מיקום של זמני שבת/יום טוב) עבור כרטיס
// "זמני שבת" בדף הבית - רעיון שהועבר מפרויקט React נפרד ("חת"ת יומי") שהמשתמש בנה בעבר.
//
// הבהרה חשובה לגבי היקף הפרויקט: עמוד "מעגל השנה" (Holiday.gregorianDate, server/utils/calendarGrid.js)
// עדיין לא מחשב בעצמו תאריכים עבריים - זה תועד ונשאר במפורש מחוץ להיקף (SRS סעיף 2.2). הפיצ'ר הזה שונה
// במהותו: הוא לא "כותב חישוב אסטרונומי" בעצמנו, אלא משתמש בספרייה סטנדרטית ומוכרת בקוד הפתוח
// (@hebcal/core) בדיוק כמו ש-bcrypt משמש להצפנה במקום לכתוב הצפנה בעצמנו - שימוש נכון בספרייה מוכנה,
// לא עקיפה של הדרישה. תועד גם ב-SRS גרסה 1.3.
//
// @hebcal/core היא חבילת ESM טהורה (בלי תמיכת CommonJS) - לכן טוענים אותה עם import() דינמי בתוך
// פונקציה async, למרות ששאר הפרויקט כותב CommonJS (require) - זה הפתרון הרשמי שהספרייה עצמה ממליצה
// עליו לפרויקטי Node/CommonJS. שומרים את ה-Promise כדי לא לטעון את הספרייה מחדש בכל קריאה.
//
// הערה לגבי בחירת הערים: פונקציית החיפוש המובנית של הספרייה (Location.lookup) עובדת רק על שמות ערים
// באנגלית, ורק על תת-קבוצה מצומצמת של ערים ידועות (למשל "Bnei Brak"/"פתח תקווה" לא נמצאות בה כלל -
// נבדק ידנית). לכן, במקום טופס טקסט חופשי שעלול להיכשל בשקט על רוב הערים בישראל, בנינו כאן רשימה
// סגורה (CITIES) של ערים נפוצות עם קואורדינטות אמיתיות (קו רוחב/אורך) ואזור זמן - וממנה בונים אובייקט
// Location בעצמנו (new Location(...)). זה עדיין 100% חישוב אסטרונומי אמיתי של הספרייה (זריחה/שקיעה/זמן
// הדלקת נרות מחושבים ע"י @hebcal/core לפי הקואורדינטות) - רק שהאיתור של "אילו קואורדינטות לעיר X" נעשה
// דרך תפריט נבחר מראש במקום דרך מנוע החיפוש המוגבל של הספרייה. כך גם ה-UI בפרופיל הופך לתפריט נפתח
// (select) בעברית במקום טופס טקסט שעלול להחזיר "עיר לא נמצאה" עבור רוב הערים בישראל.

let hebcalLoadPromise = null;
function loadHebcal() {
  if (!hebcalLoadPromise) hebcalLoadPromise = import("@hebcal/core");
  return hebcalLoadPromise;
}

// רשימת ערים נתמכת - key יציב שנשמר במסד הנתונים (User.shabbatCity), label לתצוגה בעברית,
// וקואורדינטות + אזור זמן אמיתיים לחישוב האסטרונומי. il=true משפיע על לוח החגים (יום אחד בא"י מול יומיים בגולה).
const CITIES = {
  jerusalem: { label: "ירושלים", lat: 31.7683, lng: 35.2137, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "tel-aviv": { label: "תל אביב-יפו", lat: 32.0853, lng: 34.7818, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  haifa: { label: "חיפה", lat: 32.794, lng: 34.9896, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "beer-sheva": { label: "באר שבע", lat: 31.253, lng: 34.7915, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  eilat: { label: "אילת", lat: 29.5581, lng: 34.9482, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  netanya: { label: "נתניה", lat: 32.3215, lng: 34.8532, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  ashdod: { label: "אשדוד", lat: 31.8044, lng: 34.6553, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "rishon-lezion": { label: "ראשון לציון", lat: 31.973, lng: 34.7925, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "petah-tikva": { label: "פתח תקווה", lat: 32.0878, lng: 34.8878, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "bnei-brak": { label: "בני ברק", lat: 32.0807, lng: 34.8338, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "ramat-gan": { label: "רמת גן", lat: 32.0684, lng: 34.8248, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  rehovot: { label: "רחובות", lat: 31.8928, lng: 34.8113, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  herzliya: { label: "הרצליה", lat: 32.1624, lng: 34.8447, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "kfar-saba": { label: "כפר סבא", lat: 32.175, lng: 34.907, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  raanana: { label: "רעננה", lat: 32.1848, lng: 34.8713, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  modiin: { label: "מודיעין", lat: 31.8928, lng: 35.0095, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "beit-shemesh": { label: "בית שמש", lat: 31.7514, lng: 34.9886, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  safed: { label: "צפת", lat: 32.9646, lng: 35.496, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  tiberias: { label: "טבריה", lat: 32.7922, lng: 35.5312, tzid: "Asia/Jerusalem", il: true, country: "IL" },
  "new-york": { label: "ניו יורק", lat: 40.7128, lng: -74.006, tzid: "America/New_York", il: false, country: "US" },
  london: { label: "לונדון", lat: 51.5074, lng: -0.1278, tzid: "Europe/London", il: false, country: "GB" },
};

const DEFAULT_CITY_KEY = "jerusalem";

// רשימת אפשרויות לתפריט הנפתח בטופס הפרופיל - [{key, label}], לפי סדר ההגדרה למעלה
function getCityOptions() {
  return Object.keys(CITIES).map((key) => ({ key, label: CITIES[key].label }));
}

// בודקת שמפתח העיר קיים ברשימה הנתמכת (משמש לאימות req.body.shabbatCity בקונטרולר)
function isValidCityKey(cityKey) {
  return Object.prototype.hasOwnProperty.call(CITIES, cityKey || "");
}

// בונה אובייקט Location אמיתי של הספרייה מתוך רשומת העיר שלנו
async function buildLocation(cityKey) {
  const { Location } = await loadHebcal();
  const city = CITIES[cityKey] || CITIES[DEFAULT_CITY_KEY];
  return new Location(city.lat, city.lng, city.il, city.tzid, city.label, city.country);
}

// זמני כניסת/יציאת השבת (או יום טוב) הקרובים, שם הפרשה (אם רלוונטי השבוע) ועד 4 אירועים נוספים
// בשבועיים הקרובים, לפי מפתח עיר מתוך CITIES. תמיד מחזיר תוצאה (נופלת לירושלים אם המפתח לא מוכר).
async function getUpcomingShabbat(cityKey = DEFAULT_CITY_KEY) {
  const { HebrewCalendar } = await loadHebcal();
  const location = await buildLocation(cityKey);

  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  const events = HebrewCalendar.calendar({
    start,
    end,
    location,
    il: location.getIsrael(),
    candlelighting: true,
    sedrot: true,
  });

  const candleEvt = events.find((e) => e.getDesc() === "Candle lighting");
  const havdalahEvt = events.find((e) => e.getDesc() === "Havdalah");
  const parashaEvt = events.find((e) => e.getDesc().startsWith("Parashat"));

  const upcoming = events
    .filter((e) => e !== candleEvt && e !== havdalahEvt && e !== parashaEvt)
    .slice(0, 4)
    .map((e) => e.render("he"));

  return {
    cityHe: location.getName(),
    candleLighting: candleEvt ? candleEvt.render("he").replace("הַדְלָקַת נֵרוֹת: ", "") : null,
    havdalah: havdalahEvt ? havdalahEvt.render("he").replace("הַבְדָּלָה: ", "") : null,
    parashaHe: parashaEvt ? parashaEvt.render("he").replace("פָּרָשַׁת ", "") : null,
    upcoming,
  };
}

// buildLocation מיוצאת גם כן - עמוד "זמני היום" (zmanimTimes.js) משתמש באותה רשימת ערים ובאותו Location
module.exports = { getUpcomingShabbat, isValidCityKey, getCityOptions, buildLocation, DEFAULT_CITY_KEY };
