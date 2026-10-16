// server/public/js/likes.js
// ❤️ אהבתי ו-🔗 שיתוף, בלי רענון עמוד (jQuery/Ajax). הכפתורים מוגדרים ב-groups/show.ejs (פוסטים) וב-comments.js (תגובות).
// הלייק מתעדכן מיד במסך (optimistic UI) ומתוקן לפי תשובת השרת; אם הבקשה נכשלה חוזרים למצב הקודם.

$(function () {
  $(document).on("click", ".like-btn", function () {
    const $btn = $(this);
    if ($btn.prop("disabled") || $btn.data("busy")) return;
    const kind = $btn.data("kind"); // "post" | "comment"
    const id = $btn.data("id");
    const url = kind === "post" ? `/api/posts/${id}/like` : `/api/comments/${id}/like`;

    const wasLiked = $btn.hasClass("liked");
    const oldCount = parseInt($btn.find(".like-count").text(), 10) || 0;
    render($btn, !wasLiked, Math.max(0, oldCount + (wasLiked ? -1 : 1)));
    $btn.data("busy", true);

    $.ajax({
      url: url,
      method: "POST",
      success: function (res) {
        render($btn, res.liked, res.likeCount);
      },
      error: function () {
        render($btn, wasLiked, oldCount); // החזרה למצב הקודם
      },
      complete: function () {
        $btn.data("busy", false);
      },
    });
  });

  function render($btn, liked, count) {
    $btn.toggleClass("liked", liked);
    $btn.find(".like-heart").text(liked ? "❤️" : "🤍");
    $btn.find(".like-count").text(count);
  }

  // שיתוף: בטלפונים/דפדפנים שתומכים - חלון השיתוף של המכשיר; אחרת מעתיקים את הקישור ללוח
  $(document).on("click", ".share-btn", function () {
    const $btn = $(this);
    const fullUrl = window.location.origin + $btn.data("url");
    const title = String($btn.data("title") || "חברותא");
    if (navigator.share) {
      navigator.share({ title: title, url: fullUrl }).catch(function () {});
      return;
    }
    const done = function (ok) {
      const old = $btn.text();
      $btn.text(ok ? "✔ הקישור הועתק" : fullUrl);
      setTimeout(function () {
        $btn.text(old);
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });
});
