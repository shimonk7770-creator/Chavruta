// server/public/js/attendance.js
// כפתור "🙋 אני מגיע" ליד כל מניין (עמוד /minyanim ועמוד /zmanim): שולח POST /api/minyanim/:id/attend (jQuery/Ajax)
// ומעדכן את המונה, סרגל ההתקדמות וההודעה "יש מניין!" בלי רענון עמוד. הספירה והתאריך מחושבים בשרת.
// הגבלת "הצבעה אחת לכל משתמש" נאכפת בשרת (המשתמש נשמר במערך הנוכחים), והמונה מתאפס אוטומטית אחרי התפילה.

$(function () {
  $(document).on("click", ".attend-btn", function () {
    const $btn = $(this);
    if ($btn.data("busy")) return;
    const $box = $btn.closest(".attend-box");
    const id = $box.data("minyan-id");
    $btn.data("busy", true).prop("disabled", true);

    $.ajax({
      url: "/api/minyanim/" + encodeURIComponent(id) + "/attend",
      method: "POST",
      success: function (res) {
        render($box, res.attendance);
      },
      error: function (xhr) {
        alert((xhr.responseJSON && xhr.responseJSON.message) || "לא הצלחנו לעדכן את ההגעה, נסו שוב");
      },
      complete: function () {
        $btn.data("busy", false).prop("disabled", false);
      },
    });
  });

  function render($box, a) {
    $box.find(".attend-num").text(a.count);
    $box.find(".attend-target").text(a.target);
    $box.find(".attend-status").text(a.hasMinyan ? "✅ יש מניין!" : "חסרים " + a.missing);
    $box.find(".attend-bar span").css("width", a.percent + "%");
    $box.toggleClass("has-minyan", a.hasMinyan);
    $box.find(".attend-btn").toggleClass("going", a.going).text(a.going ? "✔ אני מגיע (ביטול)" : "🙋 אני מגיע");
  }
});
