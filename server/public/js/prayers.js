// server/public/js/prayers.js
// עמוד תפילה בודדת: טוען את הנוסח ב-Ajax (jQuery) מ-GET /prayers/data/:nusach/:prayer ומצייר אותו בדף.
// כל הטקסט נכנס לדף דרך .text() / textContent - לעולם לא כ-HTML - כך שגם אם הטקסט שהגיע מבחוץ יכיל תגיות הן לא יורצו (XSS).
// בנוסף: מתג ניקוד (מסיר/מחזיר סימני ניקוד וטעמים בצד הלקוח), שינוי גודל טקסט (נשמר ב-localStorage) ותוכן עניינים לקפיצה לקטע.
$(function () {
  var $root = $("#prayer-root");
  if (!$root.length) return;

  var nusach = $root.data("nusach");
  var prayer = $root.data("prayer");
  var $text = $("#prayer-text");
  var NIKUD_RE = /[֑-ׇ]/g; // ניקוד + טעמי מקרא (בלי אותיות)
  var sections = []; // הנתונים המקוריים (עם ניקוד) - מכאן מציירים מחדש כשמחליפים מתג ניקוד

  // ----- גודל טקסט (נשמר בין ביקורים; localStorage עלול להיחסם - עטוף ב-try) -----
  var FONT_KEY = "chavruta-prayer-font";
  var fontRem = 1.35;
  try {
    var saved = parseFloat(localStorage.getItem(FONT_KEY));
    if (saved >= 1 && saved <= 2.6) fontRem = saved;
  } catch (e) {}
  function applyFont() {
    $text.css("font-size", fontRem + "rem");
    try { localStorage.setItem(FONT_KEY, String(fontRem)); } catch (e) {}
  }
  $("#prayer-font-plus").on("click", function () { fontRem = Math.min(2.6, +(fontRem + 0.15).toFixed(2)); applyFont(); });
  $("#prayer-font-minus").on("click", function () { fontRem = Math.max(1, +(fontRem - 0.15).toFixed(2)); applyFont(); });
  applyFont();

  // ----- ציור הטקסט -----
  function render() {
    var showNikud = $("#prayer-nikud").is(":checked");
    $text.empty();
    sections.forEach(function (section, idx) {
      var $sec = $("<section>").addClass("prayer-section").attr("id", "sec-" + idx);
      $("<h2>").addClass("prayer-section-title").text(section.heTitle).appendTo($sec);
      section.lines.forEach(function (line) {
        var content = showNikud ? line : line.replace(NIKUD_RE, "");
        $("<p>").addClass("prayer-line").text(content).appendTo($sec);
      });
      $text.append($sec);
    });
  }

  function renderToc() {
    var $toc = $("#prayer-toc").empty();
    if (sections.length < 2) return;
    sections.forEach(function (section, idx) {
      $("<a>").attr("href", "#sec-" + idx).addClass("prayer-toc-link").text(section.heTitle).appendTo($toc);
    });
    $toc.show();
  }

  function showError(message) {
    $("#prayer-loading").hide();
    $("#prayer-error").text(message).show();
  }

  $("#prayer-nikud").on("change", render);

  $.ajax({
    url: "/prayers/data/" + encodeURIComponent(nusach) + "/" + encodeURIComponent(prayer),
    method: "GET",
    dataType: "json",
    timeout: 120000, // הטעינה הראשונה שולפת עשרות קטעים - נותנים עד שתי דקות
  })
    .done(function (res) {
      $("#prayer-loading").hide();
      if (res.unavailable) {
        $("#prayer-unavailable-reason").text(res.reason);
        $("#prayer-unavailable").show();
        return;
      }
      sections = (res.prayer && res.prayer.sections) || [];
      if (!sections.length) return showError("לא התקבל טקסט עבור התפילה הזו.");
      renderToc();
      render();
    })
    .fail(function (xhr) {
      var msg = xhr.responseJSON && xhr.responseJSON.message;
      showError(msg || "אירעה שגיאה בטעינת הנוסח. נסו לרענן את העמוד.");
    });
});
