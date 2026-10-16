// server/models/Report.js
// דיווחי משתמשים על פוסטים/תגובות - שכבת גישה לנתונים ב-Firestore (collection: "reports").
// בכל דיווח נשמר "צילום מצב" של התוכן והכותב (snapshot), כדי שאדמין יראה מה דווח גם אם התוכן נמחק בינתיים.

const { getDb } = require("../config/db");

const COLLECTION = "reports";

function toReport(snap) {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}
function toMillis(v) {
  return v?.toDate ? v.toDate().getTime() : new Date(v).getTime();
}

async function create(data) {
  const db = getDb();
  const ref = await db.collection(COLLECTION).add({
    targetType: data.targetType, // "post" | "comment"
    targetId: data.targetId,
    groupId: data.groupId || "",
    groupName: data.groupName || "",
    reason: data.reason,
    details: data.details || "",
    reporterId: data.reporterId,
    reporterName: data.reporterName || "",
    snapshot: data.snapshot || { title: "", content: "", authorId: "", authorName: "" },
    status: "open", // open | removed | dismissed
    resolvedBy: "",
    createdAt: new Date(),
    resolvedAt: null,
  });
  return findById(ref.id);
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  return toReport(await db.collection(COLLECTION).doc(id).get());
}

// כל הדיווחים הפתוחים, מהחדש לישן
async function listOpen() {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("status", "==", "open").get();
  return snaps.docs.map(toReport).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

// האם המשתמש כבר דיווח על אותו תוכן ודיווחו עדיין פתוח (מניעת הצפה)
async function hasOpenReportBy(reporterId, targetType, targetId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("targetId", "==", targetId).get();
  return snaps.docs.some((d) => {
    const r = d.data();
    return r.reporterId === reporterId && r.targetType === targetType && r.status === "open";
  });
}

async function resolve(id, status, adminId) {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ status, resolvedBy: adminId, resolvedAt: new Date() });
  return findById(id);
}

// סוגר את כל הדיווחים הפתוחים על אותו תוכן (למשל אחרי שנמחק)
async function resolveAllForTarget(targetType, targetId, status, adminId) {
  const db = getDb();
  const snaps = await db.collection(COLLECTION).where("targetId", "==", targetId).get();
  const batch = db.batch();
  let n = 0;
  snaps.docs.forEach((d) => {
    const r = d.data();
    if (r.targetType === targetType && r.status === "open") {
      batch.update(d.ref, { status, resolvedBy: adminId, resolvedAt: new Date() });
      n++;
    }
  });
  if (n) await batch.commit();
  return n;
}

async function countOpen() {
  return (await listOpen()).length;
}

module.exports = { create, findById, listOpen, hasOpenReportBy, resolve, resolveAllForTarget, countOpen };
