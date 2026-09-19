// server/public/js/pwaRegister.js
// רישום ה-Service Worker - זה מה שהופך את האתר לזמין ל"התקנה" כאפליקציה (PWA) בדפדפנים תומכים.
// שים לב: service worker עובד גם מעל HTTP רגיל (לא רק HTTPS) כאשר האתר רץ על localhost - זה חריג מכוון
// של הדפדפנים לצורך פיתוח מקומי, ולכן זה יעבוד מיד ב-http://localhost:3000 בלי הגדרה נוספת.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js").catch(function (err) {
      console.warn("רישום Service Worker נכשל (לא קריטי לפעילות האתר):", err);
    });
  });
}
