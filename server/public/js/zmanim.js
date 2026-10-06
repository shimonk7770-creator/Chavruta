// server/public/js/zmanim.js
// עמוד "זמני היום" - עדכון בזמן אמת בצד הלקוח (בלי רענון): שעון חי בשעון העיר שנבחרה, סימון זמנים שכבר עברו,
// הדגשת הזמן הבא וספירה לאחור אליו, ורענון אוטומטי של העמוד כשמתחלף היום (חצות בעיר).
// כל חותמות הזמן (data-ts) מחושבות בשרת (zmanimTimes.js) - כאן רק משווים אותן ל-Date.now().
(function () {
  var hero = document.querySelector(".zmanim-hero");
  if (!hero || hero.getAttribute("data-is-today") !== "1") return; // תאריך אחר ממה שהיום - אין "עכשיו" להדגיש

  var tz = hero.getAttribute("data-tz");
  var pageDate = hero.getAttribute("data-date");
  var rows = Array.prototype.slice.call(document.querySelectorAll(".zman-row"));
  var clockEl = document.getElementById("zmanim-clock");
  var nextEl = document.getElementById("zmanim-next");

  // שעון חי בשעון העיר (לא בשעון המכשיר - כך שמי שגולש מחו"ל רואה את שעון העיר שבחר)
  var clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  var dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

  // "1:23:10" / "12:05" - ספירה לאחור קריאה
  function formatDiff(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
  }

  function tick() {
    var now = Date.now();

    // התחלף היום בעיר -> טוענים מחדש כדי לקבל את זמני היום החדש
    if (dateFmt.format(new Date(now)) !== pageDate) {
      window.location.reload();
      return;
    }
    if (clockEl) clockEl.textContent = clockFmt.format(new Date(now));

    var nextRow = null;
    rows.forEach(function (row) {
      var ts = Number(row.getAttribute("data-ts"));
      var cd = row.querySelector(".zman-countdown");
      row.classList.remove("is-past", "is-next");
      if (ts <= now) {
        row.classList.add("is-past");
        if (cd) cd.textContent = "";
      } else if (!nextRow) {
        nextRow = row; // השורות מסודרות כרונולוגית - הראשונה שעוד לא עברה היא "הבאה"
      } else if (cd) {
        cd.textContent = "";
      }
    });

    if (nextRow) {
      nextRow.classList.add("is-next");
      var nextTs = Number(nextRow.getAttribute("data-ts"));
      var label = nextRow.querySelector(".zman-label").childNodes[0].textContent.trim();
      var cdEl = nextRow.querySelector(".zman-countdown");
      if (cdEl) cdEl.textContent = "בעוד " + formatDiff(nextTs - now);
      if (nextEl) nextEl.textContent = "הזמן הבא: " + label + " - בעוד " + formatDiff(nextTs - now);
    } else if (nextEl) {
      nextEl.textContent = "כל זמני היום עברו";
    }
  }

  tick();
  setInterval(tick, 1000);
})();
