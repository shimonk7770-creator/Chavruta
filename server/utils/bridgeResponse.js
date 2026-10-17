// server/utils/bridgeResponse.js
// "גשר" התשובות של האפליקציה: אותם בקרים של האתר (שמרנדרים EJS או מבצעים redirect) מחזירים JSON כשהקריאה
// מגיעה מהאפליקציה (דרך /api/mobile/web/... עם טוקן). כך אין כפילות לוגיקה בין האתר לאפליקציה:
//  - res.render(view, data)  ->  { success, view, data }   (data = בדיוק מה שהאתר מציג, אחרי jsonSafe)
//  - res.redirect(url)       ->  { success, redirect, message }   (הודעת הצלחה/שגיאה נלקחת מפרמטרי ה-URL כמו באתר)
// הפונקציות כאן טהורות יחסית (מקבלות res) כדי שאפשר יהיה לבדוק אותן ב-server/test/bridgeResponse.test.js

const { jsonSafe } = require("./jsonSafe");

// מחלץ הודעה מ-URL של redirect: ?error= / ?memberError= הן שגיאות, ?message= היא הצלחה
function parseRedirectOutcome(url) {
  const text = String(url || "");
  const queryIndex = text.indexOf("?");
  if (queryIndex === -1) return { success: true, message: "" };
  const params = new URLSearchParams(text.slice(queryIndex + 1));
  const errorText = params.get("error") || params.get("memberError");
  if (errorText) return { success: false, message: errorText };
  return { success: true, message: params.get("message") || "" };
}

// מי המשתמש המחובר - מקביל ל-res.locals (isLoggedIn/userRole/userId) שהתבניות של האתר מקבלות ב-server.js
function describeMe(req) {
  const session = (req && req.session) || {};
  return {
    isLoggedIn: !!session.userId,
    userId: session.userId || null,
    userRole: session.userRole || null,
    userName: session.userName || null,
  };
}

function adaptResponse(res, req) {
  res.render = function bridgeRender(view, data, callback) {
    let payload = data;
    if (typeof data === "function") {
      callback = data;
      payload = {};
    }
    payload = payload || {};
    const safe = jsonSafe(payload);
    const errorText = typeof safe.error === "string" && safe.error ? safe.error : "";
    const successText = typeof safe.success === "string" ? safe.success : "";
    // טפסים שמוצגים מחדש עם הודעת שגיאה (ולידציה) הופכים לתשובת 400 עם הודעה - כך האפליקציה יודעת להציג אותה
    if (errorText) {
      return res.status(res.statusCode === 200 ? 400 : res.statusCode).json({ success: false, message: errorText, view, data: safe });
    }
    const body = { success: true, view, data: safe, me: describeMe(req) };
    if (successText) body.message = successText;
    return res.json(body);
  };

  res.redirect = function bridgeRedirect(a, b) {
    const url = typeof a === "number" ? b : a;
    const outcome = parseRedirectOutcome(url);
    if (!outcome.success) return res.status(400).json({ success: false, message: outcome.message, redirect: url });
    return res.json({ success: true, redirect: url, message: outcome.message });
  };
  return res;
}

module.exports = { adaptResponse, parseRedirectOutcome };
