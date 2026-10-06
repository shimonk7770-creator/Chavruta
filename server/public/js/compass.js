// server/public/js/compass.js
// מצפן התפילה בצד הלקוח: מסובב את המחוג כך שיצביע לירושלים, לפי חיישן הכיוון של הטלפון (DeviceOrientation).
//
// איך זה עובד:
//   heading = לאן "קדמת המכשיר" פונה, במעלות מצפון (0=צפון).   bearing = כיוון ירושלים מהמיקום (מחושב בשרת).
//   המחוג מסתובב ב-(bearing - heading) ביחס ל"למעלה"; הטבעת עם צפון/מזרח/דרום/מערב מסתובבת ב-(-heading).
//   כשהמחוג מצביע ישר למעלה - הטלפון פונה בדיוק לירושלים.
//
// מגבלות חשובות (גם מוצגות למשתמש בעמוד):
//   * DeviceOrientation ו-Geolocation פועלים רק ב"הקשר מאובטח" (HTTPS / localhost). ב-http://10.x.x.x מהטלפון - חסומים.
//     במקרה כזה המצפן נשאר "סטטי": מחוג בזווית הנכונה כשהצפון למעלה.
//   * iOS דורש בקשת הרשאה מפורשת (DeviceOrientationEvent.requestPermission) מתוך לחיצת משתמש.
//   * במחשב שולחני אין חיישן - נשארים במצב הסטטי.
(function () {
  var dial = document.getElementById("compass-dial");
  if (!dial) return;

  var ring = document.getElementById("compass-ring");
  var needle = document.getElementById("compass-needle");
  var statusEl = document.getElementById("compass-status");
  var startBtn = document.getElementById("compass-start");
  var locateBtn = document.getElementById("compass-locate");

  var bearing = Number(dial.getAttribute("data-bearing")) || 0; // כיוון ירושלים (מעלות)
  var atTarget = dial.getAttribute("data-at-target") === "1";
  var targetHeading = 0; // כיוון המכשיר כפי שהחיישן דיווח
  var shownHeading = 0; // כיוון מוחלק שמוצג (למניעת רעידות)
  var ringRotation = 0; // סיבוב מצטבר (לא מנורמל ל-360) כדי שה-CSS transition לא יסובב "דרך הארוכה"
  var needleRotation = 0;
  var sensorActive = false;
  var rafId = null;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "compass-status" + (kind ? " is-" + kind : "");
  }

  function normalize(deg) { return ((deg % 360) + 360) % 360; }
  // הפרש הזוויות הקצר ביותר בטווח [-180,180] (אותה פונקציה כמו shortestAngleDelta בשרת)
  function shortestDelta(from, to) { return ((to - from + 540) % 360) - 180; }

  // מציירת את המחוג והטבעת לפי shownHeading
  function render() {
    var wantRing = -shownHeading;
    var wantNeedle = bearing - shownHeading;
    ringRotation += shortestDelta(normalize(ringRotation), normalize(wantRing));
    needleRotation += shortestDelta(normalize(needleRotation), normalize(wantNeedle));
    ring.style.transform = "rotate(" + ringRotation + "deg)";
    needle.style.transform = "rotate(" + needleRotation + "deg)";

    // מיושר: המחוג בטווח ±6° מ"למעלה"
    var offset = Math.abs(shortestDelta(0, normalize(wantNeedle)));
    var aligned = sensorActive && !atTarget && offset <= 6;
    dial.classList.toggle("is-aligned", aligned);
    if (sensorActive) {
      if (atTarget) setStatus("אתם בהר הבית 🙏", "ok");
      else if (aligned) setStatus("✓ אתם פונים לירושלים", "ok");
      else setStatus("סובבו את הטלפון עד שהמחוג יצביע ישר למעלה", "");
    }
  }

  // לולאת הצגה חלקה: מתקרבים ל-targetHeading בכל פריים (מסנן תדר נמוך על החיישן הרועש)
  function loop() {
    shownHeading = normalize(shownHeading + shortestDelta(shownHeading, targetHeading) * 0.2);
    render();
    rafId = requestAnimationFrame(loop);
  }

  // ----- חיישן הכיוון -----
  function screenAngle() {
    var a = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (window.orientation || 0);
    return a || 0;
  }

  function onOrientation(e) {
    var heading = null;
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading; // iOS: כבר מעלות מצפון עם כיוון השעון
    } else if (e.absolute === true && typeof e.alpha === "number") {
      heading = normalize(360 - e.alpha); // Android: alpha נגד כיוון השעון מצפון
    } else {
      return; // חיישן יחסי (ג'ירו בלבד) - לא יודע איפה צפון
    }
    targetHeading = normalize(heading + screenAngle());
    if (!sensorActive) {
      sensorActive = true;
      if (!rafId) rafId = requestAnimationFrame(loop);
    }
  }

  function startSensor() {
    if (window.isSecureContext === false) {
      setStatus("הדפדפן חוסם את חיישן המצפן בחיבור לא מאובטח (HTTP). נדרש HTTPS - עד אז מוצג כיוון סטטי (צפון למעלה).", "error");
      return;
    }
    if (typeof DeviceOrientationEvent === "undefined") {
      setStatus("המכשיר/הדפדפן לא תומך בחיישן כיוון - מוצג כיוון סטטי (צפון למעלה).", "error");
      return;
    }
    function attach() {
      // Android: אירוע ה"מוחלט" (עם צפון מגנטי); iOS וחלק מהדפדפנים: deviceorientation עם webkitCompassHeading
      window.addEventListener("deviceorientationabsolute", onOrientation, true);
      window.addEventListener("deviceorientation", onOrientation, true);
      setStatus("מחכה לנתוני חיישן… (אם לא קורה כלום - ייתכן שאין חיישן במכשיר הזה)", "");
      // אם אחרי 3 שניות לא הגיע שום נתון - מודיעים
      setTimeout(function () {
        if (!sensorActive) setStatus("לא התקבלו נתוני חיישן. במחשב שולחני אין חיישן - נסו מהטלפון (בחיבור HTTPS).", "error");
      }, 3000);
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+: חובה לבקש הרשאה מתוך לחיצת משתמש
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === "granted") attach();
          else setStatus("לא ניתנה הרשאה לחיישן התנועה. אפשר לאשר בהגדרות Safari.", "error");
        })
        .catch(function () { setStatus("שגיאה בבקשת הרשאה לחיישן.", "error"); });
    } else {
      attach();
    }
  }

  if (startBtn) startBtn.addEventListener("click", startSensor);

  // ----- מיקום המכשיר: מחשבים כיוון מדויק יותר -----
  function updateText(data) {
    var bt = document.getElementById("compass-bearing-text");
    var dt = document.getElementById("compass-distance-text");
    var ot = document.getElementById("compass-origin-text");
    if (bt) bt.textContent = data.isAtTarget ? "אתם בהר הבית" : data.bearingRounded + "° " + data.pointHe;
    if (dt) dt.textContent = data.distanceKm + ' ק"מ';
    if (ot) ot.textContent = "המיקום שלך (מהמכשיר)";
  }

  if (locateBtn) {
    locateBtn.addEventListener("click", function () {
      if (!navigator.geolocation || window.isSecureContext === false) {
        setStatus("איתור מיקום חסום בחיבור לא מאובטח (HTTP) - בחרו עיר מהרשימה.", "error");
        return;
      }
      setStatus("מאתר את המיקום שלך…", "");
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          fetch("/compass/bearing?lat=" + pos.coords.latitude + "&lng=" + pos.coords.longitude)
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data.success) throw new Error(data.message);
              bearing = data.bearing;
              atTarget = data.isAtTarget;
              updateText(data);
              setStatus("המיקום עודכן ✓", "ok");
              render();
            })
            .catch(function () { setStatus("שגיאה בחישוב הכיוון מהמיקום.", "error"); });
        },
        function () { setStatus("לא ניתנה הרשאת מיקום - בחרו עיר מהרשימה.", "error"); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  render(); // ציור ראשוני סטטי (צפון למעלה, מחוג בזווית הנכונה)
})();
