// server/public/js/dmChat.js
// לקוח הצ'אט הפרטי (1-על-1) בזמן אמת - אותו רעיון בדיוק כמו chat.js (הצ'אט הקבוצתי),
// רק עם אירועי dm:* ומזהה המשתמש השני במקום מזהה קבוצה. jQuery כבר נטען ב-head.ejs.

$(function () {
  const $box = $("#chat-messages");
  const otherUserId = $box.data("other-user-id");
  const myUserId = String($box.data("user-id"));

  let lastMessageTime = new Date().toISOString(); // לשימוש ב-REST fallback כשמתחברים/מתחברים-מחדש
  let typingTimeout = null;
  let typingSendTimeout = null;

  // FR-024 (אותו רעיון): מתחברים ל-socket, reconnection מופעל כברירת מחדל ב-socket.io-client
  const socket = io();

  function renderMessage(msg) {
    const mineClass = String(msg.senderId) === myUserId ? " mine" : "";
    const $msg = $("<div>").addClass("chat-message" + mineClass);
    $("<span>").addClass("chat-sender").text(msg.senderName).appendTo($msg);
    $("<span>").addClass("chat-content").text(msg.content).appendTo($msg);
    $box.append($msg);
    $box.scrollTop($box[0].scrollHeight);

    $box.find(".chat-empty").remove();

    if (msg.createdAt) {
      const iso = typeof msg.createdAt === "string" ? msg.createdAt : new Date(msg.createdAt).toISOString();
      lastMessageTime = iso;
    }
  }

  // משלים הודעות שפוספסו בזמן הניתוק, דרך נתיב REST רגיל - לא תלוי ב-socket בכלל
  function fetchMissedMessages() {
    $.get("/api/messages/" + otherUserId + "/history", { since: lastMessageTime })
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
    socket.emit("dm:join", otherUserId);
    fetchMissedMessages();
  });

  socket.on("disconnect", function () {
    $("#chat-connection-status").text("החיבור נותק - מנסה להתחבר מחדש...").addClass("error");
  });

  socket.on("dm:message", renderMessage);

  socket.on("chat:error", function (message) {
    $("#chat-connection-status").text(message).addClass("error");
  });

  // מחוון "X מקליד..." - נעלם אוטומטית אחרי 2 שניות בלי הקלדה נוספת מהצד השני
  socket.on("dm:typing", function (data) {
    $("#chat-typing-indicator").text(data.userName + " מקליד...").show();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () {
      $("#chat-typing-indicator").hide();
    }, 2000);
  });

  $("#chat-input").on("input", function () {
    if (typingSendTimeout) return;
    socket.emit("dm:typing", otherUserId);
    typingSendTimeout = setTimeout(function () {
      typingSendTimeout = null;
    }, 1500);
  });

  $("#chat-form").on("submit", function (e) {
    e.preventDefault();
    const $input = $("#chat-input");
    const content = $input.val().trim();
    if (!content) return;
    socket.emit("dm:send", { recipientId: otherUserId, content: content });
    $input.val("");
  });
});
