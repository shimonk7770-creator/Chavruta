// server/utils/goalProgress.js
// לוגיקה טהורה (ללא DB) לחישוב התקדמות ברשימת יעדי הלימוד - כדי שתהיה ניתנת לבדיקה אוטומטית
// בדומה לדפוס שכבר קיים בפרויקט (ראו server/utils/upcomingHoliday.js, permissionRules.js)
// תוספת לפי משוב המשתמש (אוקטובר 2026) - "צ'קליסט" ביעדי הלימוד

// מקבל מערך יעדים ({ done: boolean, ... }) ומחזיר כמה בוצעו, כמה בסה"כ, ואחוז התקדמות מעוגל
function computeGoalProgress(goals) {
  const list = goals || [];
  const total = list.length;
  const done = list.filter((g) => g.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

module.exports = { computeGoalProgress };
