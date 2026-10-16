// server/seed/seed.js
// סקריפט אתחול נתוני דמו - "npm run seed"
// ממלא את המערכת במידע ריאליסטי כדי שתדמה קהילה פעילה אמיתית (סעיף 23 בדרישות)
// ניתן להרצה חוזרת בלי ליצור כפילויות (NFR-012) - מוחק ומכניס מחדש בכל הרצה
// עובד מול Firestore (Firebase) ולא מול MongoDB

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, getDb } = require("../config/db");

// מוחק את כל המסמכים באוסף נתון - Firestore אין לו deleteMany() מובנה כמו Mongo,
// לכן שולפים את כל המזהים ומוחקים ב-batch (יעיל יותר ממחיקה אחת-אחת)
async function clearCollection(db, name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function seed() {
  connectDB();
  const db = getDb();
  console.log("מחובר ל-Firestore - מתחיל זריעת נתונים...");

  // ניקוי נתונים קיימים כדי שההרצה תהיה נקייה וללא כפילויות (NFR-012)
  await Promise.all(
    ["users", "groups", "posts", "comments", "holidays", "minyanim"].map((col) => clearCollection(db, col))
  );

  const passwordHash = await bcrypt.hash("Password1", 10); // סיסמה אחידה לכל משתמשי הדמו
  const now = new Date();

  const usersData = [
    { fullName: "יוסי כהן", username: "yossi_c", email: "yossi@example.com", role: "admin" },
    { fullName: "הרב דוד לוי", username: "rav_david", email: "david@example.com", role: "manager" },
    { fullName: "מירי אברהם", username: "miri_a", email: "miri@example.com", role: "manager" },
    { fullName: "שרה מזרחי", username: "sara_m", email: "sara@example.com", role: "member" },
    { fullName: "אבי פרץ", username: "avi_p", email: "avi@example.com", role: "member" },
    { fullName: "נעמה גולן", username: "naama_g", email: "naama@example.com", role: "member" },
    { fullName: "משה בן-דוד", username: "moshe_bd", email: "moshe@example.com", role: "member" },
    { fullName: "רחל שמעוני", username: "rachel_s", email: "rachel@example.com", role: "member" },
  ];

  const userIds = {};
  for (const u of usersData) {
    const ref = await db.collection("users").add({
      ...u,
      passwordHash,
      avatarUrl: "",
      bio: "",
      isActive: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      createdAt: now,
      updatedAt: now,
    });
    userIds[u.username] = ref.id;
  }
  const admin = userIds.yossi_c;
  const ravDavid = userIds.rav_david;
  const miri = userIds.miri_a;
  const sara = userIds.sara_m;
  const avi = userIds.avi_p;
  const naama = userIds.naama_g;
  const moshe = userIds.moshe_bd;
  const rachel = userIds.rachel_s;

  // עדכון (משוב המרצה): במקום קבוצות מפוזרות - שישה מדורים קבועים של "בית חב״ד" (server/utils/chabadSections.js).
  // כל מדור נשמר תחת מזהה קבוע (section_<key>) בדיוק כמו Group.ensureSections, כך שהזריעה והשרת מסכימים ביניהם.
  const sectionMembers = {
    tanya: { managerId: ravDavid, managerName: "הרב דוד לוי", members: [ravDavid, avi, moshe] },
    minyan: { managerId: ravDavid, managerName: "הרב דוד לוי", members: [ravDavid, avi, moshe, admin] },
    torah: { managerId: ravDavid, managerName: "הרב דוד לוי", members: [ravDavid, avi, moshe] },
    women: { managerId: miri, managerName: "מירי אברהם", members: [miri, sara, naama, rachel] },
    lostfound: { managerId: admin, managerName: "יוסי כהן", members: [admin, rachel, sara] },
    kodesh: { managerId: admin, managerName: "יוסי כהן", members: [admin, naama, moshe] },
  };

  const groupIds = {};
  for (const def of SECTIONS) {
    const extra = sectionMembers[def.key];
    const id = sectionDocId(def.key);
    await db.collection("groups").doc(id).set({
      name: def.name,
      description: def.description,
      category: def.category,
      topic: def.topic,
      dayOfWeek: "",
      time: "",
      level: "",
      sectionKey: def.key,
      groupPhotoUrl: "",
      ...extra,
      createdAt: now,
      updatedAt: now,
    });
    groupIds[def.key] = id;
  }
  const groupsData = SECTIONS; // לשורת הסיכום בסוף הסקריפט

  const postsData = [
    {
      title: "חידוש בסוגיה של השבוע",
      content: "רציתי לשתף חידוש קטן שעלה לי בלימוד היום...",
      category: "dvarTorah",
      groupId: groupIds.torah,
      groupName: "שיעורי תורה",
      authorId: ravDavid,
      authorName: "הרב דוד לוי",
    },
    {
      title: "שאלה על הדף",
      content: "מישהו יכול להסביר לי את הנקודה השנייה בסוגיה?",
      category: "question",
      groupId: groupIds.torah,
      groupName: "שיעורי תורה",
      authorId: sara,
      authorName: "שרה מזרחי",
    },
    {
      title: "עדכון: השיעור השבוע יתקיים באיחור קל",
      content: "השיעור יתחיל ב-20:30 במקום 20:00",
      category: "update",
      groupId: groupIds.torah,
      groupName: "שיעורי תורה",
      authorId: ravDavid,
      authorName: "הרב דוד לוי",
    },
    {
      title: "דבר תורה לפרשת השבוע",
      content: "הפעם נתמקד בקשר שבין הפרשה לחיי היום-יום שלנו...",
      category: "dvarTorah",
      groupId: groupIds.women,
      groupName: "שיעורים לנשים",
      authorId: miri,
      authorName: "מירי אברהם",
    },
    {
      title: "מוסרת סידורים וחומשים ישנים",
      content: "יש לי כמה סידורים וחומשים במצב טוב שאשמח למסור למי שצריך, מי מעוניין?",
      category: "update",
      groupId: groupIds.kodesh,
      groupName: "מסירת מוצרי קדושה",
      authorId: admin,
      authorName: "יוסי כהן",
    },
  ];

  // פוסטים נוספים לשאר המדורים (נוספו בסוף המערך כדי לא לשבש את אינדקסי התגובות שמתחת)
  postsData.push(
    {
      title: "שיעור התניא של הבוקר",
      content: "השיעור היום עוסק באגרת התשובה, פרק ראשון. מוזמנים להצטרף ולשאול.",
      category: "update",
      groupId: groupIds.tanya,
      groupName: "שיעור תניא",
      authorId: ravDavid,
      authorName: "הרב דוד לוי",
    },
    {
      title: "חסר אחד למניין מנחה",
      content: "חסר עשירי למניין של מנחה היום ב-13:45, מי יכול להגיע?",
      category: "update",
      groupId: groupIds.minyan,
      groupName: "מניין",
      authorId: avi,
      authorName: "אבי פרץ",
    },
    {
      title: "נמצאו מפתחות ליד בית הכנסת",
      content: "נמצא צרור מפתחות עם מחזיק כחול ליד הכניסה. אפשר לאסוף אצלי.",
      category: "update",
      groupId: groupIds.lostfound,
      groupName: "אבדות ומציאות",
      authorId: rachel,
      authorName: "רחל שמעוני",
    }
  );

  const postIds = [];
  for (const p of postsData) {
    const ref = await db.collection("posts").add({ ...p, videoUrl: "", isArchived: false, createdAt: now, updatedAt: now });
    postIds.push(ref.id);
  }

  const commentsData = [
    { postId: postIds[0], authorId: sara, authorName: "שרה מזרחי", content: "חידוש יפה מאוד, תודה!" },
    { postId: postIds[0], authorId: avi, authorName: "אבי פרץ", content: "מעניין, לא חשבתי על זה כך" },
    { postId: postIds[1], authorId: moshe, authorName: "משה בן-דוד", content: "אני חושב שהתשובה היא..." },
    { postId: postIds[3], authorId: rachel, authorName: "רחל שמעוני", content: "תודה על השיתוף, מחכה לשיעור" },
    { postId: postIds[4], authorId: naama, authorName: "נעמה גולן", content: "אני יכולה לתרום, אשלח פרטים בהודעה" },
  ];
  for (const c of commentsData) {
    await db.collection("comments").add({ ...c, isArchived: false, createdAt: now });
  }

  // "מעגל השנה" - FR-028/FR-029: מאמרי חג לדוגמה, ממוינים ב-order לפי סדר השנה העברית (תשרי -> ניסן).
  // עדכון (משוב המשתמש): "המועד הקרוב" כבר לא מסומן ידנית (isFeatured הוסר) - הוא מחושב אוטומטית
  // בקונטרולר לפי gregorianDate הקרוב ביותר שעוד לא עבר (ראו holidayController.findUpcomingHoliday).
  // עדכון נוסף: נוספו חנוכה ופורים שהיו חסרים לגמרי מהלוח.
  const holidaysData = [
    {
      holidayName: "ראש השנה",
      dateHint: "א'-ב' תשרי",
      gregorianDate: "2026-09-12", // תשפ"ז - יום ראשון של החג (מקור: hebcal.com)
      whatWeDo: "תוקעים בשופר, אוכלים תפוח בדבש וסימנים נוספים לשנה טובה ומתוקה.",
      whatWePray: "תפילות מיוחדות הכוללות מלכויות, זכרונות ושופרות.",
      customs: "שולחים ברכות \"שנה טובה\", עורכים תשליך ליד מקור מים.",
      order: 1,
      authorId: admin,
    },
    {
      holidayName: "יום כיפור",
      dateHint: "י' תשרי",
      gregorianDate: "2026-09-21", // תשפ"ז (מקור: hebcal.com)
      whatWeDo: "צמים כ-25 שעות, נמנעים מרחיצה ונעילת נעלי עור.",
      whatWePray: "כל היום בבית הכנסת - כולל כל נדרי, נעילה ותפילת יזכור.",
      customs: "מבקשים ומעניקים סליחה, לובשים לבן.",
      order: 2,
      authorId: admin,
    },
    {
      holidayName: "סוכות",
      dateHint: "ט\"ו-כ\"ב תשרי",
      gregorianDate: "2026-09-26", // תשפ"ז - יום ראשון של החג (מקור: hebcal.com)
      whatWeDo: "אוכלים (ולעיתים גם ישנים) בסוכה, נוטלים לולב ואתרוג.",
      whatWePray: "הלל בכל ימי החג, הקפות עם ארבעת המינים.",
      customs: "מקשטים את הסוכה, מארחים אושפיזין.",
      order: 3,
      authorId: admin,
      linkedGroupId: groupIds.torah,
    },
    {
      holidayName: "חנוכה",
      dateHint: "כ\"ה כסלו - ג' טבת (שמונה ימים)",
      gregorianDate: "2026-12-05", // תשפ"ז - יום ראשון של החג (מקור: hebcal.com)
      whatWeDo: "מדליקים נרות חנוכה בכל אחד משמונת לילות החג (נר נוסף בכל לילה), אוכלים מאכלים מטוגנים בשמן כמו סופגניות ולביבות, ומשחקים בסביבון.",
      whatWePray: "אומרים \"הלל\" ו\"על הנסים\" בתפילה ובברכת המזון, לציון נס פך השמן ונצחון המכבים.",
      customs: "מדליקים בפתח הבית או בחלון לפרסום הנס, מתנות חנוכה לילדים, משחקי סביבון עם \"דמי חנוכה\".",
      order: 4,
      authorId: admin,
    },
    {
      holidayName: "פורים",
      dateHint: "י\"ד אדר",
      gregorianDate: "2027-03-23", // תשפ"ז (מקור: hebcal.com)
      whatWeDo: "קוראים את מגילת אסתר בלילה וביום, מתחפשים, עורכים סעודת פורים חגיגית.",
      whatWePray: "קריאת המגילה פעמיים (ערבית ושחרית) היא עיקר מצוות היום.",
      customs: "משלוח מנות לחברים, מתנות לאביונים (צדקה), תחפושות, רעשנים בזמן הזכרת שם המן.",
      order: 5,
      authorId: admin,
    },
    {
      holidayName: "פסח",
      dateHint: "ט\"ו-כ\"ב ניסן",
      gregorianDate: "2027-04-22", // תשפ"ז - יום ראשון של החג (מקור: hebcal.com)
      whatWeDo: "עורכים סדר פסח, אוכלים מצה ונמנעים מחמץ כל החג.",
      whatWePray: "הלל בליל הסדר, תפילת טל ביום הראשון.",
      customs: "קוראים את ההגדה, מחפשים חמץ בליל שלפני החג (בדיקת חמץ).",
      order: 6,
      authorId: admin,
    },
  ];
  for (const h of holidaysData) {
    await db.collection("holidays").add({ ...h, createdAt: now, updatedAt: now });
  }

  // "מניינים" (קטגוריית /minyanim) - נתוני דמו להצגה בלבד (isDemo=true, מוצגים עם תג "דמו"): שמות בתי כנסת כלליים
  // ושעות לדוגמה, בשכונות/ערים אמיתיות (קואורדינטות מקורבות של מרכז השכונה). משתמשים אמיתיים מוסיפים מניינים אמיתיים בעצמם.
  // לכל תפילה יש מגוון שעות, כך שבכל שעה ביממה יש לפחות כמה מניינים "קרובים" להדגמה.
  const WEEKDAYS = [0, 1, 2, 3, 4]; // ראשון-חמישי
  const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
  const SUN_FRI = [0, 1, 2, 3, 4, 5];
  // [שם, עיר (מפתח), שכונה/רחוב להצגה, lat, lng, נוסח]
  const shuls = [
    ["בית כנסת שערי תפילה", "jerusalem", "רחוב מלכי ישראל, גאולה", 31.7898, 35.2195, "ashkenaz"],
    ["בית כנסת אהבת שלום", "jerusalem", "רחוב בן מימון, רחביה", 31.7747, 35.213, "any"],
    ["בית כנסת היכל התורה", "jerusalem", "רחוב הרב קוק, קריית משה", 31.7889, 35.1985, "ashkenaz"],
    ["בית כנסת נווה שלום", "jerusalem", "הר נוף", 31.7835, 35.175, "sefard"],
    ["בית כנסת ישורון", "jerusalem", "רמות", 31.8165, 35.1965, "any"],
    ["בית כנסת אורות המזרח", "jerusalem", "קטמון", 31.7595, 35.2105, "edot"],
    ["בית כנסת כנסת ישראל", "jerusalem", "תלפיות", 31.744, 35.223, "any"],
    ["בית כנסת מרכז העיר", "tel-aviv", "רחוב אלנבי", 32.0668, 34.7704, "any"],
    ["בית כנסת בית יעקב", "tel-aviv", "הצפון הישן", 32.0905, 34.7826, "ashkenaz"],
    ["בית כנסת שערי ציון", "bnei-brak", "רחוב רבי עקיבא", 32.0839, 34.8335, "ashkenaz"],
    ["בית כנסת הגר\"א", "bnei-brak", "שכונת פרדס כץ", 32.0905, 34.8412, "sefard"],
    ["בית כנסת נחלת אבות", "beit-shemesh", "רמת בית שמש", 31.7345, 34.9785, "any"],
    ["בית כנסת אהל משה", "haifa", "הדר הכרמל", 32.8100, 34.9990, "any"],
    ["בית כנסת בית אל", "netanya", "מרכז העיר", 32.3300, 34.8570, "any"],
  ];
  // [אינדקס בית כנסת, תפילה, שעה, ימים]
  const minyanSlots = [
    [0, "shacharit", "06:00", SUN_FRI], [0, "shacharit", "07:30", ALL_WEEK], [0, "mincha", "13:30", WEEKDAYS], [0, "arvit", "19:15", WEEKDAYS],
    [1, "shacharit", "06:45", WEEKDAYS], [1, "mincha", "14:00", WEEKDAYS], [1, "arvit", "20:00", WEEKDAYS],
    [2, "shacharit", "05:40", SUN_FRI], [2, "shacharit", "08:15", WEEKDAYS], [2, "arvit", "20:30", WEEKDAYS],
    [3, "shacharit", "06:15", WEEKDAYS], [3, "mincha", "17:30", WEEKDAYS], [3, "arvit", "18:45", WEEKDAYS], [3, "arvit", "21:15", WEEKDAYS],
    [4, "shacharit", "07:00", WEEKDAYS], [4, "mincha", "16:00", ALL_WEEK], [4, "arvit", "22:00", WEEKDAYS],
    [5, "shacharit", "06:30", WEEKDAYS], [5, "mincha", "13:15", WEEKDAYS], [5, "arvit", "19:45", WEEKDAYS],
    [6, "shacharit", "09:00", WEEKDAYS], [6, "mincha", "14:30", WEEKDAYS], [6, "arvit", "20:15", WEEKDAYS],
    [7, "shacharit", "06:00", SUN_FRI], [7, "mincha", "13:45", WEEKDAYS], [7, "arvit", "19:00", WEEKDAYS],
    [8, "shacharit", "07:15", WEEKDAYS], [8, "arvit", "20:00", WEEKDAYS],
    [9, "shacharit", "05:45", SUN_FRI], [9, "mincha", "14:15", WEEKDAYS], [9, "arvit", "21:00", WEEKDAYS],
    [10, "shacharit", "06:20", WEEKDAYS], [10, "arvit", "19:30", WEEKDAYS],
    [11, "shacharit", "06:50", WEEKDAYS], [11, "mincha", "17:45", WEEKDAYS], [11, "arvit", "20:45", WEEKDAYS],
    [12, "shacharit", "07:10", WEEKDAYS], [12, "arvit", "19:50", WEEKDAYS],
    [13, "mincha", "14:00", WEEKDAYS], [13, "arvit", "20:10", WEEKDAYS],
  ];
  const cityLabels = { jerusalem: "ירושלים", "tel-aviv": "תל אביב-יפו", "bnei-brak": "בני ברק", "beit-shemesh": "בית שמש", haifa: "חיפה", netanya: "נתניה" };
  for (const [idx, prayer, time, days] of minyanSlots) {
    const [name, city, address, lat, lng, nusach] = shuls[idx];
    await db.collection("minyanim").add({
      synagogueName: name,
      prayer,
      time,
      days,
      nusach,
      city,
      cityLabel: cityLabels[city],
      address,
      notes: "",
      lat,
      lng,
      locationPrecision: "address",
      isDemo: true,
      createdBy: admin,
      createdByName: "יוסי כהן",
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(
    `נזרעו בהצלחה: ${usersData.length} משתמשים, ${groupsData.length} מדורי בית חב״ד, ${postsData.length} פוסטים, ${commentsData.length} תגובות, ${holidaysData.length} מאמרי מעגל השנה, ${minyanSlots.length} מניינים (דמו)`
  );
  console.log("סיסמה לכל משתמשי הדמו: Password1");
  process.exit(0);
}

seed().catch((error) => {
  console.error("שגיאה בזריעת נתונים:", error);
  process.exit(1);
});
