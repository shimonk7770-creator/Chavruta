// server/public/js/chat.js
// לקוח הצ'אט בזמן אמת - מתחבר ל-Socket.io, מציג הודעות חיות, מטפל בניתוק/חיבור מחדש (FR-021..FR-024)
// נטען כ-<script> רגיל (לא React) - jQuery כבר נטען ב-head.ejs ונעזרים בו לטיפול ב-DOM/אירועים

$(function () {
  const $box = $("#chat-messages");
  const groupId = $box.data("group-id");
  const myUserId = String($box.data("user-id"));

  let lastMessageTime = new Date().toISOString(); // לשימוש ב-REST fallback כשמתחברים/מתחברים-מחדש
  let typingTimeout = null;
  let typingSendTimeout = null;

  // FR-024: מתחברים ל-socket. reconnection מופעל כברירת מחדל ב-socket.io-client -
  // אין צורך בלוגיקת retry ידנית, רק להגיב לאירועי connect/disconnect בהתאם
  const socket = io();

  function renderMessage(msg) {
    const mineClass = String(msg.senderId) === myUserId ? " mine" : "";
    const $msg = $("<div>").addClass("chat-message" + mineClass);
    $("<span>").addClass("chat-sender").text(msg.senderName).appendTo($msg);
    $("<span>").addClass("chat-content").text(msg.content).appendTo($msg);
    $box.append($msg);
    $box.scrollTop($box[0].scrollHeight);

    // מסירים את הודעת "אין עדיין הודעות" ברגע שמגיעה הודעה ראשונה לחדר
    $box.find(".chat-empty").remove();

    if (msg.createdAt) {
      const iso = typeof msg.createdAt === "string" ? msg.createdAt : new Date(msg.createdAt).toISOString();
      lastMessageTime = iso;
    }
  }

  // FR-024: משלים הודעות שפוספסו בזמן הניתוק, דרך נתיב REST רגיל - לא תלוי ב-socket בכלל
  function fetchMissedMessages() {
    $.get("/api/groups/" + groupId + "/chat/history", { since: lastMessageTime })
      .done(function (res) {
        if (res.success && res.messages.length) {
          res.messages.forEach(renderMessage);
        }
      })
      .fail(function () {
        // לא קריטי - פשוט לא נשלים היסטוריה חסרה כרגע; ה-socket עצמו כבר יציג הודעות חדשות מעכשיו
      });
  }

  socket.on("connect", function () {
    $("#chat-connection-status").text("מחובר").removeClass("error");
    socket.emit("chat:join", groupId);
    fetchMissedMessages(); // FR-024: בכל חיבור/חיבור-מחדש, משלימים מה שפוספס
  });

  socket.on("disconnect", function () {
    $("#chat-connection-status").text("החיבור נותק - מנסה להתחבר מחדש...").addClass("error");
  });

  socket.on("chat:message", renderMessage);

  socket.on("chat:error", function (message) {
    $("#chat-connection-status").text(message).addClass("error");
  });

  // FR-023: מחוון "X מקליד..." - נעלם אוטומטית אחרי 2 שניות בלי הקלדה נוספת מהצד השני
  socket.on("chat:typing", function (data) {
    $("#chat-typing-indicator").text(data.userName + " מקליד...").show();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () {
      $("#chat-typing-indicator").hide();
    }, 2000);
  });

  $("#chat-input").on("input", function () {
    // שולחים "מקליד" לכל היותר פעם ב-1.5 שניות - לא בכל תו, כדי לא להציף את השרת בהודעות typing
    if (typingSendTimeout) return;
    socket.emit("chat:typing", groupId);
    typingSendTimeout = setTimeout(function () {
      typingSendTimeout = null;
    }, 1500);
  });

  $("#chat-form").on("submit", function (e) {
    e.preventDefault();
    const $input = $("#chat-input");
    const content = $input.val().trim();
    if (!content) return;
    socket.emit("chat:send", { groupId: groupId, content: content });
    $input.val("");
  });
});
