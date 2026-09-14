# חברותא

רשת חברתית קהילתית-תורנית - פרויקט מסכם בקורס פיתוח אפליקציות אינטרנטיות.

מסמך הדרישות המלא (SRS) נמצא בפרויקט ה-Claude המשויך (`SRS-Chavruta.md`).

## הרצה מקומית

1. `npm install`
2. העתק את `.env.example` ל-`.env` ומלא ערכים אמיתיים (מחרוזת חיבור ל-MongoDB Atlas וכו')
3. `npm run dev` (או `npm start`)
4. גלוש אל `http://localhost:3000`

## מבנה הפרויקט

```
server/
  config/      - הגדרות (חיבור למסד נתונים)
  models/      - סכמות Mongoose (Model)
  controllers/ - לוגיקה עסקית
  routes/      - הגדרת נתיבי ה-API/הדפים
  middleware/  - הרשאות, טיפול בשגיאות
  views/       - תבניות EJS (View) + jQuery/Ajax
  public/      - CSS, JS סטטי
```

## התקדמות (לפי חלוקת השבועות ב-SRS)

- [x] שבוע 1: שלד ותשתית - Express, MVC, MongoDB, הרשמה/התחברות עם bcrypt, jQuery/Ajax ראשוני
- [x] שבוע 2: מודלים Group/Post/Comment + הרשאות + חיפוש + jQuery/Ajax לתגובות + Seed
- [ ] שבוע 3: חיפוש, React (מעקב לימוד + Canvas + וידאו), אנדפוינטים ל-D3
- [ ] שבוע 4: צ'אט (Socket.io) + ליטוש CSS3
- [ ] שבוע 5: בדיקות, נקודות תורפה, הכנה להגנה
