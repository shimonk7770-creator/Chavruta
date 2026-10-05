// server/public/js/chat.js
// לקוח הצ'אט בזמן אמת - מתחבר ל-Socket.io, מציג הודעות חיות, מטפל בניתוק/חיבור מחדש (FR-021..FR-024)
// נטען כ-<script> רגיל (לא React) - jQuery כבר נטען ב-head.ejs ונעזרים בו לטיפול ב-DOM/אירועים

// רשימת אימוג'י קבועה וסגורה (בלי ספרייה/תלות חיצונית חדשה) - תוספת לפי משוב המשתמש (אוקטובר 2026)
const CHAT_EMOJIS = [
  "😀", "😂", "😍", "😊", "😉", "😢", "😭", "😡", "😮", "🥳",
  "👍", "👎", "🙏", "👏", "💪", "🤝", "✌️", "🤔", "😴", "🤗",
  "❤️", "🔥", "✨", "🎉", "📖", "🕎", "✡️", "🙌", "👌", "💬",
];

$(function () {
  const $box = $("#chat-messages");
  const groupId = $box.data("group-id");
  const myUserId = String($box.data("user-id"));

  let lastMessageTime = new Date().toISOString(); // לשימוש ב-REST fallback כשמתחברים/מתחברים-מחדש
  let typingTimeout = null;
  let typingSendTimeout = null;
  let pendingImageFile = null; // קובץ תמונה שנבחר וממתין לשליחה (תוספת: תמונות בצ'אט)

  // FR-024: מתחברים ל-socket. reconnection מופעל כברירת מחדל ב-socket.io-client -
  // אין צורך בלוגיקת retry ידנית, רק להגיב לאירועי connect/disconnect בהתאם
  const socket = io();

  function renderMessage(msg) {
    const mineClass = String(msg.senderId) === myUserId ? " mine" : "";
    const $msg = $("<div>").addClass("chat-message" + mineClass);
    $("<span>").addClass("chat-sender").text(msg.senderName).appendTo($msg);
    // תוספת: תמונה בהודעה (אופציונלי, יכול להופיע גם בלי טקסט) - נבנית כ-DOM element עם .attr, לא .html(), בטוח מ-XSS
    if (msg.imageUrl) {
      $("<a>")
        .attr({ href: msg.imageUrl, target: "_blank", rel: "noopener" })
        .append($("<img>").addClass("chat-image").attr({ src: msg.imageUrl, alt: "תמונה בצ'אט" }))
        .appendTo($msg);
    }
    if (msg.content) {
      $("<span>").addClass("chat-content").text(msg.content).appendTo($msg);
    }
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

  // ===== תוספת לפי משוב המשתמש (אוקטובר 2026): הוספת אימוג'י =====
  // בונים את פופאפ בחירת האימוג'י דינמית מתוך רשימת CHAT_EMOJIS (לא ב-EJS) - כך שקל להוסיף/להסיר אימוג'י במקום אחד
  const $emojiPicker = $("#chat-emoji-picker");
  CHAT_EMOJIS.forEach(function (emoji) {
    $("<button>", { type: "button", class: "chat-emoji-option", text: emoji })
      .appendTo($emojiPicker)
      .on("click", function () {
        const $input = $("#chat-input");
        $input.val($input.val() + emoji).trigger("focus");
      });
  });

  $("#chat-emoji-btn").on("click", function (e) {
    e.stopPropagation();
    $emojiPicker.toggle();
  });
  // סגירת הפופאפ בלחיצה בכל מקום אחר בעמוד
  $(document).on("click", function () {
    $emojiPicker.hide();
  });
  $emojiPicker.on("click", function (e) {
    e.stopPropagation();
  });

  // ===== תוספת לפי משוב המשתמש (אוקטובר 2026): שליחת תמונות בצ'אט =====
  // Socket.io לא מטפל בקבצים - קודם מעלים את התמונה דרך נתיב REST רגיל (multer), ורק אז שולחים chat:send
  // עם ה-imageUrl שהתקבל, בדיוק כמו הודעת טקסט רגילה (ראו server/controllers/chatController.uploadChatImage)
  $("#chat-image-input").on("change", function () {
    const file = this.files && this.files[0];
    if (!file) return;
    pendingImageFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
      $("#chat-pending-image-thumb").attr("src", e.target.result);
      $("#chat-pending-image").show();
    };
    reader.readAsDataURL(file);
  });

  $("#chat-pending-image-remove").on("click", function () {
    pendingImageFile = null;
    $("#chat-image-input").val("");
    $("#chat-pending-image").hide();
  });

  function uploadPendingImage() {
    const formData = new FormData();
    formData.append("image", pendingImageFile);
    return $.ajax({
      url: "/api/groups/" + groupId + "/chat/image",
      method: "POST",
      data: formData,
      processData: false,
      contentType: false,
    });
  }

  $("#chat-form").on("submit", function (e) {
    e.preventDefault();
    const $input = $("#chat-input");
    const content = $input.val().trim();

    // הודעה חייבת לכלול טקסט או תמונה (או שניהם) - בדיוק כמו בוואטסאפ
    if (!content && !pendingImageFile) return;

    function sendMessage(imageUrl) {
      socket.emit("chat:send", { groupId: groupId, content: content, imageUrl: imageUrl || "" });
      $input.val("");
      pendingImageFile = null;
      $("#chat-image-input").val("");
      $("#chat-pending-image").hide();
    }

    if (pendingImageFile) {
      uploadPendingImage()
        .done(function (res) {
          if (res.success) {
            sendMessage(res.imageUrl);
          } else {
            $("#chat-connection-status").text(res.message || "שגיאה בהעלאת התמונה").addClass("error");
          }
        })
        .fail(function () {
          $("#chat-connection-status").text("שגיאה בהעלאת התמונה - נסה שוב").addClass("error");
        });
    } else {
      sendMessage("");
    }
  });
});
