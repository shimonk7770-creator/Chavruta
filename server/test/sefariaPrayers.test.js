// server/test/sefariaPrayers.test.js
// בדיקות ללוגיקת נוסח התפילה (server/utils/sefariaPrayers.js) - בלי רשת אמיתית: משתמשים בעץ סידור לדוגמה
// (במבנה של Sefaria) ובפונקציית fetch מזויפת. הבדיקה מוודאת איתור נכון של תפילת החול (ולא שבת/חג),
// בניית ref, שיטוח וניקוי טקסט, גיבוי ל-API ישן, טיפול בתפילה שלא קיימת בסידור, ו-cache.

const test = require("node:test");
const assert = require("node:assert");
const {
  flattenSchema, findPrayerNode, collectLeaves, stripHtml, flattenText,
  parseV3Response, parseV1Response, buildPrayerFromSefaria, getPrayer, clearMemoryCache,
  isValidNusach, isValidPrayer,
} = require("../utils/sefariaPrayers");

// עוזר לבניית צומת בפורמט titles של Sefaria
function node(en, he, children, extra = {}) {
  const n = { titles: [{ lang: "en", text: en, primary: true }, { lang: "he", text: he, primary: true }], ...extra };
  if (children) n.nodes = children;
  return n;
}

// סידור "אשכנז" לדוגמה: Weekday -> Shacharit/Minchah/Maariv, ובנוסף חלקי שבת/חג שאסור לבחור
const ashkenazSchema = {
  titles: [{ lang: "en", text: "Siddur Ashkenaz", primary: true }, { lang: "he", text: "סידור אשכנז", primary: true }],
  nodes: [
    node("Weekday", "חול", [
      node("Shacharit", "שחרית", [
        node("Morning Blessings", "ברכות השחר", null, { depth: 1 }),
        node("Shema", "קריאת שמע", null, { depth: 1 }),
        node("Amidah", "עמידה", null, { depth: 1 }),
      ]),
      node("Minchah", "מנחה", [
        node("Ashrei", "אשרי", null, { depth: 1 }),
        node("Amidah", "עמידה", null, { depth: 1 }),
      ]),
      node("Maariv", "מעריב", [
        node("Shema", "קריאת שמע", null, { depth: 1 }),
        node("Amidah", "עמידה", null, { depth: 1 }),
      ]),
    ]),
    node("Shabbat", "שבת", [
      node("Shacharit", "שחרית", [node("Amidah", "עמידה", null, { depth: 1 })]),
      node("Minchah", "מנחה", [node("Amidah", "עמידה", null, { depth: 1 })]),
    ]),
    node("Evening Prayers", "תפילות ערב", [node("Bedtime Shema", "קריאת שמע על המיטה", null, { depth: 1 })]),
  ],
};

// סידור "עדות המזרח" לדוגמה - כמו המצב ב-Sefaria: רק שחרית של חול
const edotSchema = {
  titles: [{ lang: "en", text: "Siddur Edot HaMizrach", primary: true }],
  nodes: [
    node("Weekday Shacharit", "שחרית לימות החול", [node("Amidah", "עמידה", null, { depth: 1 })]),
    node("Shabbat Mincha", "מנחה לשבת", [node("Amidah", "עמידה", null, { depth: 1 })]),
  ],
};

test("flattenSchema: בונה ref מופרד בפסיקים לכל צומת", () => {
  const flat = flattenSchema(ashkenazSchema, "Siddur Ashkenaz");
  const amidah = flat.find((n) => n.ref === "Siddur Ashkenaz, Weekday, Shacharit, Amidah");
  assert.ok(amidah, "ה-ref של עמידת שחרית צריך להיות מלא");
  assert.strictEqual(amidah.isLeaf, true);
  assert.strictEqual(amidah.heTitle, "עמידה");
});

test("flattenSchema: צומת default (בלי שם) יושב על ה-ref של האב", () => {
  const schema = {
    titles: [{ lang: "en", text: "Book", primary: true }],
    nodes: [node("Part", "חלק", [{ default: true, nodeType: "JaggedArrayNode", depth: 1 }, node("Sub", "תת", null)])],
  };
  const flat = flattenSchema(schema, "Book");
  const def = flat.find((n) => n.isDefault);
  assert.strictEqual(def.ref, "Book, Part");
});

test("findPrayerNode: בוחר את תפילת החול ולא שבת/ערב", () => {
  const flat = flattenSchema(ashkenazSchema, "Siddur Ashkenaz");
  assert.strictEqual(findPrayerNode(flat, "shacharit").ref, "Siddur Ashkenaz, Weekday, Shacharit");
  assert.strictEqual(findPrayerNode(flat, "mincha").ref, "Siddur Ashkenaz, Weekday, Minchah");
  assert.strictEqual(findPrayerNode(flat, "arvit").ref, "Siddur Ashkenaz, Weekday, Maariv");
});

test("findPrayerNode: נוסח שבו קיימת רק שחרית - מנחה וערבית לא נמצאות", () => {
  const flat = flattenSchema(edotSchema, "Siddur Edot HaMizrach");
  assert.strictEqual(findPrayerNode(flat, "shacharit").ref, "Siddur Edot HaMizrach, Weekday Shacharit");
  assert.strictEqual(findPrayerNode(flat, "mincha"), null); // "Shabbat Mincha" מוחרג
  assert.strictEqual(findPrayerNode(flat, "arvit"), null);
});

test("collectLeaves: כל העלים של תפילה לפי הסדר, ובלי לחרוג לתפילה הבאה", () => {
  const flat = flattenSchema(ashkenazSchema, "Siddur Ashkenaz");
  const leaves = collectLeaves(flat, findPrayerNode(flat, "shacharit"));
  assert.deepStrictEqual(leaves.map((l) => l.enTitle), ["Morning Blessings", "Shema", "Amidah"]);
  const minchaLeaves = collectLeaves(flat, findPrayerNode(flat, "mincha"));
  assert.deepStrictEqual(minchaLeaves.map((l) => l.enTitle), ["Ashrei", "Amidah"]);
});

test("stripHtml/flattenText: מנקה תגיות, ישויות ומשטח מערכים מקוננים", () => {
  assert.strictEqual(stripHtml("<b>ברוך</b> אתה&nbsp;ה'<br>שלום &amp; ברכה"), "ברוך אתה ה'\nשלום & ברכה");
  assert.deepStrictEqual(flattenText(["א", ["ב", ["<i>ג</i>", ""]], null, "  "]), ["א", "ב", "ג"]);
  assert.deepStrictEqual(flattenText(undefined), []);
});

test("parseV3Response / parseV1Response: שולפים טקסט עברי ומתעלמים מגרסאות ריקות", () => {
  assert.deepStrictEqual(parseV3Response({ versions: [{ text: [] }, { text: ["שלום", "עולם"] }] }), ["שלום", "עולם"]);
  assert.deepStrictEqual(parseV3Response({ versions: [] }), []);
  assert.deepStrictEqual(parseV3Response(null), []);
  assert.deepStrictEqual(parseV1Response({ he: ["א", "ב"], text: ["a"] }), ["א", "ב"]);
});

// fetch מזויף: מחזיר index לפי שם הסידור, וטקסט לפי ה-ref שבכתובת
function makeFakeFetch(schemas, texts, calls = []) {
  return async (url) => {
    calls.push(url);
    const u = decodeURIComponent(url);
    const idx = /\/api\/v2\/raw\/index\/(.+)$/.exec(u);
    if (idx) {
      const schema = schemas[idx[1]];
      return { ok: !!schema, status: schema ? 200 : 404, json: async () => ({ schema }) };
    }
    const v3 = /\/api\/v3\/texts\/([^?]+)/.exec(u);
    if (v3) {
      const t = texts[v3[1]];
      if (t && t.v3) return { ok: true, status: 200, json: async () => ({ versions: [{ text: t.v3 }] }) };
      return { ok: false, status: 404, json: async () => ({}) };
    }
    const v1 = /\/api\/texts\/([^?]+)/.exec(u);
    if (v1) {
      const t = texts[v1[1]];
      return { ok: !!(t && t.v1), status: t && t.v1 ? 200 : 404, json: async () => ({ he: t && t.v1 }) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
}

test("buildPrayerFromSefaria: בונה תפילה מלאה (v3 + גיבוי v1 לקטע אחד)", async () => {
  const texts = {
    "Siddur Ashkenaz, Weekday, Shacharit, Morning Blessings": { v3: ["<b>מודה</b> אני", "ברוך אתה"] },
    "Siddur Ashkenaz, Weekday, Shacharit, Shema": { v1: ["שמע ישראל"] }, // v3 נכשל -> גיבוי
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah": { v3: ["אדני שפתי תפתח"] },
  };
  const result = await buildPrayerFromSefaria("ashkenaz", "shacharit", makeFakeFetch({ "Siddur Ashkenaz": ashkenazSchema }, texts));
  assert.strictEqual(result.title, "שחרית - נוסח אשכנז");
  assert.deepStrictEqual(result.sections.map((s) => s.heTitle), ["ברכות השחר", "קריאת שמע", "עמידה"]);
  assert.deepStrictEqual(result.sections[0].lines, ["מודה אני", "ברוך אתה"]);
  assert.deepStrictEqual(result.sections[1].lines, ["שמע ישראל"]);
});

test("buildPrayerFromSefaria: קטע שנכשל מדולג ולא מפיל את התפילה", async () => {
  const texts = { "Siddur Ashkenaz, Weekday, Minchah, Amidah": { v3: ["עמידה"] } }; // אשרי חסר
  const result = await buildPrayerFromSefaria("ashkenaz", "mincha", makeFakeFetch({ "Siddur Ashkenaz": ashkenazSchema }, texts));
  assert.deepStrictEqual(result.sections.map((s) => s.title), ["Amidah"]);
});

test("buildPrayerFromSefaria: תפילה שלא קיימת בסידור מחזירה unavailable עם הסבר", async () => {
  const result = await buildPrayerFromSefaria("edot", "arvit", makeFakeFetch({ "Siddur Edot HaMizrach": edotSchema }, {}));
  assert.strictEqual(result.unavailable, true);
  assert.match(result.reason, /עדות המזרח/);
  assert.match(result.reason, /ערבית/);
});

test("buildPrayerFromSefaria: כשאין טקסט בכלל - זורק שגיאה קריאה", async () => {
  await assert.rejects(
    buildPrayerFromSefaria("ashkenaz", "arvit", makeFakeFetch({ "Siddur Ashkenaz": ashkenazSchema }, {})),
    /לא הצלחנו לשלוף/
  );
});

test("getPrayer: cache בזיכרון - הקריאה השנייה לא פונה לרשת; ערכים לא מוכרים נדחים", async () => {
  clearMemoryCache();
  const texts = {
    "Siddur Sefard, Weekday Maariv, Amidah": { v3: ["ערבית"] },
  };
  const sefardSchema = {
    titles: [{ lang: "en", text: "Siddur Sefard", primary: true }],
    nodes: [node("Weekday Maariv", "ערבית לחול", [node("Amidah", "עמידה", null)])],
  };
  const calls = [];
  const fetchImpl = makeFakeFetch({ "Siddur Sefard": sefardSchema }, texts, calls);
  const first = await getPrayer("sefard", "arvit", { fetchImpl, cacheDir: null });
  const callsAfterFirst = calls.length;
  const second = await getPrayer("sefard", "arvit", { fetchImpl, cacheDir: null });
  assert.strictEqual(second, first);
  assert.strictEqual(calls.length, callsAfterFirst, "הקריאה השנייה צריכה להגיע מה-cache");
  await assert.rejects(getPrayer("nope", "arvit", { cacheDir: null }), /לא מוכרים/);
  assert.strictEqual(isValidNusach("edot"), true);
  assert.strictEqual(isValidPrayer("kiddush"), false);
});
