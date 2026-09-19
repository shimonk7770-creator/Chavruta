// server/public/js/passwordToggle.js
// כפתור "עין" להצגה/הסתרה של תוכן שדה סיסמה - שיפור נגישות/שימושיות בטפסי הרשמה והתחברות.
// נכתב ב-JavaScript רגיל (בלי jQuery) כדי שיעבוד גם בעמוד ההתחברות שלא טוען את register.js.

document.addEventListener("DOMContentLoaded", function () {
  var toggleButtons = document.querySelectorAll(".toggle-password-btn");

  toggleButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var wrapper = button.closest(".password-wrapper");
      var input = wrapper ? wrapper.querySelector("input") : null;
      if (!input) return;

      var isCurrentlyHidden = input.type === "password";
      input.type = isCurrentlyHidden ? "text" : "password";

      // מחליפים גם את האייקון וגם את תיאור הנגישות (aria-label) בהתאם למצב החדש
      button.textContent = isCurrentlyHidden ? "🙈" : "👁️";
      button.setAttribute("aria-label", isCurrentlyHidden ? "הסתר סיסמה" : "הצג סיסמה");
    });
  });
});
