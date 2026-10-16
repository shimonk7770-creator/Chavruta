// server/controllers/transcribeController.js
// POST /api/ai/transcribe  (גוף: multipart, שדה "audio") - תמלול הקלטת קול לטקסט עם Gemini, להכנסה לשדה הודעה/פוסט/תגובה.
// משמש גם את האתר (session) וגם את המובייל (/api/mobile/ai/transcribe, טוקן). ההקלטה נשמרת בזיכרון בלבד ולא נשמרת בדיסק או ב-DB.
// ההגנה (התחברות + הגבלת קצב) נקבעת ב-routes; ה-AI עצמו ב-services/aiService.js (עם גיבוי מודלים).

const ai = require("../services/aiService");
const T = require("../utils/transcription");

async function transcribe(req, res) {
  const check = T.validateAudioFile(req.file);
  if (!check.ok) return res.status(400).json({ success: false, message: check.message });
  try {
    const raw = await ai.generate(T.buildTranscribeRequest(check));
    const text = T.cleanTranscript(raw);
    if (!text) return res.status(422).json({ success: false, message: "לא זוהה דיבור ברור בהקלטה. נסו שוב, קרוב יותר למיקרופון." });
    return res.json({ success: true, text });
  } catch (error) {
    if (error instanceof ai.AiError) {
      return res.status(error.httpStatus).json({ success: false, code: error.code, message: error.message });
    }
    console.error("שגיאה בתמלול:", error.message);
    return res.status(500).json({ success: false, message: "אירעה שגיאה בתמלול. נסו שוב." });
  }
}

// עוטף את multer כך ששגיאת העלאה (קובץ גדול מדי וכו') תחזור כ-JSON ולא כדף שגיאה
function receiveAudio(uploadAudio) {
  const single = uploadAudio.single("audio");
  return (req, res, next) => {
    single(req, res, (err) => {
      if (!err) return next();
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      res.status(400).json({ success: false, message: tooBig ? "ההקלטה גדולה מדי (עד כדקה)" : "העלאת ההקלטה נכשלה" });
    });
  };
}

module.exports = { transcribe, receiveAudio };
