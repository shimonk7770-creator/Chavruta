// server/public/service-worker.js
// Service Worker בסיסי - הופך את האתר לניתן ל"התקנה" (PWA) בדפדפנים תומכים (Chrome/Edge).
// אסטרטגיה: Network First - תמיד מנסים קודם למשוך מהרשת (כדי שמשתמש לא יראה תוכן ישן בטעות
// באתר שמתעדכן הרבה), ורק אם אין רשת בכלל, נופלים חזרה למטמון - חוויית "offline" בסיסית
// במקום מסך שגיאה לבן של הדפדפן.

const CACHE_NAME = "chavruta-cache-v1";
const APP_SHELL = ["/", "/css/style.css", "/manifest.json"];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", function (event) {
  // מנקים גרסאות מטמון ישנות מהתקנות קודמות של ה-Service Worker
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  // נוגעים רק בבקשות GET לאותו מקור - לא בבקשות API/POST ולא בתעבורת Socket.io (WebSocket)
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});
