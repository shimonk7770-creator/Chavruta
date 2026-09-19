// server/public/js/themeToggle.js
// מטפל בלחיצה על כפתור החלפת מצב כהה/בהיר בתפריט העליון, ושומר את הבחירה ב-localStorage
// כדי שהיא תישמר גם בכניסה הבאה לאתר (localStorage שייך לדפדפן של המשתמש הספציפי, לא לשרת).
// שימו לב: קביעת המצב ה*ראשונית* של העמוד (לפני שהוא בכלל מצטייר) מתבצעת בסקריפט קטן נפרד
// ב-partials/head.ejs - כדי למנוע "הבהוב" של הצבעים הלא נכונים ברענון עמוד (Flash of Unstyled Theme).

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;

  function updateIcon() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = isDark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", isDark ? "עבור למצב בהיר" : "עבור למצב כהה");
  }

  btn.addEventListener("click", function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("chavruta-theme", next);
    } catch (e) {
      // localStorage עלול להיות חסום (למשל גלישה פרטית) - לא קריטי, רק אומר שהבחירה לא תישמר לפעם הבאה
    }
    updateIcon();
  });

  updateIcon();
});
