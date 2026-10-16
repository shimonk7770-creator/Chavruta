// server/public/js/report.js
// כפתור "🚩 דווח" על פוסט/תגובה: פותח חלון קטן לבחירת סיבה ושולח POST /api/reports (jQuery/Ajax, בלי רענון עמוד).
// הכפתורים מוגדרים ב-groups/show.ejs (פוסטים) וב-comments.js (תגובות) עם data-type ו-data-id.
// ההרשאות והבדיקות (אי אפשר לדווח על עצמך, דיווח כפול) נאכפות בשרת - כאן רק ממשק.

$(function () {
  const REASONS = [
    ["spam", "ספאם או פרסומת"],
    ["offensive", "תוכן פוגעני או לא ראוי"],
    ["offtopic", "לא מתאים לנושא המדור"],
    ["other", "אחר"],
  ];

  $(document).on("click", ".report-btn", function () {
    const type = $(this).data("type");
    const id = String($(this).data("id"));
    openDialog(type, id);
  });

  function openDialog(type, id) {
    $(".report-overlay").remove();
    const options = REASONS.map(function (r, i) {
      return `<label class="report-option"><input type="radio" name="reason" value="${r[0]}" ${i === 0 ? "checked" : ""} /> ${r[1]}</label>`;
    }).join("");
    const $overlay = $(
      `<div class="report-overlay" role="dialog" aria-modal="true" aria-label="דיווח על תוכן">
        <form class="report-dialog">
          <h3>🚩 דיווח על ${type === "post" ? "פוסט" : "תגובה"}</h3>
          ${options}
          <input type="text" name="details" maxlength="300" placeholder="הערה למנהל (אופציונלי)" />
          <p class="report-feedback meta" role="status"></p>
          <div class="report-actions">
            <button type="submit">שלח דיווח</button>
            <button type="button" class="report-cancel">ביטול</button>
          </div>
        </form>
      </div>`
    );
    $("body").append($overlay);

    $overlay.on("click", ".report-cancel", function () {
      $overlay.remove();
    });
    $overlay.on("click", function (e) {
      if (e.target === $overlay[0]) $overlay.remove();
    });
    $overlay.find("form").on("submit", function (e) {
      e.preventDefault();
      const $form = $(this);
      const $feedback = $form.find(".report-feedback");
      $.ajax({
        url: "/api/reports",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          targetType: type,
          targetId: id,
          reason: $form.find('input[name="reason"]:checked').val(),
          details: $form.find('input[name="details"]').val(),
        }),
        success: function (res) {
          $feedback.text(res.message || "הדיווח נשלח");
          setTimeout(function () {
            $overlay.remove();
          }, 1200);
        },
        error: function (xhr) {
          $feedback.text((xhr.responseJSON && xhr.responseJSON.message) || "שליחת הדיווח נכשלה");
        },
      });
    });
  }
});
