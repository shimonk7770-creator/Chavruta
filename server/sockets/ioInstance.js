// server/sockets/ioInstance.js
// singleton קטן לגישה ל-instance של Socket.io ממקומות שהם לא server.js/chatSocket.js -
// למשל commentController.js, שהוא קונטרולר REST רגיל וצריך "לשדר" אירוע socket (התראת פעמון על תגובה חדשה)
// בלי שיש לו גישה ישירה לאובייקט io שנוצר ב-server.js.

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

module.exports = { setIo, getIo };
