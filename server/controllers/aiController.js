// server/controllers/aiController.js
// נקודות הקצה של פיצ'ר ה-AI (דרישת המרצה #2) - כולן מחזירות JSON ונקראות ב-Ajax מ-public/js/ai.js:
//   POST /api/ai/posts/:id/summary  - סיכום פוסט/שיעור (נשמר ב-DB כדי לא לבקש שוב)
//   POST /api/ai/posts/:id/ask      - שאלה על פוסט מסוים (כולל התגובות האחרונות)
//   POST /api/ai/groups/:id/ask     - שאלה על הקבוצה כולה (לפי הפוסטים האחרונים שלה)
// ההרשאה (התחברות) וההגבלת קצב נקבעות ב-routes/aiRoutes.js. מפתח ה-API נשאר בשרת (services/aiService.js).

const Post = require("../models/Post");
const Group = require("../models/Group");
const Comment = require("../models/Comment");
const ai = require("../services/aiService");
const prompts = require("../utils/aiPrompts");

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

module.exports = { summarizePost, askAboutPost, askAboutGroup, DISCLAIMER };
