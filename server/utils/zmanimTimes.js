// server/utils/zmanimTimes.js
// חישוב "זמני היום" ההלכתיים (עלות השחר, זמן ציצית ותפילין, הנץ, סוף זמן ק"ש/תפילה, חצות, מנחה גדולה/קטנה,
// פלג המנחה, שקיעה, צאת הכוכבים, כניסת/צאת שבת) לעיר ולתאריך נבחרים - עמוד "זמני היום" (/zmanim),
// בהשראת עמוד הזמנים של אתר חב"ד (chabad.org.il/Time).
//
// למה לא "גורפים" (scraping) את אתר חב"ד: ניסינו - האתר לא חושף API ולא פרמטרים יציבים, וגרידת HTML בזמן ריצה
// שבירה (כל שינוי עיצוב באתר שלהם שובר לנו את העמוד) ולא ניתנת לבדיקה אוטומטית. במקום זה מחשבים את הזמנים
// בעצמנו, אסטרונומית ובזמן אמת, עם ספריית @hebcal/core (אותה ספרייה שכבר משמשת את כרטיס "זמני שבת" -
// shabbatTimes.js) ומיישרים את ההגדרות להגדרות שחב"ד מציגה באתר שלה:
//   * עלות השחר (לדעה המקדימה) = 120 דקות לפני הנץ;  עלות השחר (לדעה המאחרת) = 72 דקות לפני הנץ
//   * זמן ציצית ותפילין = השמש 11.5° מתחת לאופק
//   * סוף זמן ק"ש / תפילה = 3 / 4 שעות זמניות מהנץ (שיטת הגר"א)
//   * מנחה גדולה = חצי שעה אחרי חצות היום;  מנחה קטנה = 9.5 שעות זמניות;  פלג המנחה = 10.75 שעות זמניות
//   * צאת הכוכבים = השמש 6° מתחת לאופק;  כניסת שבת = שקיעה פחות X דקות (X תלוי בעיר, ראו CANDLE_MINUTES)
//   * צאת השבת = השמש 8.5° מתחת לאופק
// הערה כנה: זו חישוב אסטרונומי עצמאי ולא העתקה של האתר - ייתכן הפרש של דקה-שתיים בחלק מהזמנים לעומת
// אתר חב"ד (נבדק מול תל אביב 6/10/2026, ראו server/test/zmanimTimes.test.js).
//
// @hebcal/core היא חבילת ESM טהורה - טוענים אותה עם import() דינמי (כמו ב-shabbatTimes.js).

const { buildLocation, isValidCityKey, DEFAULT_CITY_KEY, getCityOptions } = require("./shabbatTimes");

let hebcalLoadPromise = null;
function loadHebcal() {
  if (!hebcalLoadPromise) hebcalLoadPromise = import("@hebcal/core");
  return hebcalLoadPromise;
}

// כמה דקות לפני השקיעה מדליקים נרות - מנהג המקום: ירושלים 40, חיפה/צפת/טבריה 30, שאר ערי ישראל 20,
// בחו"ל 18. מפתח = אותו key כמו ב-CITIES (shabbatTimes.js). ערים שלא מופיעות כאן ויושבות בישראל מקבלות 20.
const CANDLE_MINUTES = { jerusalem: 40, haifa: 30, safed: 30, tiberias: 30, "new-york": 18, london: 18 };
function candleMinutesFor(cityKey, isIsrael) {
  if (CANDLE_MINUTES[cityKey] !== undefined) return CANDLE_MINUTES[cityKey];
  return isIsrael ? 20 : 18;
}

// מעגל לדקה הקרובה (חב"ד מציגה דקות שלמות, בלי שניות) ומחזיר חותמת זמן (epoch ms) של אותה דקה עגולה
function roundToMinute(date) {
  return Math.round(date.getTime() / 60000) * 60000;
}

// "HH:MM" לפי אזור הזמן של העיר (לא של השרת!) - כך שהשרת יכול לרוץ בכל אזור זמן והתוצאה זהה
function formatClock(ts, tzid) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tzid, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
}

// תאריך "YYYY-MM-DD" של "היום" באזור הזמן של העיר
function todayIn(tzid) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tzid, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// ולידציה של פרמטר התאריך מה-URL: פורמט YYYY-MM-DD, תאריך אמיתי בטווח סביר. אחרת null (והקונטרולר יחזור להיום)
function parseDateParam(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200) return null;
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null; // למשל 2026-02-31
  return { y, mo, d };
}

// מוסיף/מחסיר ימים לתאריך YYYY-MM-DD (לקישורי "יום קודם/הבא")
function shiftDateISO(iso, days) {
  const p = parseDateParam(iso);
  if (!p) return iso;
  const dt = new Date(p.y, p.mo - 1, p.d + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// הפונקציה הראשית: מחשבת את כל הזמנים לעיר + תאריך. תמיד מחזירה תוצאה (עיר לא מוכרת -> ירושלים, תאריך לא תקין -> היום).
async function getZmanim(cityKey, dateISO) {
  const { Zmanim, HDate } = await loadHebcal();
  const safeCity = isValidCityKey(cityKey) ? cityKey : DEFAULT_CITY_KEY;
  const location = await buildLocation(safeCity);
  const tzid = location.getTzid();

  const parsed = parseDateParam(dateISO) || parseDateParam(todayIn(tzid));
  const day = new Date(parsed.y, parsed.mo - 1, parsed.d); // רק רכיבי התאריך משמשים את Zmanim (שעות מתעלמים)
  const z = new Zmanim(location, day, false);

  const sunrise = roundToMinute(z.sunrise());
  const sunset = roundToMinute(z.sunset());
  const chatzot = roundToMinute(z.chatzot());
  const MIN = 60000;
  // חצות הלילה של "היום" הוא החצות שאחרי השקיעה (בקרבת 00:30 של למחרת). ב-Hebcal chatzotNight() של תאריך D
  // מחזיר את חצות הלילה *שבתחילת* אותו תאריך, ולכן לוקחים אותו מהמופע של היום הבא
  const nextDay = new Date(parsed.y, parsed.mo - 1, parsed.d + 1);
  const chatzotNight = roundToMinute(new Zmanim(location, nextDay, false).chatzotNight());

  // כל שורה: key לזיהוי, label בעברית כמו באתר חב"ד, ts לאנימציה/הדגשה בצד הלקוח, note הסבר קצר להגדרה
  const rows = [
    { key: "alotEarly", label: "עלות השחר (לדעה המקדימה)", ts: sunrise - 120 * MIN, note: "120 דקות לפני הנץ החמה" },
    { key: "alotLate", label: "עלות השחר (לדעה המאחרת)", ts: sunrise - 72 * MIN, note: "72 דקות לפני הנץ החמה" },
    { key: "tefillin", label: "זמן ציצית ותפילין", ts: roundToMinute(z.misheyakir()), note: "השמש 11.5° מתחת לאופק" },
    { key: "sunrise", label: "הנץ החמה (זריחה)", ts: sunrise, note: "" },
    { key: "shema", label: 'סוף זמן קריאת שמע', ts: roundToMinute(z.sofZmanShma()), note: 'לפי הגר"א - 3 שעות זמניות' },
    { key: "tfila", label: "סוף זמן תפילה", ts: roundToMinute(z.sofZmanTfilla()), note: 'לפי הגר"א - 4 שעות זמניות' },
    { key: "chatzot", label: "חצות היום", ts: chatzot, note: "" },
    { key: "minchaGedola", label: "מנחה גדולה", ts: chatzot + 30 * MIN, note: "חצי שעה אחרי חצות" },
    { key: "minchaKetana", label: "מנחה קטנה", ts: roundToMinute(z.minchaKetana()), note: "9.5 שעות זמניות" },
    { key: "plag", label: "פלג המנחה", ts: roundToMinute(z.plagHaMincha()), note: "10.75 שעות זמניות" },
    { key: "sunset", label: "שקיעת החמה", ts: sunset, note: "" },
    { key: "tzeit", label: "צאת הכוכבים", ts: roundToMinute(z.tzeit(6)), note: "השמש 6° מתחת לאופק" },
    { key: "chatzotNight", label: "חצות הלילה", ts: chatzotNight, note: "" },
  ].map((r) => ({ ...r, time: formatClock(r.ts, tzid) }));

  // כניסת/צאת שבת של השבת הקרובה לתאריך שנבחר (אם נבחר שבת - השבת הבאה). Friday=5.
  const dow = day.getDay();
  const fridayOffset = (5 - dow + 7) % 7;
  const friday = new Date(parsed.y, parsed.mo - 1, parsed.d + fridayOffset);
  const saturday = new Date(parsed.y, parsed.mo - 1, parsed.d + fridayOffset + 1);
  const candleMinutes = candleMinutesFor(safeCity, location.getIsrael());
  const fridayZ = new Zmanim(location, friday, false);
  const saturdayZ = new Zmanim(location, saturday, false);
  const candleTs = roundToMinute(fridayZ.sunset()) - candleMinutes * MIN;
  const havdalahTs = roundToMinute(saturdayZ.tzeit(8.5));

  const pad = (n) => String(n).padStart(2, "0");
  const shabbat = {
    fridayISO: `${friday.getFullYear()}-${pad(friday.getMonth() + 1)}-${pad(friday.getDate())}`,
    candleTs,
    candleTime: formatClock(candleTs, tzid),
    candleNote: `${candleMinutes} דקות לפני השקיעה`,
    havdalahTs,
    havdalahTime: formatClock(havdalahTs, tzid),
    havdalahNote: "השמש 8.5° מתחת לאופק",
  };

  const dateISOOut = `${parsed.y}-${pad(parsed.mo)}-${pad(parsed.d)}`;
  return {
    cityKey: safeCity,
    cityLabel: location.getName(),
    tzid,
    dateISO: dateISOOut,
    isToday: dateISOOut === todayIn(tzid),
    weekdayHe: new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(parsed.y, parsed.mo - 1, parsed.d, 12))),
    hebrewDate: new HDate(day).renderGematriya(true), // true = בלי ניקוד
    gregorianDateHe: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parsed.y, parsed.mo - 1, parsed.d, 12))),
    rows,
    shabbat,
  };
}

module.exports = { getZmanim, parseDateParam, shiftDateISO, todayIn, getCityOptions, candleMinutesFor };
