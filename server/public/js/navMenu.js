// server/public/js/navMenu.js
// סוגר את התפריט הנפתח "תפילה" (<details class="nav-menu"> בסרגל הניווט) בלחיצה מחוץ לו או על Escape.
// הפתיחה עצמה נעשית ע"י הדפדפן (details/summary) בלי JavaScript.
(function () {
  document.addEventListener("click", function (e) {
    document.querySelectorAll("details.nav-menu[open]").forEach(function (menu) {
      if (!menu.contains(e.target)) menu.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll("details.nav-menu[open]").forEach(function (menu) { menu.removeAttribute("open"); });
    }
  });
})();
