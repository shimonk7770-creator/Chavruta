// server/utils/postRetrieval.js
// "שליפה" (retrieval) פשוטה לפני שאלה ל-AI: מתוך הרבה פוסטים בוחרים רק את הרלוונטיים לשאלה לפי חפיפת מילים,
// ושולחים ל-AI רק אותם. כך לא שולחים את כל האתר ל-Gemini (יקר, איטי, ומוגבל באורך), והתשובה מבוססת על פוסטים אמיתיים.
// לוגיקה טהורה ללא מסד נתונים - נבדקת אוטומטית (postRetrieval.test.js).

// מילים שלא מוסיפות משמעות לחיפוש
const STOP_WORDS = new Set(["מה", "מי", "איפה", "מתי", "למה", "איך", "האם", "על", "של", "את", "עם", "אם", "או", "גם", "זה", "זו", "הוא", "היא", "יש", "אין", "לא", "כל", "אל", "מן", "כי", "אני", "אנחנו", "דיברו", "למדנו", "נכתב"]);
const PREFIXES = "והבכלמש"; // אותיות שימוש מקובלות בתחילת מילה בעברית (ו, ה, ב, כ, ל, מ, ש)
const NIKUD_RE = /[֑-ׇ]/g;

function normalize(text) {
  return String(text || "").replace(NIKUD_RE, "").toLowerCase();
}

// מפרק שאלה למילות חיפוש: בלי סימני פיסוק, בלי מילות עצירה, ועם גם הצורה ללא אות שימוש בתחילת המילה (השבת -> שבת)
function extractTerms(question) {
  const words = normalize(question).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const terms = new Set();
  words.forEach((w) => {
    terms.add(w);
    if (w.length >= 4 && PREFIXES.includes(w[0])) terms.add(w.slice(1));
  });
  return [...terms];
}

// ניקוד פוסט: כל מילה שנמצאה בכותרת שווה 3, בתוכן שווה 1
function scorePost(post, terms) {
  const title = normalize(post.title);
  const content = normalize(post.content);
  let score = 0;
  terms.forEach((t) => {
    if (title.includes(t)) score += 3;
    if (content.includes(t)) score += 1;
  });
  return score;
}

// מחזיר עד `limit` פוסטים הרלוונטיים ביותר (ניקוד > 0), מהרלוונטי לפחות רלוונטי
function pickRelevantPosts(posts, question, limit = 6) {
  const terms = extractTerms(question);
  if (!terms.length) return [];
  return (posts || [])
    .map((post) => ({ post, score: scorePost(post, terms) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post);
}

module.exports = { extractTerms, scorePost, pickRelevantPosts };
