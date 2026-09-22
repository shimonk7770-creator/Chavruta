// server/controllers/adminController.js
// לוח בקרה למנהל מערכת - ריכוז כל הסטטיסטיקות במקום אחד (לפי בקשת המשתמש).
// שאילתות ספירה ישירות מול Firestore (getDb) - לא נדרש מודל ייעודי לכך, כי זה תצוגה-בלבד ולא CRUD על ישות חדשה.

const { getDb } = require("../config/db");

// GET /admin/dashboard - אדמין בלבד (isAdminUser middleware)
async function dashboard(req, res, next) {
  try {
    const db = getDb();
    const [usersSnap, groupsSnap, postsSnap, commentsSnap, messagesSnap, holidaysSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("groups").get(),
      db.collection("posts").where("isArchived", "==", false).get(),
      db.collection("comments").get(),
      db.collection("messages").get(),
      db.collection("holidays").get(),
    ]);

    const roleCounts = { member: 0, manager: 0, admin: 0 };
    let lockedCount = 0;
    let inactiveCount = 0;
    usersSnap.docs.forEach((doc) => {
      const u = doc.data();
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
      if (u.lockUntil && new Date(u.lockUntil) > new Date()) lockedCount++;
      if (!u.isActive) inactiveCount++;
    });

    res.render("admin/dashboard", {
      totals: {
        users: usersSnap.size,
        groups: groupsSnap.size,
        posts: postsSnap.size,
        comments: commentsSnap.size,
        messages: messagesSnap.size,
        holidays: holidaysSnap.size,
      },
      roleCounts,
      lockedCount,
      inactiveCount,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { dashboard };
