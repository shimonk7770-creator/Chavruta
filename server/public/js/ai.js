// server/public/js/ai.js
// צד הלקוח של פיצ'ר ה-AI בעמוד הקבוצה (jQuery + Ajax, דרישה 25).
//  - כפתור "✨ סכם" ליד כל פוסט
//  - טופס "💬 שאל את ה-AI" ליד כל פוסט (שאלה על הפוסט)
//  - טופס "שאל את ה-AI על הקבוצה" (שאלה על הפוסטים האחרונים של הקבוצה)
// כל תשובה מוצגת עם .text() (לא .html()) כדי שתוכן שה-AI מחזיר לא יוכל להריץ קוד בדפדפן (XSS).

$(function () {
  // שולח בקשת POST ל-API ומציג את התשובה בתוך $box
  function callAi(url, payload, $box, $button) {
    $box.removeClass("is-error").addClass("is-loading").text("ה-AI חושב...").show();
    $button.prop("disabled", true);

    $.ajax({
      url: url,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload || {}),
    })
      .done(function (res) {
        $box.removeClass("is-loading");
        $box.empty();
        $("<div>").addClass("ai-answer-text").text(res.answer).appendTo($box);
        // מקורות (למשל בחיפוש חכם): רשימת קישורים לפוסטים שעליהם התבסס ה-AI - נבנית ב-.text()/.attr() בלבד
        if (res.sources && res.sources.length) {
          var $ul = $("<ul>").addClass("ai-sources");
          res.sources.forEach(function (src) {
            var $li = $("<li>").text("[" + src.n + "] ");
            $("<a>").attr("href", "/groups/" + encodeURIComponent(src.groupId)).text(src.title + (src.groupName ? " (" + src.groupName + ")" : "")).appendTo($li);
            $ul.append($li);
          });
          $box.append($ul);
        }
        $("<small>")
          .addClass("ai-disclaimer")
          .text((res.cached ? "סיכום שמור. " : "") + (res.disclaimer || ""))
          .appendTo($box);
      })
      .fail(function (xhr) {
        // הודעת השגיאה מהשרת היא כבר בעברית וידידותית; אם אין (למשל השרת כבוי) - הודעה כללית
        var msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "לא הצלחנו להתחבר לשרת. נסו שוב.";
        $box.removeClass("is-loading").addClass("is-error").text(msg);
        // משתמש שלא מחובר (401): מוסיפים קישור ישיר להתחברות
        if (xhr.status === 401) {
          $box.append(" ").append($("<a>").attr("href", "/login").text("להתחברות"));
        }
      })
      .always(function () {
        $button.prop("disabled", false);
      });
  }

  // חושפים את פונקציית הקריאה כדי שגם עמודים אחרים (נוסח תפילה, יומן לימוד, מעגל השנה...) ישתמשו באותו מנגנון בדיוק
  window.ChavrutaAI = { call: callAi };

  // סיכום פוסט
  // הסלקטור כולל [data-post-id] בכוונה: המחלקה ai-summary-btn משמשת גם לעיצוב כפתורים אחרים (שאל/הסבר/סכם שבוע...)
  // ואסור שלחיצה עליהם תפעיל את סיכום הפוסט (זה השבית את כפתור "שאל" כי הוא נחסם באמצע השליחה).
  $(document).on("click", "button.ai-summary-btn[data-post-id]", function () {
    var $btn = $(this);
    var postId = $btn.data("post-id");
    var $box = $("#ai-box-" + postId);
    callAi("/api/ai/posts/" + encodeURIComponent(postId) + "/summary", {}, $box, $btn);
  });

  // שאלה על פוסט
  $(document).on("submit", ".ai-post-form", function (e) {
    e.preventDefault();
    var $form = $(this);
    var postId = $form.data("post-id");
    var question = $.trim($form.find("input[name=question]").val());
    callAi("/api/ai/posts/" + encodeURIComponent(postId) + "/ask", { question: question }, $("#ai-box-" + postId), $form.find("button"));
  });

  // שאלה על הקבוצה
  $(document).on("submit", ".ai-group-form", function (e) {
    e.preventDefault();
    var $form = $(this);
    var groupId = $form.data("group-id");
    var question = $.trim($form.find("input[name=question]").val());
    callAi("/api/ai/groups/" + encodeURIComponent(groupId) + "/ask", { question: question }, $("#ai-group-box"), $form.find("button"));
  });
});
