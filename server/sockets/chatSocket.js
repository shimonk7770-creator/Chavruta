// server/sockets/chatSocket.js
// כל לוגיקת הצ'אט בזמן אמת (FR-021..FR-024) - Socket.io
// שים לב: ה-session (req.session) משותף בין Express ל-Socket.io דרך io.engine.use(sessionMiddleware)
// שמוגדר ב-server.js, ולכן socket.request.session מזהה את המשתמש המחובר בלי login נפרד ל-socket

const Group = require("../models/Group");
const Message = require("../models/Message");
const Notification = require("../models/Notification"); // התראות פעמון בזמן אמת
const { pickNotificationRecipients } = require("../utils/notificationRecipients");

// מי (userId) נמצא כרגע (active) בחדר צ'אט מסוים - נבדק לפי אילו sockets מחוברים ל-room הזה כרגע.
// נעזר בזה כדי לא "להציף" בהתראת פעמון מישהו שכבר צופה בהודעה החדשה בזמן אמת בתוך הצ'אט עצמו.
function getUserIdsInRoom(io, roomId) {
  const socketIds = io.sockets.adapter.rooms.get(roomId) || new Set();
  const userIds = new Set();
  socketIds.forEach((id) => {
    const s = io.sockets.sockets.get(id);
    const uid = s && s.request && s.request.session && s.request.session.userId;
    if (uid) userIds.add(uid);
  });
  return userIds;
}

module.exports = function initChatSocket(io) {
  io.on("connection", (socket) => {
    const session = socket.request.session;

    // אם אין session/userId - המשתמש לא מחובר (או ה-session פג) - מנתקים מיד, כמו isAuthenticated ב-Express
    if (!session || !session.userId) {
      socket.disconnect(true);
      return;
    }

    const userId = session.userId;
    const userName = session.userName;

    // "חדר" אישי לפי משתמש (לא לפי קבוצה) - זה מה שמאפשר לשדר לו התראת פעמון מכל עמוד באתר,
    // לא רק כשהוא בתוך חדר צ'אט ספציפי. כל socket שנפתח באתר (גם דרך notifications.js, לא רק chat.js)
    // עובר דרך אותו io.on("connection") הזה ולכן מצטרף אוטומטית ל-room האישי שלו.
    socket.join("user:" + userId);

    // FR-021: הצטרפות ל"חדר" הצ'אט של קבוצה מסוימת - כל קבוצה היא room נפרד לפי groupId,
    // כך שהודעות משודרות רק לחברי אותה קבוצה, לא לכל המחוברים לאתר
    socket.on("chat:join", async (groupId) => {
      try {
        const group = await Group.findById(groupId);
        if (!group || !group.members.includes(userId)) {
          socket.emit("chat:error", "אין לך הרשאה להצטרף לצ'אט של קבוצה זו");
          return;
        }
        socket.join(groupId);
        socket.currentGroupId = groupId; // שומרים לשימוש בבדיקת ההרשאה בהודעות/typing הבאים
      } catch (error) {
        console.error("שגיאה בהצטרפות לחדר צ'אט:", error.message);
        socket.emit("chat:error", "שגיאה בהתחברות לצ'אט");
      }
    });

    // FR-021: שליחת הודעה - נשמרת ב-Firestore ואז משודרת (broadcast) לכל חברי החדר, כולל השולח עצמו
    // (כך גם השולח רואה את ההודעה שלו באותו נתיב קוד בדיוק כמו כולם - פחות מקרי קצה בצד הלקוח)
    socket.on("chat:send", async ({ groupId, content }) => {
      try {
        if (socket.currentGroupId !== groupId) {
          socket.emit("chat:error", "יש להצטרף לחדר הצ'אט לפני שליחת הודעה");
          return;
        }
        const group = await Group.findById(groupId);
        if (!group || !group.members.includes(userId)) {
          socket.emit("chat:error", "אין לך הרשאה לשלוח הודעה בקבוצה זו");
          return;
        }

        const message = await Message.create({
          groupId,
          senderId: userId,
          senderName: userName,
          content,
        });

        io.to(groupId).emit("chat:message", message);

        // התראת פעמון: לכל חברי הקבוצה חוץ מהשולח וחוץ ממי שכבר נמצא (active) בחדר הצ'אט הזה כרגע
        const activeUserIds = getUserIdsInRoom(io, groupId);
        const recipients = pickNotificationRecipients(group.members, userId, activeUserIds);
        await Promise.all(
          recipients.map(async (recipientId) => {
            const notif = await Notification.create({
              userId: recipientId,
              type: "message",
              text: `${userName} שלח הודעה חדשה בקבוצת "${group.name}"`,
              link: `/groups/${groupId}/chat`,
            });
            io.to("user:" + recipientId).emit("notification:new", notif);
          })
        );
      } catch (error) {
        console.error("שגיאה בשליחת הודעת צ'אט:", error.message);
        socket.emit("chat:error", error.message || "שגיאה בשליחת ההודעה");
      }
    });

    // FR-023 (nice-to-have): מחוון "מקליד..." - לא נשמר ב-DB בכלל, רק broadcast חי לרגע נתון
    socket.on("chat:typing", (groupId) => {
      if (socket.currentGroupId !== groupId) return;
      socket.to(groupId).emit("chat:typing", { userName }); // socket.to (לא io.to) - לא חוזר לשולח עצמו
    });

    // FR-024: טיפול בניתוק - Socket.io דואג אוטומטית ל-reconnect בצד הלקוח (socket.io-client).
    // אין צורך בקוד ניקוי מיוחד כאן - הספרייה מסירה את ה-socket מכל ה-rooms אוטומטית עם הניתוק.
    // ברגע שהלקוח מתחבר מחדש, הוא שולח chat:join מחדש וקורא ל-REST fallback (chatController.chatHistorySince)
    // כדי להשלים הודעות שנשלחו בזמן שהיה מנותק - ראו server/public/js/chat.js
    socket.on("disconnect", () => {});
  });
};
