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
- [ ] פעמון התראות בזמן אמת (Socket.io) - הודעה/תגובה חדשה (מתוכנן לסבב הבא)
- [ ] כלי AI מובנה - שאלות לפי תוכן הקבוצה/פוסט + סיכום אוטומטי של שיעור (ממתין לבחירת ספק AI ומפתח API מהמשתמש)
- [ ] רכיב React עם `<video>` אמיתי (לא רק Canvas) - ראו "בדיקת התאמה לדרישות הטכניות" למטה

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
server/test/validators.test.js, server/test/permissionRules.test.js, server/utils/calendarGrid.js, server/test/calendarGrid.test.js

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
- [~] 26. React + Video + Canvas - **Canvas ✓** (heatmap מעקב לימוד ב-`/study-room`), **Video עדיין לא ✓** בתוך רכיב React (הווידאו בפוסטים הוא HTML5 רגיל דרך EJS, לא React) - **פער פתוח, מתוכנן לסבב הבא**
- [x] 27. CSS3 - text-shadow, transition, **multiple-columns** (כעת בשימוש בפועל בארכיון מעגל השנה), font-face, border-radius - כולם ממומשים ובשימוש
- [x] 28. צ'אט עם Socket.io
- [x] 29. המערכת מציגה נתונים סטטיסטיים בלפחות 2 גרפים דינמיים (D3.js), מבוססים על נתוני DB בזמן אמת - קיים כבר: FR-025 (פוסטים לפי קבוצה) ו-FR-026 (מגמת לימוד קהילתית 30 יום), שניהם ב-`/study-room` ומרוכזים שוב ב-`/admin/dashboard`, שואבים ישירות מ-Firestore בכל טעינה (`/api/stats/*`)

---

*מסמך זה מבוסס על SRS-Chavruta.md ומתעדכן בכל שבוע עבודה.*
