// server/public/js/fontSize.js
// מטפל בלחיצה על כפתורי "גודל טקסט" בעמוד הפרופיל, ושומר את הבחירה ב-localStorage - אותו דפוס
// בדיוק כמו themeToggle.js. קביעת הגודל ה*ראשונית* של העמוד (לפני שהוא מצטייר) מתבצעת בסקריפט קטן
// נפרד ב-partials/head.ejs, כדי למנוע הבהוב של גודל טקסט שגוי ברענון עמוד.
// רעיון הועבר מפרויקט React נפרד ("חת"ת יומי") שהמשתמש בנה בעבר, ומותאם כאן לאתר שרת-מרונדר (EJS)
// שאין בו state כמו ב-React - לכן העדכון נעשה ישירות על ה-DOM ולא דרך useState.

document.addEventListener("DOMContentLoaded", function () {
  var row = document.getElementById("font-size-row");
  if (!row) return;

  var buttons = row.querySelectorAll(".option-pill[data-font-size]");

  function currentSize() {
    return document.documentElement.getAttribute("data-font-size") || "normal";
  }

  function updateActiveButton() {
    var size = currentSize();
    buttons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-font-size") === size);
    });
  }

  function applySize(size) {
    if (size === "large" || size === "xlarge") {
      document.documentElement.setAttribute("data-font-size", size);
    } else {
      document.documentElement.removeAttribute("data-font-size"); // "normal" - חוזרים לברירת המחדל
    }
    try {
      localStorage.setItem("chavruta-font-size", size);
    } catch (e) {
      // localStorage חסום - הבחירה עדיין תיושם בעמוד הנוכחי, רק לא תישמר לפעם הבאה
    }
    updateActiveButton();
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applySize(btn.getAttribute("data-font-size"));
    });
  });

  updateActiveButton();
});
