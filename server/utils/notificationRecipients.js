// server/utils/notificationRecipients.js
// פונקציה טהורה (בלי תלות ב-DB/Socket.io) שקובעת למי מחברי הקבוצה לשלוח התראת פעמון על הודעת צ'אט חדשה:
// לא לשולח עצמו, ולא למי שכרגע כבר נמצא (active) באותו חדר צ'אט ורואה את ההודעה החדשה בזמן אמת ממילא -
// כך שהפעמון לא "מציף" בהתראות מיותרות מישהו שכבר צופה בשיחה.

function pickNotificationRecipients(members, senderId, activeUserIds) {
  const active = activeUserIds instanceof Set ? activeUserIds : new Set(activeUserIds || []);
  return (members || []).filter((id) => id !== senderId && !active.has(id));
}

module.exports = { pickNotificationRecipients };
