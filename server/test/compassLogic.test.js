// server/test/compassLogic.test.js
// בדיקות לחישוב כיוון התפילה (server/utils/compassLogic.js). הערכים הצפויים נבדקו מול ידע גאוגרפי:
// מתל אביב ירושלים נמצאת דרום-מזרחה (~128.5°: כ-43 ק"מ מזרחה ו-34 ק"מ דרומה), מניו יורק צפון-מזרחה (~54°; מעגל גדול עובר
// דרך צפון האוקיינוס), מלונדון - מזרח-דרום-מזרח (~114°), מאילת - כמעט צפונה (~6°).

const test = require("node:test");
const assert = require("node:assert");
const C = require("../utils/compassLogic");

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ""} התקבל ${actual}, ציפינו ל-${expected}±${tol}`);

test("initialBearing: כיוונים מרכזיים (צפון/מזרח/דרום/מערב)", () => {
  const o = { lat: 0, lng: 0 };
  near(C.initialBearing(o, { lat: 10, lng: 0 }), 0, 0.001, "צפון");
  near(C.initialBearing(o, { lat: 0, lng: 10 }), 90, 0.001, "מזרח");
  near(C.initialBearing(o, { lat: -10, lng: 0 }), 180, 0.001, "דרום");
  near(C.initialBearing(o, { lat: 0, lng: -10 }), 270, 0.001, "מערב");
});

test("prayerDirection: כיוון ירושלים מערים בעולם", () => {
  near(C.prayerDirection({ lat: 32.0853, lng: 34.7818 }).bearing, 128.5, 2, "תל אביב"); // 43 ק"מ מזרחה ו-34 ק"מ דרומה => ~128.6°
  near(C.prayerDirection({ lat: 40.7128, lng: -74.006 }).bearing, 55, 5, "ניו יורק");
  near(C.prayerDirection({ lat: 51.5074, lng: -0.1278 }).bearing, 114, 4, "לונדון");
  near(C.prayerDirection({ lat: 29.5581, lng: 34.9482 }).bearing, 6.3, 3, "אילת - ירושלים צפונה");
  near(C.prayerDirection({ lat: 32.794, lng: 34.9896 }).bearing, 168, 3, "חיפה - ירושלים דרום-דרום-מזרח");
});

test("prayerDirection: מרחק נכון ושם כיוון בעברית", () => {
  const tlv = C.prayerDirection({ lat: 32.0853, lng: 34.7818 });
  near(tlv.distanceKm, 54, 2, "מרחק תל אביב");
  assert.strictEqual(tlv.pointHe, "דרום-מזרח");
  assert.strictEqual(tlv.isAtTarget, false);
});

test("prayerDirection: ליד הר הבית - 'אתם כאן'", () => {
  const here = C.prayerDirection({ lat: C.TEMPLE_MOUNT.lat, lng: C.TEMPLE_MOUNT.lng });
  assert.strictEqual(here.isAtTarget, true);
});

test("normalizeDegrees / shortestAngleDelta: מעבר דרך 0/360 בלי סיבוב מלא", () => {
  assert.strictEqual(C.normalizeDegrees(-10), 350);
  assert.strictEqual(C.normalizeDegrees(370), 10);
  assert.strictEqual(C.shortestAngleDelta(359, 1), 2);
  assert.strictEqual(C.shortestAngleDelta(1, 359), -2);
  assert.strictEqual(C.shortestAngleDelta(90, 90), 0);
});

test("needleAngle: המחוג מצביע לירושלים יחסית לכיוון המכשיר", () => {
  assert.strictEqual(C.needleAngle(110, 0), 110); // המכשיר פונה צפונה -> המחוג 110° ימינה
  assert.strictEqual(C.needleAngle(110, 110), 0); // המכשיר פונה בדיוק לירושלים -> המחוג ישר למעלה
  assert.strictEqual(C.needleAngle(10, 350), 20);
});

test("compassPointHe: מעגל שלם", () => {
  assert.strictEqual(C.compassPointHe(0), "צפון");
  assert.strictEqual(C.compassPointHe(359), "צפון");
  assert.strictEqual(C.compassPointHe(90), "מזרח");
  assert.strictEqual(C.compassPointHe(180), "דרום");
  assert.strictEqual(C.compassPointHe(270), "מערב");
});
