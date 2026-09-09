// server/public/js/register.js
// שימוש ב-jQuery/Ajax (דרישה 25) - בדיקת זמינות שם משתמש בזמן אמת מול השרת, בלי לרענן את הדף

$(function () {
  const $usernameInput = $("#username");
  const $status = $("#username-status");
  let debounceTimer = null;

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
