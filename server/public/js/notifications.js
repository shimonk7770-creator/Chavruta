// server/public/js/notifications.js
// פעמון התראות בזמן אמת - מוצג בתפריט העליון לכל משתמש מחובר, בכל עמוד באתר (לא רק בצ'אט).
// נטען רק כשמחובר (ראו partials/header.ejs) - פותח חיבור Socket.io עצמאי משלו, בדיוק כמו chat.js
// (שני חיבורי socket נפרדים לאותו משתמש זה תקין לגמרי ב-Socket.io - כל אחד עושה עבודה שונה).
// jQuery כבר נטען ב-head.ejs.

$(function () {
  const $btn = $("#notif-bell-btn");
  if (!$btn.length) return; // ליתר בטחון

  const $badge = $("#notif-badge");
  const $dropdown = $("#notif-dropdown");
  const socket = io();

  function escapeHtml(text) {
    return $("<div>").text(text || "").html();
  }

  function renderList(notifications) {
    $dropdown.empty();
    if (!notifications.length) {
      $dropdown.append($("<p>").addClass("meta notif-empty").text("אין התראות עדיין"));
      return;
    }
    notifications.forEach(function (n) {
      $("<a>")
        .addClass("notif-item" + (n.isRead ? "" : " unread"))
        .attr("href", n.link || "/")
        .text(n.text)
        .appendTo($dropdown);
    });
  }

  function updateBadge(count) {
    if (count > 0) {
      $badge.text(count > 9 ? "9+" : String(count)).show();
    } else {
      $badge.hide();
    }
  }

  // טעינה ראשונית - כל ההתראות שהצטברו עד עכשיו (כולל כאלה שנוצרו כשהמשתמש לא היה מחובר לאתר)
  $.get("/api/notifications").done(function (res) {
    if (res.success) {
      renderList(res.notifications);
      updateBadge(res.unreadCount);
    }
  });

  $btn.on("click", function (e) {
    e.stopPropagation();
    const willOpen = $dropdown.is(":hidden");
    $dropdown.toggle(willOpen);
    if (willOpen) {
      // מסמנים כ"נקרא" ברגע שפותחים את התפריט - כמו ברוב אתרי הרשתות החברתיות
      $.post("/api/notifications/mark-read").done(function () {
        updateBadge(0);
        $dropdown.find(".notif-item").removeClass("unread");
      });
    }
  });

  // סגירת תפריט הפעמון בלחיצה בכל מקום אחר בעמוד
  $(document).on("click", function () {
    $dropdown.hide();
  });
  $dropdown.on("click", function (e) {
    e.stopPropagation();
  });

  // התראה חדשה שמגיעה בזמן אמת (מ-chatSocket.js או commentController.js) - בלי לרענן ולבלי לבקש מהשרת שוב
  socket.on("notification:new", function (notif) {
    const current = parseInt($badge.text(), 10);
    updateBadge((Number.isFinite(current) && $badge.is(":visible") ? current : 0) + 1);
    $dropdown.find(".notif-empty").remove();
    $("<a>")
      .addClass("notif-item unread new")
      .attr("href", notif.link || "/")
      .text(notif.text)
      .prependTo($dropdown);

    // אנימציית "פופ" קצרה על הבועה - משוב חזותי שמשהו חדש הגיע
    $badge.addClass("pop");
    setTimeout(function () {
      $badge.removeClass("pop");
    }, 350);
  });
});
