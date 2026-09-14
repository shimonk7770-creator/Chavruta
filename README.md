# חברותא

רשת חברתית קהילתית-תורנית - פרויקט מסכם בקורס פיתוח אפליקציות אינטרנטיות.

מסמך הדרישות המלא (SRS) נמצא בפרויקט ה-Claude המשויך (`SRS-Chavruta.md`).
מעקב משימות מפורט לפי דרישות ושבועות: `TASKS.md`.

## מסד הנתונים: Firebase / Firestore

**עודכן**: המערכת עברה מ-MongoDB ל-**Firebase Firestore** (בהתאם להמלצת המרצה).
כל שכבת הגישה לנתונים (בתיקיית `server/models`) עובדת מול Firestore באמצעות Firebase Admin SDK.

## הרצה מקומית

1. `npm install`
2. הגדרת Firebase:
   - היכנס ל-[Firebase Console](https://console.firebase.google.com) וצור פרויקט חדש (חינמי)
   - הפעל **Firestore Database** (Build -> Firestore Database -> Create database, מצב Native, Test mode מספיק לפרויקט לימודי)
   - עבור ל-Project Settings -> Service Accounts -> **Generate new private key** - יורד קובץ JSON
   - שמור את הקובץ שהתקבל בשם **`serviceAccountKey.json`** בשורש הפרויקט (ליד `package.json`) - הקובץ הזה **לא** נשמר בגיט (ראו `.gitignore`), כי הוא מכיל סוד רגיש שמעניק גישה מלאה למסד הנתונים
3. העתק את `.env.example` ל-`.env` ומלא `PORT` ו-`SESSION_SECRET`
4. `npm run seed` - ממלא נתוני דמו (8 משתמשים, 3 קבוצות, 5 פוסטים, 5 תגובות; סיסמת כל המשתמשים: `Password1`)
5. `npm run dev` (או `npm start`)
6. גלוש אל `http://localhost:3000`

## מבנה הפרויקט

```
server/
  config/      - הגדרות (חיבור ל-Firestore דרך Firebase Admin SDK)
  models/      - שכבת גישה לנתונים ב-Firestore (Model) - לא Schema קשיח כמו Mongoose, ולידציה בקונטרולר
  controllers/ - לוגיקה עסקית
  routes/      - הגדרת נתיבי ה-API/הדפים
  middleware/  - הרשאות, טיפול בשגיאות
  views/       - תבניות EJS (View) + jQuery/Ajax
  public/      - CSS, JS סטטי
seed/          - סקריפט אתחול נתוני דמו
```

### הערה טכנית: מעבר מ-MongoDB ל-Firestore

ב-Firestore אין populate() כמו ב-Mongoose - לכן שדות "מיובאים" כמו שם המחבר או שם הקבוצה
נשמרים ישירות (denormalization) על המסמך הרלוונטי בזמן היצירה, במקום refs שצריך לשלוף בנפרד.
חיפוש טקסט חופשי (FR-012, FR-011) מתבצע בשילוב סינון ב-Firestore (שדות שוויון/טווח) וסינון תוספתי
בזיכרון השרת (התאמה חלקית של מחרוזת) - כי ל-Firestore אין אינדקס טקסט חופשי מובנה כמו ב-Mongo.

## התקדמות (לפי חלוקת השבועות ב-SRS)

- [x] שבוע 1: שלד ותשתית - Express, MVC, הרשמה/התחברות עם bcrypt, jQuery/Ajax ראשוני
- [x] שבוע 2: מודלים Group/Post/Comment + הרשאות + חיפוש + jQuery/Ajax לתגובות + Seed
- [x] מעבר תשתית מ-MongoDB ל-Firebase/Firestore + השלמת פערים (עריכת פרופיל, מחיקת חשבון, עריכת פוסט, פיד אישי, הגנת XSS)
- [x] שבוע 3: מעקב לימוד (/learning) + מודול React עם Canvas heatmap (/study-room) + העלאת/נגינת וידאו לפוסטים
- [ ] שבוע 4: צ'אט (Socket.io) + גרפי D3
- [ ] שבוע 5: בדיקות, נקודות תורפה, הכנה להגנה
