// server/controllers/aiController.js
// נקודות הקצה של פיצ'ר ה-AI (דרישת המרצה #2) - כולן מחזירות JSON ונקראות ב-Ajax מ-public/js/ai.js:
//   POST /api/ai/posts/:id/summary  - סיכום פוסט/שיעור (נשמר ב-DB כדי לא לבקש שוב)
//   POST /api/ai/posts/:id/ask      - שאלה על פוסט מסוים (כולל התגובות האחרונות)
//   POST /api/ai/groups/:id/ask     - שאלה על הקבוצה כולה (לפי הפוסטים האחרונים שלה)
// ההרשאה (התחברות) וההגבלת קצב נקבעות ב-routes/aiRoutes.js. מפתח ה-API נשאר בשרת (services/aiService.js).

const Post = require("../models/Post");
const Group = require("../models/Group");
const Holiday = require("../models/Holiday");
const Comment = require("../models/Comment");
const ai = require("../services/aiService");
const prompts = require("../utils/aiPrompts");
const LearningLog = require("../models/LearningLog");
const LearningGoal = require("../models/LearningGoal");
const learningStats = require("../utils/learningStats");
const { pickRelevantPosts } = require("../utils/postRetrieval");

// הערה שמוצגת ליד כל תשובת AI - שקיפות למשתמש (ה-AI עלול לטעות)
const DISCLAIMER = "תשובה שנוצרה על ידי AI - ייתכנו טעויות. בשאלות של הלכה למעשה יש לשאול רב.";

// מחזיר תשובת שגיאה אחידה בפורמט JSON, ומתרגם שגיאות AI מבוקרות ל-status המתאים
function sendError(res, error) {
  if (error instanceof ai.AiError) {
    return res.status(error.httpStatus).json({ success: false, code: error.code, message: error.message });
  }
  console.error("שגיאה לא צפויה בפיצ'ר ה-AI:", error.message); // מדפיסים רק message, לא את האובייקט המלא
  return res.status(500).json({ success: false, message: "אירעה שגיאה בלתי צפויה. נסו שוב." });
}

// זיכרון מטמון קטן להסברי תפילה: אותו קטע מבוקש שוב ושוב (כל מי שפותח את אותה תפילה), ואין סיבה לחזור ל-Gemini.
// Map שומר סדר הכנסה - כשהוא מתמלא מוחקים את הערך הוותיק ביותר. נמחק כשהשרת מופעל מחדש (זה בסדר, זה רק חיסכון).
const explainCache = new Map();
const EXPLAIN_CACHE_MAX = 300;

// POST /api/ai/prayers/explain   גוף הבקשה: { title, text }
async function explainPrayer(req, res) {
  try {
    const check = prompts.validateSnippet(req.body && req.body.text);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    const title = String((req.body && req.body.title) || "").slice(0, 120);

    const key = prompts.contentHash({ title, content: check.text });
    if (explainCache.has(key)) {
      return res.json({ success: true, answer: explainCache.get(key), cached: true, disclaimer: DISCLAIMER });
    }
    const answer = await ai.generate(prompts.buildPrayerExplainRequest(title, check.text));
    explainCache.set(key, answer);
    if (explainCache.size > EXPLAIN_CACHE_MAX) explainCache.delete(explainCache.keys().next().value);
    return res.json({ success: true, answer, cached: false, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/learning/summary   גוף הבקשה: { period: "week" | "month" }
// הנתונים נשלפים בשרת לפי המשתמש המחובר (session) - הלקוח לא שולח רישומים, כך שאי אפשר לבקש סיכום של מישהו אחר.
async function summarizeLearning(req, res) {
  try {
    const period = learningStats.isValidPeriod(req.body && req.body.period) ? req.body.period : "week";
    const userId = req.session.userId;
    const [logs, goals] = await Promise.all([LearningLog.listByUser(userId), LearningGoal.listByUser(userId)]);
    const stats = learningStats.computeLearningStats(logs, goals, period);

    // אין רישומים בתקופה - לא מבזבזים בקשת AI, מחזירים הודעה ידידותית
    if (stats.entryCount === 0) {
      return res.json({
        success: true,
        answer: `לא נרשמו יחידות לימוד ב${stats.periodLabel}. אפשר להתחיל היום: רשמו יחידת לימוד קטנה למטה, ובפעם הבאה אסכם לכם את ההתקדמות.`,
        disclaimer: "",
      });
    }
    const answer = await ai.generate(prompts.buildLearningSummaryRequest(stats, req.session.userName));
    return res.json({ success: true, answer, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/holidays/:id/ask   גוף הבקשה: { mode: "explain" | "kids" | "question", question? }
// שני המצבים הקבועים (explain/kids) נשמרים במטמון לפי תוכן המאמר - כולם מקבלים את אותו הסבר בלי לחזור ל-Gemini.
async function askAboutHoliday(req, res) {
  try {
    const mode = req.body && req.body.mode;
    if (!prompts.HOLIDAY_MODES.includes(mode)) {
      return res.status(400).json({ success: false, message: "בקשה לא תקינה" });
    }
    let question = "";
    if (mode === "question") {
      const check = prompts.validateQuestion(req.body.question);
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
      question = check.question;
    }
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: "מאמר החג לא נמצא" });

    const cacheKey = mode === "question" ? null : prompts.contentHash({ title: `holiday:${mode}:${holiday.id}`, content: JSON.stringify([holiday.holidayName, holiday.whatWeDo, holiday.whatWePray, holiday.customs, holiday.dateHint]) });
    if (cacheKey && explainCache.has(cacheKey)) {
      return res.json({ success: true, answer: explainCache.get(cacheKey), cached: true, disclaimer: DISCLAIMER });
    }
    const answer = await ai.generate(prompts.buildHolidayRequest(holiday, mode, question));
    if (cacheKey) {
      explainCache.set(cacheKey, answer);
      if (explainCache.size > EXPLAIN_CACHE_MAX) explainCache.delete(explainCache.keys().next().value);
    }
    return res.json({ success: true, answer, cached: false, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/compose   גוף הבקשה: { mode: "improve" | "title", title?, content }
// עזרה בכתיבת פוסט - לא שומר כלום ב-DB: מחזיר הצעה והמשתמש בוחר אם להשתמש בה.
async function composeHelp(req, res) {
  try {
    const mode = req.body && req.body.mode;
    if (!prompts.COMPOSE_MODES.includes(mode)) {
      return res.status(400).json({ success: false, message: "בקשה לא תקינה" });
    }
    const draft = prompts.validateDraft(req.body.content);
    if (!draft.ok) return res.status(400).json({ success: false, message: draft.message });
    const title = prompts.clip(String(req.body.title || ""), 150);
    const answer = await ai.generate(prompts.buildComposeRequest(mode, title, draft.text));
    return res.json({ success: true, answer, disclaimer: "הצעה בלבד - קראו ותקנו לפני הפרסום." });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/search   גוף הבקשה: { question }
// שואל שאלה על תוכן האתר: קודם בוחרים בשרת את הפוסטים הרלוונטיים (utils/postRetrieval.js) ורק אותם שולחים ל-AI.
async function askSite(req, res) {
  try {
    const check = prompts.validateQuestion(req.body && req.body.question);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const { posts: allPosts } = await Post.search({}, { page: 1, pageSize: 300 });
    const relevant = pickRelevantPosts(allPosts, check.question, 6);
    if (!relevant.length) {
      return res.json({ success: true, answer: "לא מצאתי באתר פוסטים שקשורים לשאלה הזו. נסו לנסח עם מילים אחרות.", sources: [], disclaimer: "" });
    }
    const answer = await ai.generate(prompts.buildSiteQuestionRequest(relevant, check.question));
    const sources = relevant.map((p, i) => ({ n: i + 1, id: p.id, title: p.title, groupId: p.groupId, groupName: p.groupName }));
    return res.json({ success: true, answer, sources, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/posts/:id/summary
async function summarizePost(req, res) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isArchived) {
      return res.status(404).json({ success: false, message: "הפוסט לא נמצא" });
    }

    // אם כבר יש סיכום שמתאים לתוכן הנוכחי - מחזירים אותו מיד, בלי לפנות ל-Google
    const hash = prompts.contentHash(post);
    if (post.aiSummary && post.aiSummaryHash === hash) {
      return res.json({ success: true, answer: post.aiSummary, cached: true, disclaimer: DISCLAIMER });
    }

    const answer = await ai.generate(prompts.buildSummaryRequest(post));
    await Post.setAiSummary(post.id, answer, hash);
    return res.json({ success: true, answer, cached: false, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/posts/:id/ask   גוף הבקשה: { question }
async function askAboutPost(req, res) {
  try {
    const check = prompts.validateQuestion(req.body && req.body.question);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const post = await Post.findById(req.params.id);
    if (!post || post.isArchived) {
      return res.status(404).json({ success: false, message: "הפוסט לא נמצא" });
    }
    const comments = await Comment.listByPost(post.id);
    const answer = await ai.generate(prompts.buildPostQuestionRequest(post, comments, check.question));
    return res.json({ success: true, answer, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

// POST /api/ai/groups/:id/ask   גוף הבקשה: { question }
async function askAboutGroup(req, res) {
  try {
    const check = prompts.validateQuestion(req.body && req.body.question);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }
    const posts = await Post.listByGroup(group.id);
    const answer = await ai.generate(prompts.buildGroupQuestionRequest(group, posts, check.question));
    return res.json({ success: true, answer, disclaimer: DISCLAIMER });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { summarizePost, askAboutPost, askAboutGroup, explainPrayer, summarizeLearning, askAboutHoliday, composeHelp, askSite, DISCLAIMER };
