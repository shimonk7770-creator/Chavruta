// server/public/js/aiCompose.js
// עזרה בכתיבת פוסט חדש (עמוד קבוצה) - שני כפתורים מתחת לשדה התוכן:
//   "✨ שפר ניסוח" - ה-AI מציע נוסח משופר לטיוטה; המשתמש רואה אותו ולוחץ "השתמש בנוסח" כדי להחליף את הטיוטה
//   "💡 הצע כותרת" - ה-AI מציע 3 כותרות; לחיצה על אחת מכניסה אותה לשדה הכותרת
// שום דבר לא נשמר ולא מתפרסם אוטומטית. כל הטקסטים נכנסים לדף עם .text()/.val() בלבד (בטוח מ-XSS).
$(function () {
  var $tools = $(".compose-tools");
  if (!$tools.length) return;

  var $title = $("#postTitle");
  var $content = $("#postContent");
  var $box = $("#compose-box");
  var $buttons = $(".compose-btn");

  function show(kind, message) {
    $box.removeClass("is-loading is-error").addClass(kind || "").empty().show();
    if (message) $("<div>").text(message).appendTo($box);
  }

  function ask(mode) {
    show("is-loading", "ה-AI חושב...");
    $buttons.prop("disabled", true);
    $.ajax({
      url: "/api/ai/compose",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ mode: mode, title: $.trim($title.val()), content: $content.val() }),
    })
      .done(function (res) {
        show("", "");
        if (mode === "title") renderTitles(res.answer);
        else renderImproved(res.answer);
        $("<small>").addClass("ai-disclaimer").text(res.disclaimer || "").appendTo($box);
      })
      .fail(function (xhr) {
        show("is-error", xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "לא הצלחנו להתחבר לשרת. נסו שוב.");
      })
      .always(function () {
        $buttons.prop("disabled", false);
      });
  }

  // 3 הצעות כותרת - כפתור לכל אחת
  function renderTitles(answer) {
    var $list = $("<div>").addClass("compose-suggestions");
    answer
      .split("\n")
      .map(function (line) { return $.trim(line.replace(/^[-*\d.\s"']+|["']+$/g, "")); })
      .filter(Boolean)
      .slice(0, 3)
      .forEach(function (text) {
        $("<button>").attr("type", "button").addClass("compose-suggestion-btn").text(text).on("click", function () {
          $title.val(text.slice(0, 150)).focus();
        }).appendTo($list);
      });
    $box.append($list);
  }

  // נוסח משופר - תצוגה מקדימה + כפתור "השתמש בנוסח"
  function renderImproved(answer) {
    $("<div>").addClass("compose-preview").text(answer).appendTo($box);
    $("<button>").attr("type", "button").addClass("ai-summary-btn").text("השתמש בנוסח").on("click", function () {
      $content.val(answer.slice(0, 5000)).focus();
      $box.hide();
    }).appendTo($box);
  }

  $(".compose-btn").on("click", function () { ask($(this).data("mode")); });
});
