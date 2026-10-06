// server/public/js/minyanim.js
// קטגוריית "מניינים" בצד הלקוח:
//  1. כפתור "המיקום שלי" (Geolocation API) - בעמוד החיפוש שולח את הקואורדינטות ומחפש; בטופס ההוספה רק שומר אותן בשדות נסתרים.
//  2. ספירה לאחור חיה ("עוד 7 דק'") שמתעדכנת בכל שנייה בלי רענון, וסימון מניינים שכבר הסתיימו.
//  3. רענון עדין של הרשימה כל 10 דקות (כדי שהסדר והמרחקים יישארו נכונים גם אם הדף נשאר פתוח).
//
// הערה חשובה: Geolocation בדפדפן עובד רק ב"הקשר מאובטח" - HTTPS או localhost. בגלישה מהטלפון לכתובת רשת
// מקומית (http://10.x.x.x:3000) הדפדפן חוסם אותו; לכן תמיד יש חלופה: בחירת עיר או הקלדת כתובת.
(function () {
  var statusEl = document.getElementById("minyanim-locate-status");
  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
  }

  // מבקש מיקום מהמכשיר; onSuccess מקבל {lat,lng}
  function locate(onSuccess) {
    if (!navigator.geolocation) {
      setStatus("הדפדפן לא תומך באיתור מיקום - בחרו עיר או הקלידו כתובת.", true);
      return;
    }
    if (window.isSecureContext === false) {
      setStatus("הדפדפן חוסם איתור מיקום בחיבור לא מאובטח (HTTP) - בחרו עיר או הקלידו כתובת.", true);
      return;
    }
    setStatus("מאתר את המיקום שלך…", false);
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      function (err) {
        var msg = err && err.code === 1
          ? "לא ניתנה הרשאת מיקום - בחרו עיר או הקלידו כתובת."
          : "לא הצלחנו לאתר את המיקום - בחרו עיר או הקלידו כתובת.";
        setStatus(msg, true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  var latInput = document.getElementById("minyanim-lat");
  var lngInput = document.getElementById("minyanim-lng");

  // ----- עמוד החיפוש -----
  var searchForm = document.getElementById("minyanim-search-form");
  var locateBtn = document.getElementById("minyanim-locate");
  if (searchForm && locateBtn) {
    locateBtn.addEventListener("click", function () {
      locate(function (pos) {
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
        searchForm.submit();
      });
    });
    // אם המשתמש מקליד כתובת או מחליף עיר - מנקים את הקואורדינטות השמורות מ"המיקום שלי", אחרת הן היו גוברות על הבחירה החדשה
    function clearCoords() { latInput.value = ""; lngInput.value = ""; }
    var qInput = document.getElementById("minyanim-q");
    var citySelect = document.getElementById("minyanim-city");
    if (qInput) qInput.addEventListener("input", clearCoords);
    if (citySelect) citySelect.addEventListener("change", clearCoords);
  }

  // ----- טופס הוספת מניין -----
  var hereBtn = document.getElementById("minyanim-locate-here");
  if (hereBtn) {
    hereBtn.addEventListener("click", function () {
      locate(function (pos) {
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
        setStatus("✓ המיקום נקלט - המניין יישמר בדיוק במקום הזה", false);
      });
    });
  }

  // ----- ספירה לאחור חיה -----
  var cards = Array.prototype.slice.call(document.querySelectorAll(".minyan-card"));
  if (cards.length) {
    var startedAt = Date.now();
    // מחשבים לכל כרטיס את רגע ההתחלה האבסולוטי (לפי שעון המכשיר) פעם אחת, מ-secondsUntil שהשרת חישב בשעון ישראל
    var targets = cards.map(function (card) {
      return startedAt + Number(card.getAttribute("data-seconds")) * 1000;
    });

    // אותו פורמט כמו formatCountdown בשרת (utils/minyanimLogic.js)
    function formatCountdown(secondsUntil) {
      if (secondsUntil < 0) return "התחיל לפני " + Math.max(1, Math.ceil(-secondsUntil / 60)) + " דק'";
      var totalMin = Math.ceil(secondsUntil / 60);
      if (totalMin <= 0 || secondsUntil < 30) return "מתחיל עכשיו";
      if (totalMin < 60) return "עוד " + totalMin + " דק'";
      var h = Math.floor(totalMin / 60);
      var m = totalMin % 60;
      var hours = h === 1 ? "שעה" : h + " שעות";
      return m ? "עוד " + hours + " ו-" + m + " דק'" : "עוד " + hours;
    }

    function tick() {
      var now = Date.now();
      cards.forEach(function (card, i) {
        var secondsUntil = Math.round((targets[i] - now) / 1000);
        var el = card.querySelector("[data-countdown]");
        if (secondsUntil < -300) {
          // עבר חלון החסד (5 דקות אחרי ההתחלה) - מעומעם
          card.classList.add("is-over");
          if (el) el.textContent = "המניין כבר התחיל";
        } else {
          card.classList.toggle("is-soon", secondsUntil >= 0 && secondsUntil <= 600); // עד 10 דקות - הדגשה
          if (el) el.textContent = formatCountdown(secondsUntil);
        }
      });
    }
    tick();
    setInterval(tick, 1000);

    // רענון כל 10 דקות רק בעמוד החיפוש (לא בטופס) - שומר על סדר ומרחקים נכונים
    setTimeout(function () { window.location.reload(); }, 10 * 60 * 1000);
  }
})();
