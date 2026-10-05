# חברותא - מעקב משימות ודרישות לפי שבועות

> **עדכון חשוב**: המערכת עברה ממסד נתונים MongoDB ל-**Firebase Firestore**, לפי המלצת המרצה בקורס.
> כל שכבת המודלים (server/models) נכתבה מחדש לעבוד מול Firestore. הפונקציונליות והדרישות (FR/NFR/BR) לא השתנו -
> רק הטכנולוגיה שמיישמת אותן. פירוט טכני ב-README.md.

> מסמך זה ממפה כל דרישה מתוך ה-SRS (FR/NFR/BR) למשימת פיתוח קונקרטית, לפי שבוע.
> מסומן [x] = הושלם ונבדק, [~] = הושלם חלקית, [ ] = טרם בוצע.
> המסמך מתעדכן ונשמר ב-git לאורך כל הפרויקט.

---

## שבוע 1 - שלד ותשתית (הושלם)

- [x] FR-001 הרשמת משתמש (ולידציה, בדיקת ייחודיות, bcrypt, session)
- [x] FR-002 התחברות (עם נעילת חשבון לאחר 5 כשלונות - BR-010)
- [x] FR-003 יציאה (Logout)
- [x] FR-004 עריכת פרופיל אישי (שם, ביוגרפיה, אווטאר, שינוי סיסמה עם אימות סיסמה נוכחית)
- [x] FR-005 מחיקת חשבון (soft delete - isActive:false, חסימת התחברות לחשבון מחוק)
- [x] NFR-003 הצפנת סיסמאות (bcryptjs, select:false בסכמה)
- [x] NFR-004 middleware הרשאה (isAuthenticated, hasRole)
- [x] NFR-005 session עם תפוגה (connect-mongo + maxAge)
- [x] NFR-008 קובץ .env לא נכלל ב-git (.gitignore מהקומיט הראשון)
- [x] CSS3: text-shadow, transition, border-radius, multiple-columns, font-face (בסיסי)
- [x] jQuery/Ajax: בדיקת זמינות שם משתמש בזמן אמת

## שבוע 2 - קבוצות, פוסטים, תגובות, הרשאות (הושלם)

- [x] FR-006 יצירת קבוצה (מנהל/אדמין בלבד)
- [x] FR-007 עריכת קבוצה (מנהל הקבוצה הספציפית בלבד)
- [x] FR-008 מחיקת קבוצה (עם ארכוב מדורג - BR-011)
- [x] FR-009 הצטרפות/עזיבת קבוצה (מניעת הצטרפות כפולה - BR-005)
- [x] FR-010 רשימת/עיון בקבוצות
- [x] FR-011 חיפוש קבוצות (topic + dayOfWeek + level - 3 פרמטרים)
- [x] FR-012 חיפוש פוסטים ($text + pagination)
- [x] FR-013 יצירת פוסט (בדיקת חברות בקבוצה - BR-004)
- [x] FR-014 עריכה/מחיקת פוסט (הבעלים או מנהל הקבוצה בלבד)
- [x] FR-015 הוספת תגובה (jQuery/Ajax ללא רענון עמוד)
- [~] FR-016 עריכה/מחיקת תגובה - **מחיקה בוצעה, עריכה טרם בוצעה**
- [x] FR-017 פיד אישי (כל הקבוצות שהמשתמש חבר בהן, עם pagination ומצב ריק ידידותי)
- [x] middleware הרשאות פר-רשומה: isGroupManagerOf, canModifyPost, canModifyComment (RBAC אמיתי בצד שרת - סעיף 12.1)
- [x] seed script לנתוני דמו (8 משתמשים, 3 קבוצות, 5 פוסטים, 5 תגובות)
- [x] עיצוב מחדש: פלטת צבעים, גופנים, ניווט מחולק לקטגוריות, Hero + איורי SVG

### פערים שנסגרו (עודכן)
- [x] FR-004, FR-005 (עריכת פרופיל, מחיקת חשבון) - עמוד /profile חדש
- [x] FR-014 (עריכת פוסט - טופס /posts/:id/edit + קישורי עריכה/מחיקה בעמוד קבוצה)
- [x] FR-017 (פיד אישי - עמוד /feed חדש + קישור בתפריט)
- [x] NFR-006 סניטציית קלט נגד XSS - נוספה חבילת sanitize-html, מיושמת בפוסטים, תגובות ופרופיל (ביוגרפיה)

### פערים שנותרו
- [ ] FR-016 עריכת תגובה (יש כרגע רק הוספה ומחיקה - לתכנן ממשק עריכה מהיר בתוך ה-Ajax)
- [ ] NFR-007 אימות ObjectId לפני שאילתה (isValidObjectId) בכל controller

## שבוע 3 - React (וידאו + Canvas), מעקב לימוד, השלמת פערים

- [x] סגירת הפערים משבוע 1-2 (רשימה למעלה)
- [x] מודל LearningLog (FR-018, FR-019 - רישום/עריכה/מחיקה של יחידת לימוד, מסך /learning)
- [x] מודול React נפרד - "בית המדרש האישי" (עמוד /study-room, נטען דרך React+Babel Standalone מ-CDN בלי build step)
- [x] FR-020 תצוגת מעקב לימוד ב-Canvas (heatmap של 26 שבועות אחרונים, מבוסס על /api/learning/heatmap)
- [x] העלאה/נגינת וידאו לפוסטים (BR-008 - עד 50MB, mp4/webm, דרך multer) - שבוע 3 הושלם במלואו

### שיפורי עיצוב וחוויית משתמש (נוסף בהמשך שבוע 3)
- [x] כותרות (h1) בגרדיאנט צבעוני + פס הדגשה - נראות מודרנית וחיה יותר
- [x] אנימציית "כניסה" חלקה לכל עמוד (page-fade-in) - תחושת מעבר קליל בין דפים
- [x] הדגשת קטגוריית ניווט פעילה (nav-pill.active) לפי העמוד הנוכחי - middleware חדש ב-server.js שממלא res.locals.currentPath
- [x] הפרדה חזותית (קו מפריד) בין קטגוריות תוכן לבין קטגוריית חשבון בתפריט
- [x] עיצוב אחיד לנגן הוידאו בפוסטים (.post-video ב-CSS, במקום style מוטמע)
- [x] כרטיס קטגוריה חדש בדף הבית שמדגיש את יכולת "שיעורים בוידאו"
- [x] מסמך DEFENSE-CHECKLIST.md - רשימת בדיקות מעשית להכנה להגנה, מבוססת על סעיף 12+13 ב-SRS

## שבוע 4 - צ'אט בזמן אמת (Socket.io), גרפי D3 (הושלם והופעל מול Firebase אמיתי)

- [x] מודל Message (server/models/Message.js - collection "messages", כל קבוצה = חדר צ'אט נפרד)
- [x] FR-021 שליחת הודעה (Socket.io + שמירה ב-Firestore + broadcast לחדר - server/sockets/chatSocket.js)
- [x] FR-022 היסטוריית צ'אט (נטענת ב-SSR עם כניסה לעמוד /groups/:id/chat)
- [x] FR-023 מחווני "מקליד..." (chat:typing, נעלם אוטומטית אחרי 2 שניות)
- [x] FR-024 טיפול בניתוק/חיבור מחדש (socket.io-client reconnection אוטומטי + REST fallback ב-/api/groups/:id/chat/history)
- [x] FR-025 גרף D3: פעילות (פוסטים) לפי קבוצה - Post.countActiveByGroup + /api/stats/posts-per-group
- [x] FR-026 גרף D3: מגמת לימוד קהילתית 30 יום - LearningLog.countAllGroupedByDate + /api/stats/learning-trend
- [x] FR-027 מצב ריק ידידותי בגרפים ובצ'אט (showEmptyState ב-statsCharts.js + הודעה בעמוד chat.ejs)
- [x] `npm install` הורץ בהצלחה (socket.io מותקן בפועל)
- [x] פרויקט Firebase אמיתי הוקם (Firestore, מצב Production, תוכנית Spark חינמית) + `serviceAccountKey.json` במקום
- [x] אימות חיבור אמיתי ל-Firestore: `npm run seed` רץ בהצלחה מול ה-DB האמיתי, הרשמה/התחברות עובדות, השרת עולה על localhost:3000

### קבצים חדשים שנוספו
server/models/Message.js, server/sockets/chatSocket.js, server/controllers/chatController.js,
server/routes/chatRoutes.js, server/controllers/statsController.js, server/routes/statsRoutes.js,
server/public/js/chat.js, server/public/js/statsCharts.js, server/views/groups/chat.ejs

### מה עוד כדאי לבדוק בפועל (לא קריטי, אפשר גם בשבוע 5)
- [ ] בדיקת הצ'אט בין שני משתמשים בו-זמנית (שני טאבים/דפדפנים) כולל ניתוק ידני (כיבוי WiFi) ובדיקת reconnection
- [ ] הצצה ויזואלית בשני הגרפים (/study-room) עם הנתונים האמיתיים מה-seed

## שיפורי UX בהרשמה/התחברות ובתפריט הניווט (עדכון לאחר בדיקת המשתמש באתר החי)

> נמצאו ותוקנו בעקבות סבב בדיקות ראשון של המשתמש על האתר הרץ מול Firebase אמיתי.

- [x] **תיקון באג משמעותי**: לאחר התחברות, התפריט העליון המשיך להציג "התחברות/הרשמה" בהרבה עמודים (קבוצות, פוסטים, פרופיל וכו').
      הסיבה: רק חלק מהקונטרולרים העבירו `isLoggedIn` ל-`render`. **תוקן בשורש הבעיה**: middleware גלובלי חדש
      ב-server.js ממלא `res.locals.isLoggedIn/userName/userRole` פעם אחת לכל בקשה, לכל התבניות.
- [x] כפתור "עין" להצגה/הסתרה של סיסמה בטפסי הרשמה והתחברות (server/public/js/passwordToggle.js)
- [x] שדה "הזן שוב את הסיסמה" בהרשמה + ולידציה בצד לקוח (jQuery, בזמן אמת) ובצד שרת
- [x] תיקון UX: שגיאת ולידציה בהרשמה (למשל סיסמה לא תקינה) כבר לא מוחקת את כל הטופס -
      שם מלא/שם משתמש/אימייל נשמרים ומוצגים חזרה, רק שדה הסיסמה מתאפס
- [x] מיקוד טופס ההרשמה/התחברות במרכז העמוד (היה נוטה לימין) + הגדלה קלה של הטופס
- [x] כרטיס חדש בדף הבית "מה ההרשאות שלי" - מוצג רק למשתמש מחובר, מסביר לפי role (member/manager/admin)
      מה בדיוק מותר לו לעשות באתר

## שיפורים נוספים - אבטחה, עיצוב, PWA ("wow factor" לציון גבוה)

> בעקבות בקשת המשתמש "תעשה את כל מה שהצעת" - יישום כל רשימת השיפורים המתקדמים שהוצעה.

### אבטחה
- [x] `helmet` - הוספת HTTP headers מגנים בסיסיים (X-Frame-Options, X-Content-Type-Options ועוד) - `contentSecurityPolicy` מבוטלת בכוונה כי האתר טוען סקריפטים מ-CDN חיצוניים (jQuery/React/D3/Babel/Socket.io)
- [x] `express-rate-limit` - הגבלת קצב על `/login` ו-`/register` בלבד (20 בקשות ל-15 דקות לכל IP) - הגנה נוספת ברמת ה-IP, משלימה את BR-010 (נעילת חשבון)

### עיצוב וחוויית משתמש
- [x] מצב כהה (Dark Mode) מלא - כפתור מתג 🌙/☀️ בתפריט העליון, מבוסס על CSS Custom Properties (`[data-theme="dark"]`), נשמר ב-localStorage, וללא הבהוב (FOUC) בזכות סקריפט מוקדם ב-`<head>`
- [x] אווטארים אמיתיים למשתמשים - העלאת קובץ תמונה אמיתי (לא רק קישור טקסט) דרך `/profile/avatar` (multer, עד 5MB), מוצג מיד בתפריט העליון ובעמוד הפרופיל
- [x] גלריית תמונות לפוסטים - עד 6 תמונות לכל פוסט (`/posts/:id/images`, multer), מוצגות כ-grid בעמוד הקבוצה ובעריכת הפוסט

### PWA - התקנה כאפליקציה
- [x] `manifest.json` + אייקון SVG - שם בעברית, RTL, תמיכה ב"הוספה למסך הבית"
- [x] Service Worker (`service-worker.js`) - אסטרטגיית Network-First עם fallback ל-cache, לחוויית שימוש טובה יותר גם ברשת חלשה

### קבצים חדשים שנוספו בשיפורים אלו
server/public/manifest.json, server/public/icons/icon.svg, server/public/service-worker.js,
server/public/js/pwaRegister.js, server/public/js/themeToggle.js

### הושלם מתוך "תעשה את כל מה שהצעת"
- [x] חיפוש גלובלי אחד שמחפש גם בקבוצות וגם בפוסטים (`GET /search`, server/controllers/searchController.js) - בנוסף לשני החיפושים הממוקדים הקיימים (FR-011/FR-012) שנשארו זמינים לחיפוש מתקדם
- [x] לוח בקרה למנהל מערכת (`GET /admin/dashboard`, אדמין בלבד) - כל הספירות (משתמשים/קבוצות/פוסטים/תגובות/הודעות/מאמרי חג) + התפלגות הרשאות + שני גרפי ה-D3 הקיימים מוצגים יחד במקום אחד
- [x] בדיקות אוטומטיות (`node:test`, מובנה ב-Node - לא דורש ספריית בדיקות נוספת) - הרצה: `npm test`. מכסה ולידציית הרשמה (BR-001/002/003, `server/test/validators.test.js`) ולוגיקת הרשאות (AC-002/AC-003, `server/test/permissionRules.test.js`). לצורך כך חולצה לוגיקה טהורה (`server/utils/validators.js`, `server/utils/permissionRules.js`) מתוך authController.js ו-middleware/permissions.js, כדי שאפשר לבדוק אותה בלי חיבור אמיתי ל-Firestore.

### עדיין בתהליך
- [x] פעמון התראות בזמן אמת (Socket.io) - **הושלם**. פעמון בתפריט העליון בכל עמוד (למשתמש מחובר בלבד) -
      מקבל התראה חיה על הודעת צ'אט חדשה בקבוצה (חוץ ממי שכבר צופה בצ'אט עצמו כרגע) ועל תגובה חדשה על הפוסט שלך.
      `server/models/Notification.js` (collection "notifications"), `server/sockets/ioInstance.js` (חשיפת ה-io
      instance ל-commentController.js), `server/utils/notificationRecipients.js` (פונקציה טהורה + 5 בדיקות
      `node:test` - למי לשלוח התראה ולמי לא), `GET/POST /api/notifications*`, `server/public/js/notifications.js`.
      כל socket שנפתח באתר מצטרף אוטומטית ל-room אישי (`user:<id>`) כדי שאפשר יהיה לשדר אליו מכל עמוד, לא רק מהצ'אט.
- [ ] כלי AI מובנה - שאלות לפי תוכן הקבוצה/פוסט + סיכום אוטומטי של שיעור (Gemini API, ממתין למפתח מהמשתמש)
- [x] רכיב React עם `<video>` אמיתי - **הושלם**, ראו סעיף 26 ב"בדיקת התאמה לדרישות הטכניות" למטה

## שבוע 5 - מעגל השנה, הרשאות, לוח בקרה, בדיקה להגנה

- [x] FR-028 יצירת/עריכת מאמר חג (אדמין בלבד, BR-012) - `server/models/Holiday.js`, `server/controllers/holidayController.js`, `server/routes/holidayRoutes.js`
- [x] FR-029 עמוד "מעגל השנה" (`GET /holidays`, ציבורי כולל אורחים) - מועד מובלט (`isFeatured`, מסומן ידנית - אין חישוב אסטרונומי, מחוץ להיקף) + ארכיון שאר המועדים בפריסת **multiple-columns** (סוגר בפועל את דרישה 27.iii שהייתה מוגדרת ב-CSS אך לא בשימוש באף עמוד)
- [x] **עדכון (בעקבות בקשת המשתמש)**: לוח שנה גרגוריאני ויזואלי אמיתי (12 לוחות חודשיים, `server/utils/calendarGrid.js` - פונקציה טהורה עם 6 בדיקות `node:test` משלה) - חג מודגש בלוח רק אם הוגדר לו ידנית שדה `Holiday.gregorianDate` ("YYYY-MM-DD") באדמין; עדיין **אין** חישוב אסטרונומי של הלוח העברי (מחוץ להיקף, סעיף 2.2 ב-SRS) - בדיוק כמו לוח קיר שממלאים ידנית כל שנה. נתוני seed עודכנו עם תאריכים אמיתיים ל-5787 (מקור: hebcal.com)
- [x] קישור מקבוצת "ועד" רלוונטית ממאמר חג (`linkedGroupId`)
- [x] נתוני seed למעגל השנה - 4 מאמרים לדוגמה (ראש השנה/יום כיפור/סוכות/פסח), אחד מסומן כמועד הקרוב
- [x] עמוד `/permissions` - הסבר מלא (טבלה + טקסט) על ארבעת סוגי המשתמשים, כולל "איך הופכים למנהל קבוצה/אדמין" - קישור אליו נוסף גם מכרטיס "מה ההרשאות שלי" בדף הבית
- [x] סקריפט `server/scripts/makeAdmin.js` (`npm run make-admin -- email@example.com`) - הדרך המיועדת להפוך משתמש קיים לאדמין (לא ניתן "להעניק לעצמך" הרשאת-על דרך האתר, מטעמי אבטחה)
- [x] סרטון השראה מוטמע (YouTube iframe) בדף הבית, מוצג לכולם כולל אורחים
- [x] אנימציות נוספות - כניסה הדרגתית (fade-in-up) לכרטיסים בדף הבית, הרמה עדינה (hover lift) על כרטיסים בכל האתר, פעימה עדינה (pulse) על כפתור הקריאה-לפעולה הראשי
- [ ] בדיקת כל נקודות התורפה בסעיף 12 ל-SRS (הרשאות אמיתיות, שחזור סביבה נקייה, XSS, סודות ב-git, מצבי קצה)
- [ ] בדיקת כל קריטריוני הקבלה (AC-001..AC-010)
- [ ] בדיקה על תיקייה/מחשב נקי: git clone + npm install + seed בלבד

### קבצים חדשים שנוספו בשבוע 5
server/models/Holiday.js, server/controllers/holidayController.js, server/routes/holidayRoutes.js,
server/views/holidays/{index,show,new,edit}.ejs, server/controllers/searchController.js, server/views/search.ejs,
server/controllers/adminController.js, server/routes/adminRoutes.js, server/views/admin/dashboard.ejs,
server/views/permissions.ejs, server/scripts/makeAdmin.js, server/utils/validators.js, server/utils/permissionRules.js,
server/test/validators.test.js, server/test/permissionRules.test.js, server/utils/calendarGrid.js, server/test/calendarGrid.test.js,
server/models/Notification.js, server/sockets/ioInstance.js, server/controllers/notificationController.js, server/routes/notificationRoutes.js,
server/public/js/notifications.js, server/utils/notificationRecipients.js, server/test/notificationRecipients.test.js

## שיפורים שהועברו מפרויקט React אישי נפרד ("חת"ת יומי", github.com/shimonk7770-creator/REACTWORK)

> המשתמש ביקש לקחת מפרויקט אחר שבנה בעצמו רעיונות עיצוב/פיצ'רים - נבחרו ואושרו שלושה: זמני שבת, נגישות (גודל טקסט), עיצוב "hero-card".

- [x] **כרטיס "זמני שבת" בדף הבית** (`server/utils/shabbatTimes.js`) - חישוב אסטרונומי **אמיתי** (הדלקת נרות/צאת שבת/פרשת השבוע) לפי ספריית קוד-פתוח מוכרת `@hebcal/core`, **לא** חישוב עצמאי - בדיוק כמו ש-bcrypt משמש להצפנה במקום לכתוב הצפנה בעצמנו. חשוב להבדיל מדרישת "מעגל השנה" (למעלה) שנשארת **במפורש** מחוץ להיקף (SRS 2.2, אין חישוב תאריך עברי) - שני דברים שונים לגמרי.
  - הספרייה היא ESM טהורה (אין תמיכת CommonJS) - נטענת עם `import()` דינמי בתוך שאר הקוד שכתוב CommonJS, בדיוק כפי שהספרייה עצמה ממליצה לפרויקטי Node ישנים יותר.
  - במקום טופס טקסט חופשי (שנכשל בשקט על רוב הערים בישראל בבדיקה ידנית - `Location.lookup` המובנה מזהה "Tel Aviv" אבל לא "Bnei Brak"/"Petah Tikva" למשל) - נבחר תפריט נפתח סגור עם 21 ערים נתמכות (`shabbatTimes.CITIES`, קואורדינטות אמיתיות) בעברית, ב-`GET /profile`. עדיין 100% חישוב אמיתי של הספרייה - רק שהאיתור של הקואורדינטות לעיר נעשה דרך רשימה סגורה במקום מנוע חיפוש חלקי.
  - `User.shabbatCity` (ברירת מחדל: ירושלים), מתעדכן בהרשמה/התחברות/עדכון פרופיל (`req.session.shabbatCity`, אותו דפוס בדיוק כמו `userAvatarUrl`).
  - `GET /` (`pageRoutes.js`) הפך ל-async ומחשב את הכרטיס עם try/catch - אם החישוב נכשל מכל סיבה, הכרטיס פשוט לא מוצג (לא נופל דף הבית כולו).
  - 7 בדיקות `node:test` חדשות (`server/test/shabbatTimes.test.js`) - כולל בדיקה שערים שונות מחזירות תוצאה שונה, ושמפתח עיר לא תקין נופל בחזרה לברירת המחדל בלי לזרוק שגיאה.
- [x] **נגישות - גודל טקסט** (`server/public/js/fontSize.js`, כפתורי "רגיל/גדול/גדול מאוד" ב-`GET /profile`) - העדפה שנשמרת ב-`localStorage` של הדפדפן בלבד (לא ב-Firestore - זו העדפת תצוגה של המכשיר, לא נתון עסקי שצריך סנכרון בין מכשירים), עם סקריפט מניעת-הבהוב מוקדם ב-`partials/head.ejs` (אותו דפוס בדיוק כמו מצב כהה/בהיר הקיים).
- [x] **עיצוב "hero-card"** - כרטיס זמני השבת בדף הבית עוצב כ"hero-card" בולט (גרדיאנט + כרטיסי הדגשה `accent-card` פנימיים להדלקת-נרות/צאת-שבת) בהשראת עיצוב הפרויקט האחר, מותאם לפלטת הצבעים הקיימת של האתר (כתום-חום + טורקיז) במקום שכפול צבעי המקור.

### קבצים חדשים/שהשתנו עבור שיפורים אלו
server/utils/shabbatTimes.js, server/test/shabbatTimes.test.js, server/public/js/fontSize.js (חדשים) ·
package.json (נוספה תלות `@hebcal/core`), server/models/User.js, server/controllers/authController.js, server/routes/pageRoutes.js,
server/views/home.ejs, server/views/profile.ejs, server/views/partials/head.ejs, server/public/css/style.css (עודכנו)

## שיפורי UX/תוכן בעקבות סבב משוב נוסף של המשתמש (אוקטובר 2026)

> בקשה מרוכזת של 8 שיפורים - **כל 8 השיפורים הושלמו** (פוטר, ניווט לאורח, סרטון דף הבית, קישורי הרשמה/התחברות הדדיים, מעגל השנה בחודש נוכחי, עיצוב קבוצות בהשראת וואטסאפ, צ'אט פרטי 1-על-1, ופיצ'ר "סטטוס"/סטוריז). הפריט השמיני ("עוד דברים שהמרצה ביקש") טרם פורט במדויק - ממתין לפירוט נוסף מהמשתמש.

- [x] **פוטר "אודות" בכל עמוד** - `server/views/partials/footer.ejs` חדש (שם האתר + "כל הזכויות שמורות &lt;שנה נוכחית&gt;"), מוכל (`include`) בכל 22 קובצי ה-views הקיימים (כולל דף שגיאה) כדי שיופיע בתחתית כל עמוד באתר באופן עקבי.
- [x] **ניווט מצומצם לאורח** - לפני התחברות, התפריט העליון מציג רק בית/הרשמה/התחברות/מצב כהה-בהיר. קבוצות/חיפוש/מעגל השנה/הרשאות עברו לבלוק `isLoggedIn` ב-`partials/header.ejs` ומוצגים רק למשתמש מחובר. **חשוב**: הראוטים עצמם (`GET /holidays`, `GET /permissions` וכו') נשארו ציבוריים בכתובת ישירה - רק קישור הניווט הוסתר, כדי לשמר תאימות ל-FR-029 שדורשת גישת אורח לעמוד מעגל השנה.
- [x] **תיקון סרטון דף הבית** - הוחלף מ-iframe סטטי ל-YouTube IFrame Player API הרשמי: נגינה אוטומטית מושתקת (כדי שדפדפנים יאפשרו autoplay), לולאה אינסופית אמיתית (`loop:1` + `playlist:<videoId>` - נדרש ע"י YouTube כדי שלולאה תעבוד על סרטון בודד), וכפתור "הפעלת קול" ייעודי שקורא ל-`player.unMute()/mute()`.
- [x] **קישורי הרשמה/התחברות הדדיים** - `login.ejs`: "עוד לא נרשמת? להרשמה". `register.ejs`: "נרשמתם כבר? להתחברות".
- [x] **מעגל השנה - חודש נוכחי בלבד + ניווט + הדגשת חגים** - `GET /holidays` עבר מהצגת 12 חודשים יחד לחודש בודד (ברירת מחדל: החודש הנוכחי), עם קישורי "חודש קודם"/"חודש הבא" (`?year=YYYY&month=M`, תומך גם במעבר בין שנים בקצוות ינואר/דצמבר) וקישור "חזרה לחודש הנוכחי" כשצופים בחודש אחר. ימי חג מודגשים ברקע כתום בולט (`--color-primary`) + שם החג מוצג בתוך התא, עם מקרא (`legend`) מתחת ללוח המסביר את הסימון. מימוש: `calendarGrid.js` פוצל לפונקציית `buildMonth(holidays, year, monthIndex)` חדשה לחודש בודד, כאשר `buildYearGrid` הישנה (עדיין נבדקת) כעת רק קוראת לה בלולאה - כך שהבדיקות הקיימות נשארו תקפות ונוספו 4 בדיקות חדשות ל-`buildMonth`.

- [x] **עמוד קבוצות - עיצוב מחדש בהשראת וואטסאפ** - `/groups` עבר לרשימת שורות ("רשימת שיחות") עם תמונת קבוצה עגולה (או אות ראשונה כברירת מחדל), תיאור קצר ותגית מספר חברים, וכפתור "+" צף (FAB) ליצירת קבוצה. עמוד קבוצה בודדת (`/groups/:id`) קיבל כותרת עם תמונת קבוצה גדולה, ורשימת "חברי הקבוצה" עם אווטאר+שם לכל חבר (בתגית/chip), כולל תגית "מנהל". **תמונת קבוצה**: `POST /groups/:id/photo` (מנהל הקבוצה בלבד, `multer`, עד 5MB) - אותו דפוס בדיוק כמו תמונת פרופיל משתמש. **הוספת/הסרת חברים ע"י מנהל** (בנוסף להצטרפות העצמית הקיימת): `POST /groups/:id/members` (לפי שם משתמש) ו-`POST /groups/:id/members/:userId/remove` - שני הראוטים מוגנים ב-`isGroupManagerOf` (מנהל הקבוצה הספציפית או אדמין בלבד), ולא ניתן להסיר את המנהל עצמו.

- [x] **צ'אט פרטי (1-על-1) בין משתמשים** - בנוסף לצ'אט הקבוצתי הקיים (FR-021..FR-024), נוסף צ'אט פרטי מלא בין כל שני משתמשים, עם אותה תשתית Socket.io בדיוק (אותו `server/sockets/chatSocket.js`, אירועי `dm:join`/`dm:send`/`dm:typing` במקביל ל-`chat:*` הקיימים). עמוד חדש **"הודעות"** (`GET /messages`, קישור ניווט חדש בתפריט העליון למשתמש מחובר) מציג רשימת שיחות קיימות (preview של ההודעה האחרונה, בהשראת רשימת הצ'אטים בוואטסאפ) + חיפוש משתמש לפי שם/שם משתמש להתחלת שיחה חדשה (`User.search`, סינון בזיכרון כמו בשאר חיפושי המערכת). עמוד השיחה עצמו (`GET /messages/:userId`) זהה במבנה לצ'אט הקבוצתי (אותם CSS classes, היסטוריה + REST fallback לחיבור מחדש + מחוון "מקליד..."). **מודל**: `Message.js` הורחב עם `dmRoomId` דטרמיניסטי לזוג משתמשים (`dmRoomIdFor`, לא תלוי מי פתח את השיחה ראשון) ופונקציות `createDm`/`listByDm`/`listDmSince`/`listConversationsForUser`, בלי לשנות את ה-collection הקיים. התראת פעמון חדשה מסוג `"dm"` נשלחת לנמען (אם אינו פעיל כרגע באותה שיחה), באותו מנגנון בדיוק כמו התראת הודעת קבוצה.

- [x] **פיצ'ר "סטטוס" מלא (סטוריז)** - היקף מאושר במפורש ע"י המשתמש (לא סטטוס טקסט פשוט): תמונה או טקסט (עם בחירת צבע רקע מ-5 גוונים קבועים), נעלם אוטומטית אחרי 24 שעות, עם רשימת "נצפה ע"י" (גלויה רק לבעל הסטטוס - לא חושפים מי צפה למי אחר). שורת עיגולים חדשה בראש דף הבית (`partials/statusBar.ejs`, רק למשתמש מחובר) מציגה את "הסטטוס שלי" + כל שאר המשתמשים עם סטטוס פעיל, עם טבעת צבעונית (יש חדש שלא נצפה) מול טבעת אפורה (כבר נצפה הכל) - בדיוק כמו ההבחנה בוואטסאפ. עמוד הצפייה (`GET /status/u/:userId`) הוא "ויואר" מסך-מלא עם סרגלי התקדמות (מתקדם אוטומטית כל 5 שניות), אזורי הקשה ימין/שמאל למעבר ידני, ורישום צפייה אוטומטי (`POST /status/:id/view` דרך `fetch`, לא נספר כצפייה עצמית של הבעלים). **"נעלמת" אחרי 24 שעות**: ללא מחיקה פיזית בפועל (כמו ארכוב קבוצות/פוסטים, BR-011) - פשוט מסוננת בשאילתות הקריאה (`Status.isExpired`, נבדק ב-5 בדיקות `node:test` חדשות). מחיקה מוקדמת ע"י הבעלים אפשרית (`POST /status/:id/delete`).

### קבצים חדשים/שהשתנו עבור השיפורים שהושלמו
server/views/partials/footer.ejs (חדש) ·
server/views/partials/header.ejs, server/views/home.ejs, server/views/login.ejs, server/views/register.ejs,
server/public/css/style.css, וכל שאר קובצי ה-views (הוספת include לפוטר בלבד) (עודכנו) ·
server/utils/calendarGrid.js (נוספה `buildMonth`), server/controllers/holidayController.js, server/views/holidays/index.ejs,
server/test/calendarGrid.test.js (4 בדיקות חדשות) (עודכנו - מעגל השנה) ·
server/middleware/upload.js (נוסף `uploadGroupPhoto`), server/models/Group.js (שדה `groupPhotoUrl`),
server/controllers/groupController.js (`uploadGroupPhoto`/`addMemberByManager`/`removeMemberByManager`),
server/routes/groupRoutes.js, server/views/groups/index.ejs, server/views/groups/show.ejs (עודכנו - קבוצות בהשראת וואטסאפ) ·
server/models/Message.js (dmRoomId/createDm/listByDm/listDmSince/listConversationsForUser),
server/models/User.js (נוספה `search`), server/controllers/messageController.js (חדש), server/routes/messageRoutes.js (חדש),
server/sockets/chatSocket.js (אירועי dm:*), server/server.js (רישום messageRoutes), server/public/js/dmChat.js (חדש),
server/views/messages/inbox.ejs, server/views/messages/chat.ejs (חדשים), server/views/partials/header.ejs,
server/public/css/style.css (עודכנו - צ'אט פרטי 1-על-1) ·
server/models/Status.js (חדש), server/controllers/statusController.js (חדש), server/routes/statusRoutes.js (חדש),
server/middleware/upload.js (נוסף `uploadStatusPhoto`), server/routes/pageRoutes.js (טעינת שורת הסטטוס לדף הבית),
server/server.js (רישום statusRoutes + `res.locals.userId` גלובלי), server/views/partials/statusBar.ejs (חדש),
server/views/home.ejs, server/views/status/new.ejs, server/views/status/view.ejs (חדשים),
server/public/js/statusViewer.js (חדש), server/test/status.test.js (חדש, 5 בדיקות), server/public/css/style.css (עודכנו - סטטוס/סטוריז)

## בדיקת התאמה לדרישות הטכניות של הקורס (סעיפים 15-29)

> הושוו במדויק מול הקוד בפועל (לא רק מול ה-SRS) - ראו את הטבלה המלאה בהודעה ששלח קלוד לשמעון בצ'אט בתאריך 22.09.2026, ותועד כאן לצורכי הגנה.

- [x] 15. Node.js + Express
- [x] 16. אחסון נתונים - **הוחלף מ-MongoDB ל-Firebase Firestore** באישור מפורש של מרצה הקורס (מתועד ב-SRS גרסה 1.1, סעיף 1.2)
- [x] 17. ארכיטקטורת MVC - הפרדה מלאה ל-models/controllers/views
- [x] 18. לפחות 3 מודלים - יש 7: User, Group, Post, Comment, LearningLog, Message, Holiday
- [x] 19. CRUD מלא לכל מודל, זמין למשתמש דרך הממשק (לא רק בקוד) - ראו טבלת CRUD בסעיף 4.9 ב-SRS
- [x] 20. שני חיפושים עם 3+ פרמטרים כל אחד - FR-011 (topic+dayOfWeek+level) ו-FR-012 (category+groupId+טווח תאריכים+keyword) + חיפוש גלובלי מאוחד נוסף (`/search`)
- [x] 21. הרשאות RBAC אמיתיות בצד שרת, פר-קבוצה
- [x] 22. פיד אישי + עמוד הרשאות שמסביר לכל משתמש מה מותר לו
- [x] 23. נתוני seed ריאליסטיים (8 משתמשים, 3 קבוצות, 5 פוסטים, 5 תגובות, 4 מאמרי חג)
- [x] 24. טיפול בשגיאות ומקרי קצה בצד לקוח ושרת, בלי קריסת שרת
- [x] 25. שימוש נרחב ב-jQuery/Ajax (תגובות, בדיקת שם משתמש, ולידציית סיסמאות)
- [x] 26. React + Video + Canvas - **Canvas ✓** (heatmap מעקב לימוד ב-`/study-room`) **+ Video ✓** (עודכן) - רכיב React חדש "הספרייה שלי" באותו עמוד, מציג את כל קטעי הוידאו שצורפו לפוסטים באתר (`GET /api/videos/library`) בנגן שכל השליטה בו (נגינה/השהיה/דילוג/עוצמת קול/מהירות) מנוהלת לגמרי ב-React (`useState`+`useRef`), לא `<video controls>` רגיל של הדפדפן כמו בעמוד הקבוצה - זה מה שסוגר את הפער בפועל
- [x] 27. CSS3 - text-shadow, transition, **multiple-columns** (כעת בשימוש בפועל בארכיון מעגל השנה), font-face, border-radius - כולם ממומשים ובשימוש
- [x] 28. צ'אט עם Socket.io
- [x] 29. המערכת מציגה נתונים סטטיסטיים בלפחות 2 גרפים דינמיים (D3.js), מבוססים על נתוני DB בזמן אמת - קיים כבר: FR-025 (פוסטים לפי קבוצה) ו-FR-026 (מגמת לימוד קהילתית 30 יום), שניהם ב-`/study-room` ומרוכזים שוב ב-`/admin/dashboard`, שואבים ישירות מ-Firestore בכל טעינה (`/api/stats/*`)

---

*מסמך זה מבוסס על SRS-Chavruta.md ומתעדכן בכל שבוע עבודה.*
