// server/public/js/statusViewer.js
// לוגיקת "צפיית סטורי" - התקדמות אוטומטית בין שקופיות, אזורי הקשה שמאל/ימין, סרגלי התקדמות,
// ורישום צפייה (fetch) לכל שקופית שמוצגת - עדכון: פיצ'ר "סטטוס" (וואטסאפ-ification)
// כל ה-HTML של השקופיות כבר מרונדר בצד השרת (server/views/status/view.ejs) - הסקריפט הזה רק
// מציג/מסתיר ומתזמן, בלי לבנות DOM חדש.

(function () {
  var SLIDE_DURATION_MS = 5000;

  var root = document.getElementById("story-viewer");
  if (!root) return;

  var isOwner = root.dataset.isOwner === "1";
  var slides = Array.prototype.slice.call(root.querySelectorAll(".story-slide"));
  var tracks = Array.prototype.slice.call(root.querySelectorAll(".story-progress-track"));
  var current = 0;
  var timer = null;

  function recordView(statusId) {
    if (isOwner || !statusId) return; // הבעלים לא "צופה" בסטטוס של עצמו
    fetch("/status/" + statusId + "/view", { method: "POST" }).catch(function () {
      // לא קריטי - כשל ברישום צפייה לא אמור לשבש את חוויית הצפייה עצמה
    });
  }

  function setTrackState(index, state) {
    // state: "empty" | "filling" | "done"
    var track = tracks[index];
    if (!track) return;
    var fill = track.querySelector(".story-progress-fill");
    track.classList.remove("is-filling");
    if (state === "empty") {
      fill.style.width = "0%";
    } else if (state === "done") {
      fill.style.width = "100%";
    } else {
      fill.style.width = "0%";
      // ה-reflow הקטן הבא הכרחי כדי שהדפדפן "יתחיל מחדש" את מעבר ה-CSS מ-0% בכל שקופית
      // eslint-disable-next-line no-unused-expressions
      fill.offsetWidth;
      track.classList.add("is-filling");
      fill.style.width = "100%";
    }
  }

  function showSlide(index) {
    clearTimeout(timer);
    if (index < 0) index = 0;
    if (index >= slides.length) {
      // סיימנו את כל הסטוריז של המשתמש הזה - חוזרים לדף הבית, בדיוק כמו סגירת הסטורי האחרון בוואטסאפ
      window.location.href = "/";
      return;
    }

    slides.forEach(function (slide, i) {
      slide.style.display = i === index ? "flex" : "none";
    });
    tracks.forEach(function (_, i) {
      setTrackState(i, i < index ? "done" : i === index ? "filling" : "empty");
    });

    current = index;
    recordView(slides[index].dataset.statusId);

    timer = setTimeout(function () {
      showSlide(current + 1);
    }, SLIDE_DURATION_MS);
  }

  root.querySelector(".story-tap-next").addEventListener("click", function () {
    showSlide(current + 1);
  });
  root.querySelector(".story-tap-prev").addEventListener("click", function () {
    if (current === 0) return; // בשקופית הראשונה - הקשה שמאלית לא עושה כלום (אין "קודם")
    showSlide(current - 1);
  });

  // טוגל רשימת "נצפה ע"י" - מוצג רק לבעל הסטטוס (ה-HTML עצמו כבר קיים רק אצלו, ראו view.ejs)
  root.querySelectorAll(".story-viewers-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var list = btn.nextElementSibling;
      if (!list) return;
      list.style.display = list.style.display === "none" ? "block" : "none";
    });
  });

  showSlide(0);
})();
