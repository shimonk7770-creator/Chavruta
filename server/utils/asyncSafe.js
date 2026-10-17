// server/utils/asyncSafe.js
// Express 4 לא תופס שגיאות של פונקציות async: אם בקר async זורק שגיאה, הבקשה "נתקעת" ולא מגיעה לשגיאה גלובלית.
// הפונקציה הזו עוברת על כל הנתיבים של Router ועוטפת כל handler כך שדחייה של Promise מועברת ל-next(err),
// ואז errorHandler.js מחזיר שגיאה מסודרת (HTML באתר / JSON באפליקציה). מחיל פעם אחת על כל ה-routers ב-server.js.

function wrapHandler(handle) {
  if (typeof handle !== "function" || handle.length >= 4 || handle.__asyncSafe) return handle; // error-handlers (4 פרמטרים) לא נוגעים
  function safeHandler(req, res, next) {
    try {
      const result = handle(req, res, next);
      if (result && typeof result.catch === "function") result.catch(next);
    } catch (error) {
      next(error);
    }
  }
  safeHandler.__asyncSafe = true;
  return safeHandler;
}

function makeRouterAsyncSafe(router) {
  (router.stack || []).forEach((layer) => {
    if (layer.route) {
      layer.route.stack.forEach((routeLayer) => {
        routeLayer.handle = wrapHandler(routeLayer.handle);
      });
    }
  });
  return router;
}

module.exports = { wrapHandler, makeRouterAsyncSafe };
