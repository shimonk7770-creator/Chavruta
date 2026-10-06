// server/controllers/prayerController.js
// קטגוריית "נוסח תפילה" (/prayers) - ציבורית (גם לאורחים). בחירת נוסח (אשכנז/ספרד/עדות המזרח) ותפילה
// (שחרית/מנחה/ערבית), והצגת הטקסט שנשלף מ-Sefaria (server/utils/sefariaPrayers.js).
//
// הטקסט נטען בשני שלבים: עמוד ה-HTML נטען מיד (עם "טוען..."), ובדפדפן jQuery/Ajax מבקש את הטקסט עצמו מ-
// GET /prayers/data/:nusach/:prayer (JSON). כך שהטעינה הראשונה האיטית (עשרות בקשות ל-Sefaria) לא תוקעת את הדף,
// וה-JSON הזה גם ישמש בהמשך את אפליקציית המובייל.

const { NUSACHIM, PRAYERS, isValidNusach, isValidPrayer, getPrayer } = require("../utils/sefariaPrayers");

const DEFAULT_NUSACH = "ashkenaz";

// GET /prayers[?nusach=sefard] - מסך הבחירה. הנוסח האחרון שנבחר נשמר ב-session כדי שלא יצטרכו לבחור שוב
function chooseForm(req, res) {
  let nusach = req.query.nusach;
  if (isValidNusach(nusach)) {
    req.session.prayerNusach = nusach;
  } else {
    nusach = isValidNusach(req.session && req.session.prayerNusach) ? req.session.prayerNusach : DEFAULT_NUSACH;
  }
  res.render("prayers/index", { nusachim: NUSACHIM, prayers: PRAYERS, selectedNusach: nusach });
}

// GET /prayers/:nusach/:prayer - עמוד התפילה (ה-HTML בלבד; הטקסט נטען ב-Ajax)
function showPrayer(req, res, next) {
  const { nusach, prayer } = req.params;
  if (!isValidNusach(nusach) || !isValidPrayer(prayer)) {
    res.status(404);
    return next(new Error("הנוסח או התפילה המבוקשים לא נמצאו"));
  }
  req.session.prayerNusach = nusach;
  res.render("prayers/show", {
    nusachKey: nusach,
    prayerKey: prayer,
    nusachLabel: NUSACHIM[nusach].label,
    prayerLabel: PRAYERS[prayer].label,
    nusachim: NUSACHIM,
  });
}

// GET /prayers/data/:nusach/:prayer - JSON עם הטקסט. שגיאה בשליפה (אין אינטרנט, Sefaria למטה) -> 502 עם הודעה בעברית
async function prayerData(req, res) {
  const { nusach, prayer } = req.params;
  if (!isValidNusach(nusach) || !isValidPrayer(prayer)) {
    return res.status(404).json({ success: false, message: "הנוסח או התפילה המבוקשים לא נמצאו" });
  }
  try {
    const result = await getPrayer(nusach, prayer);
    if (result.unavailable) return res.json({ success: true, unavailable: true, reason: result.reason });
    return res.json({ success: true, prayer: result });
  } catch (err) {
    console.error("prayerController: שגיאה בשליפת נוסח מ-Sefaria:", err.message);
    return res.status(502).json({
      success: false,
      message: "לא הצלחנו לטעון את הנוסח מ-Sefaria כרגע (בדוק חיבור לאינטרנט ונסה שוב בעוד רגע).",
    });
  }
}

module.exports = { chooseForm, showPrayer, prayerData };
