// server/utils/sefariaPrayers.js
// נוסח תפילה (שחרית/מנחה/ערבית × אשכנז/ספרד/עדות המזרח) - הטקסט נשלף מ-Sefaria (ספריא), ספריית טקסטים פתוחה
// ובחינמית (API ציבורי: developers.sefaria.org). בחירת המקור: המשתמש בחר ב-Sefaria API.
//
// איך זה עובד (בקצרה):
//  1. טוענים את "עץ הסעיפים" של הסידור (GET /api/v2/raw/index/<שם הסידור>) - מבנה מורכב של צמתים (SchemaNode)
//     ועלים (JaggedArrayNode) - כל עלה הוא פסקה/קטע תפילה בפני עצמו (למשל "Amidah", "The Shema").
//  2. מחפשים בעץ את הצומת של התפילה הרצויה (חול בלבד - לא שבת/חג/ראש חודש) ואוספים את כל העלים שלו לפי הסדר.
//  3. לכל עלה שולפים את הטקסט העברי (GET /api/v3/texts/<ref>; אם נכשל - ניסיון נוסף ב-/api/texts הישן).
//  4. שומרים תוצאה ב-cache (זיכרון + קובץ בדיסק) - כך שהטעינה הראשונה איטית (עשרות בקשות) וכל מה שאחריה מיידי,
//     וגם עובד בלי אינטרנט (חשוב להגנה על הפרויקט) אחרי שהנוסח כבר נשלף פעם אחת.
//
// כל הלוגיקה "הטהורה" (בניית ref, איתור צומת התפילה, שיטוח טקסט, ניקוי HTML) מופרדת מהרשת ומכוסה בבדיקות
// אוטומטיות (server/test/sefariaPrayers.test.js) על נתוני דוגמה; הבקשות עצמן מקבלות fetchImpl להזרקה בבדיקות.
//
// כנות לגבי התלות החיצונית: פורמט ה-API נבנה לפי התיעוד הרשמי של Sefaria. אם Sefaria תשנה את הפורמט, או שאין
// אינטרנט וגם אין cache, העמוד מציג הודעת שגיאה ברורה (ולא קורס).

const fs = require("fs");
const path = require("path");

const SEFARIA_BASE = "https://www.sefaria.org";
const REQUEST_TIMEOUT_MS = 15000;
const CONCURRENCY = 4; // מספר בקשות במקביל - מספיק מהיר ועדיין מנומס לשרת חינמי
const CACHE_DIR = path.join(__dirname, "..", "cache", "prayers");
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // חודש - נוסח התפילה כמעט לא משתנה

// הנוסחים הנתמכים: key יציב ב-URL, label בעברית, ושם האינדקס (Index) ב-Sefaria
const NUSACHIM = {
  ashkenaz: { label: "אשכנז", indexTitle: "Siddur Ashkenaz" },
  sefard: { label: "ספרד", indexTitle: "Siddur Sefard" },
  edot: { label: "עדות המזרח", indexTitle: "Siddur Edot HaMizrach" },
};

// התפילות: label בעברית + ביטוי רגולרי שמזהה את שם הצומת באנגלית בעץ של Sefaria
const PRAYERS = {
  shacharit: { label: "שחרית", icon: "🌅", match: /\b(shacharit|shachrit|morning (service|prayers?))\b/i },
  mincha: { label: "מנחה", icon: "☀️", match: /\bminch?ah?\b/i },
  arvit: { label: "ערבית", icon: "🌙", match: /\b(ma'?ariv|arvit|evening (service|prayers?))\b/i },
};

// צמתים שאסור לבחור כי הם לא "תפילת חול" רגילה
const EXCLUDE = /shabbat|rosh chodesh|holiday|festival|yom tov|fast|shavuot|pesach|sukkot|chanukah|hanukkah|purim|motzaei|additions|three festivals/i;

function isValidNusach(key) {
  return Object.prototype.hasOwnProperty.call(NUSACHIM, key || "");
}
function isValidPrayer(key) {
  return Object.prototype.hasOwnProperty.call(PRAYERS, key || "");
}

// ===== פונקציות טהורות (בלי רשת) =====

// שם ראשי (primary) של צומת בשפה נתונה, מתוך מערך titles של Sefaria: [{lang:"en",text:"...",primary:true}, ...]
function primaryTitle(node, lang) {
  const titles = (node && node.titles) || [];
  const primary = titles.find((t) => t.lang === lang && t.primary) || titles.find((t) => t.lang === lang);
  return primary ? primary.text : "";
}

// מיישר את עץ ה-schema לרשימה שטוחה של צמתים: { enTitle, heTitle, ref, depthInTree, isLeaf, chain:[שמות אנגליים] }.
// ref של צומת = שמות האב-קדמון מופרדים בפסיק ורווח (כך Sefaria מזהה צמתים בסכמה מורכבת).
// צומת "default" (בלי שם) הוא תוכן שיושב ישירות תחת האב - ה-ref שלו זהה ל-ref של האב.
function flattenSchema(schema, indexTitle) {
  const out = [];
  function walk(node, parentRef, chain, level, isRoot) {
    let enTitle = primaryTitle(node, "en");
    const heTitle = primaryTitle(node, "he");
    const isDefault = !!node.default || (!enTitle && !isRoot);
    let ref;
    if (isRoot) {
      enTitle = enTitle || indexTitle;
      ref = indexTitle;
    } else if (isDefault) {
      ref = parentRef;
    } else {
      ref = `${parentRef}, ${enTitle}`;
    }
    const children = Array.isArray(node.nodes) ? node.nodes : [];
    const nextChain = isDefault && !isRoot ? chain : [...chain, enTitle];
    out.push({ enTitle, heTitle, ref, level, isLeaf: children.length === 0, chain: nextChain, isDefault });
    children.forEach((child) => walk(child, ref, nextChain, level + 1, false));
  }
  walk(schema, indexTitle, [], 0, true);
  return out;
}

// מוצאת את הצומת של התפילה ברשימה השטוחה: הצומת הרדוד ביותר שהשם שלו תואם, ב"חול" (לא חריג), וההורים שלו
// לא כוללים "שבת/חג". דורשת "weekday" בשרשרת השמות - כך "Evening Prayers" (קידוש לבנה, קריאת שמע שעל המיטה) לא נתפס כערבית.
function findPrayerNode(flat, prayerKey) {
  const prayer = PRAYERS[prayerKey];
  if (!prayer) return null;
  const candidates = flat.filter((n) => {
    if (n.level === 0 || n.isDefault) return false;
    const chainText = n.chain.join(" / ");
    if (!/weekday/i.test(chainText)) return false;
    if (EXCLUDE.test(chainText)) return false;
    return prayer.match.test(n.enTitle);
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.level - b.level); // sort יציב - בשוויון נשמר הסדר שבעץ
  return candidates[0];
}

// כל העלים שמתחת לצומת (לפי סדר הופעתם), או הצומת עצמו אם הוא עלה
function collectLeaves(flat, node) {
  const startIdx = flat.indexOf(node);
  if (startIdx === -1) return [];
  if (node.isLeaf) return [node];
  const leaves = [];
  for (let i = startIdx + 1; i < flat.length; i++) {
    const n = flat[i];
    if (n.level <= node.level) break; // יצאנו מהתת-עץ
    if (n.isLeaf) leaves.push(n);
  }
  return leaves;
}

// מנקה HTML מטקסט של Sefaria (<b>, <small>, <br>, ישויות) לטקסט פשוט - ההצגה בדף היא ב-textContent (בטוח מ-XSS)
function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// מיישר טקסט של Sefaria (מחרוזת / מערך / מערך מקונן) לרשימת שורות לא ריקות ונקיות
function flattenText(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const s = stripHtml(value);
    return s ? [s] : [];
  }
  if (Array.isArray(value)) return value.reduce((acc, v) => acc.concat(flattenText(v)), []);
  return [];
}

// שולף את הטקסט העברי מתשובת v3: { versions: [ { language:"he", text: ... } ] }
function parseV3Response(data) {
  if (!data || !Array.isArray(data.versions)) return [];
  for (const v of data.versions) {
    const lines = flattenText(v && v.text);
    if (lines.length) return lines;
  }
  return [];
}

// שולף את הטקסט העברי מתשובת ה-API הישן (/api/texts): { he: ... , text: ... }
function parseV1Response(data) {
  if (!data) return [];
  return flattenText(data.he);
}

// ===== רשת =====

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "ChavrutaStudentProject/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sefaria החזיר סטטוס ${res.status} עבור ${url}`);
  return res.json();
}

// טקסט עברי של עלה בודד: קודם v3 (העדכני), ואם נכשל/ריק - ה-API הישן כגיבוי
async function fetchLeafLines(ref, fetchImpl) {
  const encoded = encodeURIComponent(ref);
  try {
    const data = await getJson(`${SEFARIA_BASE}/api/v3/texts/${encoded}?version=hebrew&return_format=text_only`, fetchImpl);
    const lines = parseV3Response(data);
    if (lines.length) return lines;
  } catch (e) {
    // ממשיכים לגיבוי
  }
  const data = await getJson(`${SEFARIA_BASE}/api/texts/${encoded}?context=0&commentary=0&pad=0&wrapLinks=0`, fetchImpl);
  return parseV1Response(data);
}

// מריץ משימות async עם הגבלת מקביליות (שומר על סדר התוצאות)
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// בונה את הנוסח המלא מהרשת: { nusach, prayer, title, sections:[{title,heTitle,lines:[...]}], source, fetchedAt }
// אם התפילה לא קיימת בסידור (למשל מנחה/ערבית בחול ב"עדות המזרח" ב-Sefaria) מחזירה { unavailable: true, reason }
async function buildPrayerFromSefaria(nusachKey, prayerKey, fetchImpl = fetch) {
  const nusach = NUSACHIM[nusachKey];
  const indexData = await getJson(`${SEFARIA_BASE}/api/v2/raw/index/${encodeURIComponent(nusach.indexTitle)}`, fetchImpl);
  if (!indexData || !indexData.schema) throw new Error("לא התקבל מבנה (schema) של הסידור מ-Sefaria");

  const flat = flattenSchema(indexData.schema, nusach.indexTitle);
  const node = findPrayerNode(flat, prayerKey);
  if (!node) {
    return {
      unavailable: true,
      reason: `בספריית Sefaria אין כרגע בסידור "${nusach.label}" פרק נפרד לתפילת ${PRAYERS[prayerKey].label} של יום חול.`,
    };
  }

  const leaves = collectLeaves(flat, node);
  const sections = await mapWithConcurrency(leaves, CONCURRENCY, async (leaf) => {
    let lines = [];
    try {
      lines = await fetchLeafLines(leaf.ref, fetchImpl);
    } catch (e) {
      lines = []; // קטע בודד שנכשל לא מפיל את כל התפילה - ידולג (ויודפס בלוג השרת)
      console.warn("sefariaPrayers: כשל בשליפת קטע", leaf.ref, e.message);
    }
    return { title: leaf.enTitle, heTitle: leaf.heTitle || leaf.enTitle, lines };
  });

  const nonEmpty = sections.filter((s) => s.lines.length);
  if (!nonEmpty.length) throw new Error("לא הצלחנו לשלוף טקסט עברי עבור התפילה מ-Sefaria");

  return {
    nusach: nusachKey,
    prayer: prayerKey,
    title: `${PRAYERS[prayerKey].label} - נוסח ${nusach.label}`,
    sections: nonEmpty,
    source: "Sefaria",
    fetchedAt: new Date().toISOString(),
  };
}

// ===== cache (זיכרון + דיסק) =====

const memoryCache = new Map(); // key -> תוצאה
const inFlight = new Map(); // key -> Promise (מונע כמה שליפות זהות במקביל)

function cacheFile(dir, nusachKey, prayerKey) {
  return path.join(dir, `${nusachKey}-${prayerKey}.json`);
}

// dir === null מכבה את cache הדיסק לגמרי (משמש בבדיקות האוטומטיות, כדי שלא יכתבו קבצים לפרויקט)
function readDiskCache(dir, nusachKey, prayerKey, now = Date.now()) {
  if (!dir) return null;
  try {
    const file = cacheFile(dir, nusachKey, prayerKey);
    const stat = fs.statSync(file);
    if (now - stat.mtimeMs > CACHE_MAX_AGE_MS) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null; // אין קובץ / קובץ פגום - פשוט שולפים מחדש
  }
}

function writeDiskCache(dir, nusachKey, prayerKey, data) {
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile(dir, nusachKey, prayerKey), JSON.stringify(data), "utf8");
  } catch (e) {
    console.warn("sefariaPrayers: לא הצלחנו לשמור cache לדיסק:", e.message); // לא קריטי
  }
}

// הפונקציה הראשית לשימוש הקונטרולר. תמיד מחזירה אובייקט תוצאה או זורקת שגיאה עם הודעה קריאה.
async function getPrayer(nusachKey, prayerKey, options = {}) {
  if (!isValidNusach(nusachKey) || !isValidPrayer(prayerKey)) {
    throw new Error("נוסח או תפילה לא מוכרים");
  }
  const key = `${nusachKey}:${prayerKey}`;
  const cacheDir = options.cacheDir === undefined ? CACHE_DIR : options.cacheDir; // null = בלי דיסק (בדיקות)
  if (memoryCache.has(key)) return memoryCache.get(key);

  const fromDisk = readDiskCache(cacheDir, nusachKey, prayerKey);
  if (fromDisk) {
    memoryCache.set(key, fromDisk);
    return fromDisk;
  }

  if (inFlight.has(key)) return inFlight.get(key);
  const promise = buildPrayerFromSefaria(nusachKey, prayerKey, options.fetchImpl || fetch)
    .then((result) => {
      memoryCache.set(key, result);
      if (!result.unavailable) writeDiskCache(cacheDir, nusachKey, prayerKey, result); // "לא זמין" לא נשמר בדיסק - שיתעדכן אם Sefaria תוסיף
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

function clearMemoryCache() {
  memoryCache.clear();
  inFlight.clear();
}

module.exports = {
  NUSACHIM,
  PRAYERS,
  isValidNusach,
  isValidPrayer,
  getPrayer,
  clearMemoryCache,
  // לבדיקות:
  primaryTitle,
  flattenSchema,
  findPrayerNode,
  collectLeaves,
  stripHtml,
  flattenText,
  parseV3Response,
  parseV1Response,
  buildPrayerFromSefaria,
};
