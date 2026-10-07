// server/utils/learningStats.js
// חישוב נתוני לימוד לתקופה (שבוע/חודש) מתוך רישומי הלימוד של המשתמש - לוגיקה טהורה, נבדקת אוטומטית.
// הנתונים המחושבים כאן (כמות, ימים, רצף) נשלחים ל-AI כ"עובדות", כך שהוא רק מנסח ומעודד - ולא מחשב בעצמו (AI נוטה לטעות בחשבון).

const PERIODS = { week: { days: 7, label: "השבוע האחרון" }, month: { days: 30, label: "החודש האחרון" } };

function toDate(v) {
  return v && v.toDate ? v.toDate() : new Date(v);
}
// מפתח יום בפורמט YYYY-MM-DD לפי התאריך המקומי (לא UTC) - כדי שרישום של "היום" לא יזוז ליום אחר
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidPeriod(period) {
  return Object.prototype.hasOwnProperty.call(PERIODS, period);
}

// מחשב סטטיסטיקה לתקופה: logs = רישומי המשתמש, goals = היעדים שלו, now = "עכשיו" (פרמטר לצורך בדיקות)
function computeLearningStats(logs, goals, period, now = new Date()) {
  const cfg = PERIODS[period] || PERIODS.week;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (cfg.days - 1)); // כולל היום הנוכחי: שבוע = 7 ימים כולל היום

  const inPeriod = (logs || [])
    .map((l) => ({ ...l, _date: toDate(l.date) }))
    .filter((l) => !isNaN(l._date) && l._date >= start && l._date <= new Date(now.getTime() + 24 * 3600 * 1000))
    .sort((a, b) => a._date - b._date);

  const daysSet = new Set(inPeriod.map((l) => dayKey(l._date)));

  // רצף ימים רצופים שמסתיים היום או אתמול (גם מי שעוד לא למד היום לא "מאבד" את הרצף)
  const allDays = new Set((logs || []).map((l) => dayKey(toDate(l.date))));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!allDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (allDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const goalList = goals || [];
  return {
    periodLabel: cfg.label,
    totalDays: cfg.days,
    entries: inPeriod.map((l) => ({ date: dayKey(l._date), unit: l.unit, groupName: l.groupName || "", notes: l.notes || "" })),
    entryCount: inPeriod.length,
    activeDays: daysSet.size,
    streak,
    goalsDone: goalList.filter((g) => g.done).length,
    goalsTotal: goalList.length,
    openGoals: goalList.filter((g) => !g.done).map((g) => g.text),
  };
}

module.exports = { PERIODS, isValidPeriod, computeLearningStats, dayKey };
