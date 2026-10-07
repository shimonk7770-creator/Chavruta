// server/test/aiController.test.js
// בדיקות לבקר ה-AI עם מודלים ושירות מדומים (בלי Firestore ובלי רשת): ולידציה, 404, cache של סיכום, מיפוי שגיאות
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

// מחליפים ב-require.cache את המודלים והשירות לפני שטוענים את הבקר
function stub(relPath, exportsObj) {
  const full = require.resolve(path.join("..", relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}
const calls = { setAiSummary: [], generate: [] };
const state = { post: null, group: null, genResult: "תשובת בדיקה", genError: null };

const realAi = require("../services/aiService");
stub("models/Post.js", {
  findById: async () => state.post,
  listByGroup: async () => [{ title: "פוסט", authorName: "א", content: "ב" }],
  search: async () => ({ posts: state.sitePosts || [], total: 0 }),
  setAiSummary: async (...a) => calls.setAiSummary.push(a),
});
stub("models/Group.js", { findById: async () => state.group });
stub("models/Comment.js", { listByPost: async () => [] });
const holidayState = { holiday: { id: "h1", holidayName: "פורים", whatWeDo: "משלוח מנות" } };
stub("models/Holiday.js", { findById: async () => holidayState.holiday });
const learningState = { logs: [], goals: [] };
stub("models/LearningLog.js", { listByUser: async () => learningState.logs });
stub("models/LearningGoal.js", { listByUser: async () => learningState.goals });
stub("services/aiService.js", {
  ...realAi,
  generate: async (req) => { calls.generate.push(req); if (state.genError) throw state.genError; return state.genResult; },
});
const controller = require("../controllers/aiController");
const prompts = require("../utils/aiPrompts");

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test("סיכום פוסט: פוסט לא קיים -> 404", async () => {
  state.post = null;
  const res = mockRes();
  await controller.summarizePost({ params: { id: "x" } }, res);
  assert.strictEqual(res.statusCode, 404);
});

test("סיכום פוסט: קריאה ראשונה מייצרת ושומרת, שנייה מחזירה מה-cache בלי AI", async () => {
  const post = { id: "p1", title: "כותרת", content: "תוכן", authorName: "א", category: "dvarTorah" };
  state.post = { ...post };
  calls.generate.length = 0; calls.setAiSummary.length = 0;
  const res1 = mockRes();
  await controller.summarizePost({ params: { id: "p1" } }, res1);
  assert.strictEqual(res1.body.cached, false);
  assert.strictEqual(calls.generate.length, 1);
  assert.strictEqual(calls.setAiSummary.length, 1);

  // הפוסט נשמר עם סיכום+hash -> קריאה שנייה לא מפעילה generate
  state.post = { ...post, aiSummary: "סיכום שמור", aiSummaryHash: prompts.contentHash(post) };
  const res2 = mockRes();
  await controller.summarizePost({ params: { id: "p1" } }, res2);
  assert.strictEqual(res2.body.cached, true);
  assert.strictEqual(res2.body.answer, "סיכום שמור");
  assert.strictEqual(calls.generate.length, 1);

  // הפוסט נערך -> ה-hash לא מתאים -> מחשבים מחדש
  state.post = { ...post, content: "תוכן חדש", aiSummary: "סיכום ישן", aiSummaryHash: prompts.contentHash(post) };
  const res3 = mockRes();
  await controller.summarizePost({ params: { id: "p1" } }, res3);
  assert.strictEqual(res3.body.cached, false);
  assert.strictEqual(calls.generate.length, 2);
});

test("שאלה על פוסט: שאלה קצרה -> 400, פוסט מאורכב -> 404, תקין -> תשובה + disclaimer", async () => {
  state.post = { id: "p1", title: "ת", content: "ב", authorName: "א", category: "update" };
  const bad = mockRes();
  await controller.askAboutPost({ params: { id: "p1" }, body: { question: "א" } }, bad);
  assert.strictEqual(bad.statusCode, 400);

  state.post = { id: "p1", isArchived: true };
  const gone = mockRes();
  await controller.askAboutPost({ params: { id: "p1" }, body: { question: "שאלה תקינה?" } }, gone);
  assert.strictEqual(gone.statusCode, 404);

  state.post = { id: "p1", title: "ת", content: "ב", authorName: "א", category: "update" };
  const ok = mockRes();
  await controller.askAboutPost({ params: { id: "p1" }, body: { question: "שאלה תקינה?" } }, ok);
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.body.answer, "תשובת בדיקה");
  assert.ok(ok.body.disclaimer.includes("AI"));
});

test("שאלה על קבוצה: קבוצה לא קיימת -> 404; תקין -> 200", async () => {
  state.group = null;
  const none = mockRes();
  await controller.askAboutGroup({ params: { id: "g" }, body: { question: "מה יש כאן?" } }, none);
  assert.strictEqual(none.statusCode, 404);
  state.group = { id: "g", name: "קבוצה", topic: "גמרא" };
  const ok = mockRes();
  await controller.askAboutGroup({ params: { id: "g" }, body: { question: "מה יש כאן?" } }, ok);
  assert.strictEqual(ok.statusCode, 200);
});

test("שגיאת AI מבוקרת (מכסה) מתורגמת ל-429 עם הודעה בעברית; שגיאה לא צפויה -> 500 בלי פרטים", async () => {
  state.group = { id: "g", name: "קבוצה" };
  state.genError = new realAi.AiError("QUOTA", "הגענו למגבלה", 429);
  const quota = mockRes();
  await controller.askAboutGroup({ params: { id: "g" }, body: { question: "שאלה תקינה?" } }, quota);
  assert.strictEqual(quota.statusCode, 429);
  assert.strictEqual(quota.body.code, "QUOTA");

  state.genError = new Error("secret internal detail");
  const origErr = console.error; console.error = () => {};
  const boom = mockRes();
  await controller.askAboutGroup({ params: { id: "g" }, body: { question: "שאלה תקינה?" } }, boom);
  console.error = origErr;
  assert.strictEqual(boom.statusCode, 500);
  assert.ok(!JSON.stringify(boom.body).includes("secret"));
  state.genError = null;
});

test("הסבר תפילה: ולידציה, וקריאה שנייה על אותו קטע מוחזרת מה-cache בלי AI", async () => {
  const bad = mockRes();
  await controller.explainPrayer({ body: { text: "" } }, bad);
  assert.strictEqual(bad.statusCode, 400);

  calls.generate.length = 0;
  state.genError = null;
  state.genResult = "הסבר בדיקה";
  const first = mockRes();
  await controller.explainPrayer({ body: { title: "ברכות השחר", text: "בָּרוּךְ אַתָּה יְיָ" } }, first);
  assert.strictEqual(first.body.cached, false);
  assert.strictEqual(first.body.answer, "הסבר בדיקה");

  const second = mockRes();
  await controller.explainPrayer({ body: { title: "ברכות השחר", text: "בָּרוּךְ אַתָּה יְיָ" } }, second);
  assert.strictEqual(second.body.cached, true);
  assert.strictEqual(calls.generate.length, 1);
});

test("סיכום לימוד: בלי רישומים בתקופה - הודעה ידידותית ובלי קריאה ל-AI", async () => {
  learningState.logs = [];
  calls.generate.length = 0;
  const res = mockRes();
  await controller.summarizeLearning({ body: { period: "week" }, session: { userId: "u1", userName: "דני" } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.answer.includes("לא נרשמו"));
  assert.strictEqual(calls.generate.length, 0);
});

test("סיכום לימוד: עם רישומים - שולח ל-AI את העובדות המחושבות ולא נתונים של משתמש אחר", async () => {
  const today = new Date();
  learningState.logs = [{ date: today, unit: "ברכות ב", groupName: "גמרא", notes: "" }];
  learningState.goals = [{ text: "לסיים פרק", done: false }];
  calls.generate.length = 0;
  state.genError = null; state.genResult = "סיכום לימוד";
  const res = mockRes();
  await controller.summarizeLearning({ body: { period: "bogus" }, session: { userId: "u1", userName: "דני" } }, res);
  assert.strictEqual(res.body.answer, "סיכום לימוד");
  assert.strictEqual(calls.generate.length, 1);
  assert.ok(calls.generate[0].prompt.includes("ברכות ב") && calls.generate[0].prompt.includes("רצף ימים נוכחי: 1"));
});

test("חג: מצב לא תקין -> 400, חג לא קיים -> 404, מצב קבוע נשמר במטמון, שאלה לא", async () => {
  const bad = mockRes();
  await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "weird" } }, bad);
  assert.strictEqual(bad.statusCode, 400);
  const noQ = mockRes();
  await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "question", question: "א" } }, noQ);
  assert.strictEqual(noQ.statusCode, 400);

  state.genError = null; state.genResult = "הסבר חג";
  calls.generate.length = 0;
  const a = mockRes(); await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "kids" } }, a);
  const b = mockRes(); await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "kids" } }, b);
  assert.strictEqual(a.body.cached, false);
  assert.strictEqual(b.body.cached, true);
  assert.strictEqual(calls.generate.length, 1);
  const q1 = mockRes(); await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "question", question: "מה עושים?" } }, q1);
  const q2 = mockRes(); await controller.askAboutHoliday({ params: { id: "h1" }, body: { mode: "question", question: "מה עושים?" } }, q2);
  assert.strictEqual(calls.generate.length, 3);

  holidayState.holiday = null;
  const gone = mockRes(); await controller.askAboutHoliday({ params: { id: "zzz" }, body: { mode: "explain" } }, gone);
  assert.strictEqual(gone.statusCode, 404);
  holidayState.holiday = { id: "h1", holidayName: "פורים" };
});

test("עזרה בכתיבה: מצב לא תקין/טיוטה קצרה -> 400, תקין -> 200", async () => {
  const bad = mockRes(); await controller.composeHelp({ body: { mode: "x", content: "טיוטה ארוכה מספיק" } }, bad);
  assert.strictEqual(bad.statusCode, 400);
  const short = mockRes(); await controller.composeHelp({ body: { mode: "improve", content: "קצר" } }, short);
  assert.strictEqual(short.statusCode, 400);
  state.genResult = "נוסח משופר";
  const ok = mockRes(); await controller.composeHelp({ body: { mode: "improve", title: "כ", content: "טיוטה ארוכה מספיק" } }, ok);
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.body.answer, "נוסח משופר");
});

test("חיפוש חכם: בלי פוסטים רלוונטיים לא פונה ל-AI; עם פוסטים מחזיר תשובה ומקורות", async () => {
  state.sitePosts = [{ id: "p9", title: "הלכות שבת", content: "נרות", groupId: "g9", groupName: "קבוצה" }];
  calls.generate.length = 0;
  const none = mockRes(); await controller.askSite({ body: { question: "מה על כדורגל?" } }, none);
  assert.strictEqual(none.statusCode, 200);
  assert.deepStrictEqual(none.body.sources, []);
  assert.strictEqual(calls.generate.length, 0);

  state.genResult = "תשובה על שבת";
  const ok = mockRes(); await controller.askSite({ body: { question: "מה כתוב על שבת?" } }, ok);
  assert.strictEqual(ok.body.answer, "תשובה על שבת");
  assert.deepStrictEqual(ok.body.sources, [{ n: 1, id: "p9", title: "הלכות שבת", groupId: "g9", groupName: "קבוצה" }]);
  const bad = mockRes(); await controller.askSite({ body: { question: "?" } }, bad);
  assert.strictEqual(bad.statusCode, 400);
});
