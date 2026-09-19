// server/public/js/register.js
// שימוש ב-jQuery/Ajax (דרישה 25) - בדיקת זמינות שם משתמש בזמן אמת מול השרת, בלי לרענן את הדף

$(function () {
  const $usernameInput = $("#username");
  const $status = $("#username-status");
  let debounceTimer = null;

  // בדיקת התאמה בין "סיסמה" ל"הזן שוב את הסיסמה" בזמן אמת (בנוסף לבדיקה בצד השרת ב-authController.js -
  // ולידציה בצד לקוח היא נוחות למשתמש בלבד, אף פעם לא תחליף לבדיקה אמיתית בשרת)
  const $password = $("#password");
  const $confirmPassword = $("#confirmPassword");
  const $confirmStatus = $("#confirm-password-status");

  function checkPasswordsMatch() {
    if (!$confirmPassword.val()) {
      $confirmStatus.text("").removeClass("available taken");
      return;
    }
    if ($password.val() === $confirmPassword.val()) {
      $confirmStatus.text("הסיסמאות תואמות ✓").removeClass("taken").addClass("available");
    } else {
      $confirmStatus.text("הסיסמאות אינן תואמות ✗").removeClass("available").addClass("taken");
    }
  }

  $password.on("input", checkPasswordsMatch);
  $confirmPassword.on("input", checkPasswordsMatch);

  // מניעת שליחת הטופס אם הסיסמאות לא תואמות - הודעת השרת עדיין קיימת כגיבוי (defense in depth)
  $(".auth-form").on("submit", function (e) {
    if ($password.val() !== $confirmPassword.val()) {
      e.preventDefault();
      checkPasswordsMatch();
      $confirmPassword.trigger("focus");
    }
  });

  $usernameInput.on("input", function () {
    const username = $(this).val().trim();
    clearTimeout(debounceTimer);

    if (username.length < 3) {
      $status.text("").removeClass("available taken");
      return;
    }

    // ממתינים 400ms אחרי שהמשתמש הפסיק להקליד, כדי לא להציף את השרת בבקשות
    debounceTimer = setTimeout(function () {
      $.ajax({
        url: "/api/check-username",
        method: "GET",
        data: { username: username },
        success: function (response) {
          if (response.available) {
            $status.text("שם המשתמש פנוי ✓").removeClass("taken").addClass("available");
          } else {
            $status.text("שם המשתמש תפוס ✗").removeClass("available").addClass("taken");
          }
        },
        error: function () {
          $status.text("").removeClass("available taken");
        },
      });
    }, 400);
  });
});
