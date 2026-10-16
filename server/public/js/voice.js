// server/public/js/voice.js
// 🎤 הקלטה → טקסט: מוסיף כפתור מיקרופון ליד כל שדה שמסומן data-voice (פוסט, תגובה, צ'אט). לחיצה מתחילה הקלטה,
// לחיצה נוספת (או 60 שניות) עוצרת ושולחת את ההקלטה לשרת (POST /api/ai/transcribe) שמתמלל אותה עם Gemini.
// התמלול נכנס לשדה (מתווסף לטקסט הקיים) והמשתמש יכול לתקן אותו לפני השליחה. ההקלטה לא נשמרת בשרת.
//
// הערה: MediaRecorder/getUserMedia עובדים רק בהקשר מאובטח (HTTPS או localhost). בגלישה לכתובת רשת מקומית מהטלפון
// (http://10.x.x.x:3000) הדפדפן חוסם - אז מוצגת הודעה ברורה. באפליקציית המובייל ההקלטה עובדת תמיד.

(function () {
  var MAX_SECONDS = 60;
  var supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  // בוחר פורמט ש-MediaRecorder של הדפדפן מסוגל להקליט (Chrome/Firefox: webm/ogg, Safari: mp4)
  function pickMime() {
    var options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (var i = 0; i < options.length; i++) {
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(options[i])) return options[i];
    }
    return "";
  }

  function attach(field) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voice-btn";
    btn.title = "הקלטה והמרה לטקסט";
    btn.setAttribute("aria-label", "הקלטת הודעה קולית");
    btn.textContent = "🎤";
    field.insertAdjacentElement("afterend", btn);

    var status = document.createElement("span");
    status.className = "voice-status meta";
    status.setAttribute("role", "status");
    btn.insertAdjacentElement("afterend", status);

    var recorder = null;
    var chunks = [];
    var stream = null;
    var timer = null;

    function setStatus(text, isError) {
      status.textContent = text || "";
      status.classList.toggle("is-error", !!isError);
    }
    function cleanup() {
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
      recorder = null;
      btn.classList.remove("recording");
      btn.textContent = "🎤";
    }

    btn.addEventListener("click", function () {
      if (recorder) {
        recorder.stop(); // עצירה ידנית -> onstop שולח לתמלול
        return;
      }
      if (!supported || window.isSecureContext === false) {
        setStatus("הקלטה לא זמינה בחיבור הזה (נדרש HTTPS או localhost). אפשר להשתמש באפליקציה או להקליד.", true);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s;
        chunks = [];
        var mime = pickMime();
        recorder = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
        recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = function () {
          var type = recorder && recorder.mimeType ? recorder.mimeType : mime || "audio/webm";
          var blob = new Blob(chunks, { type: type });
          cleanup();
          send(blob, type);
        };
        recorder.start();
        btn.classList.add("recording");
        btn.textContent = "⏹";
        setStatus("מקליט… לחצו שוב לעצירה", false);
        timer = setTimeout(function () { if (recorder) recorder.stop(); }, MAX_SECONDS * 1000);
      }).catch(function () {
        cleanup();
        setStatus("אין הרשאה למיקרופון. אשרו אותה בדפדפן ונסו שוב.", true);
      });
    });

    function send(blob, type) {
      if (blob.size < 800) { setStatus("ההקלטה קצרה מדי, נסו שוב.", true); return; }
      btn.disabled = true;
      setStatus("מתמלל…", false);
      var form = new FormData();
      var ext = type.indexOf("mp4") >= 0 ? "m4a" : type.indexOf("ogg") >= 0 ? "ogg" : "webm";
      form.append("audio", blob, "voice." + ext);
      fetch("/api/ai/transcribe", { method: "POST", body: form, credentials: "same-origin" })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body.success) { setStatus(res.body.message || "התמלול נכשל, נסו שוב.", true); return; }
          var current = field.value ? field.value.replace(/\s+$/, "") + " " : "";
          field.value = current + res.body.text;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
          setStatus("✔ הועתק. אפשר לתקן לפני השליחה.", false);
        })
        .catch(function () { setStatus("אין חיבור לשרת, נסו שוב.", true); })
        .then(function () { btn.disabled = false; });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-voice]").forEach(attach);
  });
})();
