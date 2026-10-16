// server/utils/chabadSections.js
// "בית חב״ד" - מדורים קבועים שמרכזים את כל הקבוצות במקום אחד (משוב המרצה: הקבוצות היו מפוזרות מדי).
// כל מדור הוא קבוצה רגילה ב-Firestore (collection "groups") עם שדה sectionKey, ולכן כל מה שכבר קיים
// (פוסטים, תגובות, חברים, צ'אט, הרשאות) ממשיך לעבוד בלי שינוי.
//
// topicHint = תיאור הנושא שנשלח ל-Gemini בבדיקת הרלוונטיות (ראו utils/relevanceCheck.js):
// הוא קובע מה מתאים לפרסום במדור ומה לא.

const SECTIONS = [
  {
    key: "tanya",
    name: "שיעור תניא",
    emoji: "📖",
    description: "שיעור תניא יומי: שאלות, חידושים ועדכוני שיעור",
    topic: "תניא",
    category: "shiur",
    topicHint: "שיעור תניא וחסידות חב״ד: לימוד ספר התניא, שאלות והבהרות בתניא, חידושים, זמני השיעור ועדכונים עליו",
  },
  {
    key: "minyan",
    name: "מניין",
    emoji: "🕍",
    description: "מניינים לתפילה בבית חב״ד: מי מגיע, מי חסר למניין ושינויי זמנים",
    topic: "תפילה ומניין",
    category: "community",
    topicHint: "תפילה במניין: זמני תפילות שחרית מנחה וערבית, חסר עשירי למניין, שינוי שעה או מקום, תיאום הגעה לתפילה",
  },
  {
    key: "torah",
    name: "שיעורי תורה",
    emoji: "📚",
    description: "שיעורים בתורה לגברים: גמרא, הלכה, פרשת שבוע ועוד",
    topic: "שיעורי תורה",
    category: "shiur",
    topicHint: "שיעורי תורה: גמרא, הלכה, פרשת השבוע, מוסר וחסידות, דברי תורה, שאלות בלימוד והודעות על שיעורים",
  },
  {
    key: "women",
    name: "שיעורים לנשים",
    emoji: "🌸",
    description: "שיעורים ופעילות לנשים: פרשת שבוע, הלכה, השקפה וחגים",
    topic: "שיעורים לנשים",
    category: "shiur",
    topicHint: "שיעורי תורה ופעילות לנשים: פרשת שבוע, הלכות לנשים, השקפה, חגים, הודעות על שיעורים ואירועים לנשים",
  },
  {
    key: "lostfound",
    name: "אבדות ומציאות",
    emoji: "🔎",
    description: "מצאתם משהו? איבדתם משהו? כאן מחזירים אבדה לבעליה",
    topic: "אבדות ומציאות",
    category: "community",
    topicHint: "אבדות ומציאות: חפץ שאבד או נמצא, תיאור החפץ ומקום האיבוד או המציאה, בקשה או הודעה להחזרת אבדה",
  },
  {
    key: "kodesh",
    name: "מסירת מוצרי קדושה",
    emoji: "📜",
    description: "מסירת ספרים, סידורים, תפילין, מזוזות, שמות ושאר תשמישי קדושה",
    topic: "מוצרי קדושה",
    category: "community",
    topicHint:
      "מסירה או בקשה של מוצרי קדושה בלבד: ספרי קודש, סידורים, תפילין, מזוזות, טליתות, נרות שבת, ארבעת המינים ושאר תשמישי קדושה. בגדים רגילים, צעצועים ורהיטים אינם מוצרי קדושה",
  },
];

const SECTION_KEYS = SECTIONS.map((s) => s.key);

// מזהה מסמך קבוע לכל מדור (section_tanya...) - כך יצירה חוזרת לא יוצרת כפילויות גם בהרצות מקבילות
function sectionDocId(key) {
  return `section_${key}`;
}

function getSection(key) {
  return SECTIONS.find((s) => s.key === key) || null;
}

// האם הקבוצה היא מדור של בית חב״ד
function isSectionGroup(group) {
  return Boolean(group && group.sectionKey && getSection(group.sectionKey));
}

// כלל "חברות במדור אחד בלבד מכל סוג" (בקשת המרצה): מקבל את הקבוצות שהמשתמש חבר בהן ואת הקבוצה שאליה הוא רוצה להצטרף,
// ומחזיר את הקבוצה הקיימת שמתנגשת (אותו sectionKey, קבוצה אחרת) או null אם מותר להצטרף.
function findSectionConflict(memberGroups, targetGroup) {
  if (!targetGroup || !targetGroup.sectionKey) return null; // קבוצה רגילה - אין הגבלה
  const conflict = (memberGroups || []).find((g) => g.sectionKey === targetGroup.sectionKey && g.id !== targetGroup.id);
  return conflict || null;
}

module.exports = { SECTIONS, SECTION_KEYS, sectionDocId, getSection, isSectionGroup, findSectionConflict };
