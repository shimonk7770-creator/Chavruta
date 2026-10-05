// server/test/shabbatTimes.test.js
// בדיקות אוטומטיות (node:test) לעטיפת @hebcal/core - כרטיס "זמני שבת" בדף הבית.
// isValidCityKey/getCityOptions הן פונקציות סינכרוניות טהורות - נבדקות ישירות.
// getUpcomingShabbat היא אסינכרונית (טוענת את @hebcal/core עם import() דינמי) אבל עדיין לא תלויה
// ברשת - כל החישוב האסטרונומי נעשה מקומית מתוך הקואורדינטות, ולכן ניתן לבדוק אותה כמו כל בדיקה אחרת.

const { test, describe } = require("node:test");
const assert = require("node:assert");
const { getUpcomingShabbat, isValidCityKey, getCityOptions, DEFAULT_CITY_KEY } = require("../utils/shabbatTimes");

describe("getCityOptions / isValidCityKey", () => {
  test("מחזירה רשימת ערים לא ריקה, עם key ו-label לכל אחת", () => {
    const options = getCityOptions();
    assert.ok(options.length > 0);
    for (const opt of options) {
      assert.ok(opt.key);
      assert.ok(opt.label);
    }
  });

  test("עיר ברירת המחדל נמצאת ברשימת האפשרויות", () => {
    const options = getCityOptions();
    assert.ok(options.some((opt) => opt.key === DEFAULT_CITY_KEY));
  });

  test("isValidCityKey מזהה מפתח קיים ודוחה מפתח לא קיים/ריק", () => {
    assert.strictEqual(isValidCityKey("jerusalem"), true);
    assert.strictEqual(isValidCityKey("tel-aviv"), true);
    assert.strictEqual(isValidCityKey("nonsense-city"), false);
    assert.strictEqual(isValidCityKey(""), false);
    assert.strictEqual(isValidCityKey(undefined), false);
  });
});

describe("getUpcomingShabbat", () => {
  test("מחזירה שם עיר בעברית וזמני הדלקת נרות/הבדלה בפורמט שעה:דקה עבור עיר תקינה", async () => {
    const result = await getUpcomingShabbat("jerusalem");
    assert.ok(result);
    assert.strictEqual(result.cityHe, "ירושלים");
    assert.match(result.candleLighting, /^\d{1,2}:\d{2}$/);
    assert.match(result.havdalah, /^\d{1,2}:\d{2}$/);
    assert.ok(Array.isArray(result.upcoming));
  });

  test("נופלת בחזרה לעיר ברירת המחדל עבור מפתח לא מוכר, ולא זורקת שגיאה", async () => {
    const result = await getUpcomingShabbat("totally-invalid-key");
    assert.ok(result);
    assert.strictEqual(result.cityHe, "ירושלים");
  });

  test("ללא פרמטר כלל - עדיין מחזירה תוצאה תקינה (ברירת מחדל)", async () => {
    const result = await getUpcomingShabbat();
    assert.ok(result);
    assert.ok(result.candleLighting);
  });

  test("ערים שונות מחזירות אובייקט Location שונה (שם עיר שונה)", async () => {
    const jlm = await getUpcomingShabbat("jerusalem");
    const tlv = await getUpcomingShabbat("tel-aviv");
    assert.notStrictEqual(jlm.cityHe, tlv.cityHe);
  });
});
