# פריסה לענן - קישור אחד שפותח את האתר והאפליקציה מכל מקום

הקישור הציבורי יהיה `https://<שם-השירות>.onrender.com/app` (האפליקציה) ו-`https://<שם-השירות>.onrender.com` (האתר). השרת רץ ב-Render החינמי, כך שהכל עובד גם כשהמחשב שלך כבוי.

## 1. העלאת הקוד לגיט
בשני הריפו (`Chavruta` ו-`chavruta-mobile`): `git add -A`, `git commit`, `git push`. התיקייה `server/public/app` (גרסת הדפדפן של האפליקציה) נכנסת לריפו של השרת - Render לא בונה את האפליקציה.

## 2. יצירת השירות ב-Render
1. https://render.com - הרשמה עם GitHub.
2. New + ← Blueprint ← לבחור את הריפו `Chavruta` (הקובץ `render.yaml` מגדיר הכל). לחלופין: New + ← Web Service, Build `npm install`, Start `npm start`.
3. במסך Environment להזין (סודות - לא בגיט):
   - `FIREBASE_SERVICE_ACCOUNT_JSON` - להדביק את כל תוכן הקובץ `serviceAccountKey.json`.
   - `GEMINI_API_KEY` - מפתח Gemini.
   - `FIREBASE_WEB_API_KEY` - לכניסה עם Google באתר (אופציונלי).
   - `SESSION_SECRET` נוצר אוטומטית.
4. Deploy. אחרי כמה דקות מקבלים כתובת. לבדוק שהיא נפתחת וש-`/app` מציג את האפליקציה.
5. כניסה עם Google באתר: ב-Firebase Console ← Authentication ← Settings ← Authorized domains להוסיף את `<שם-השירות>.onrender.com`.

## 3. עדכון גרסת הדפדפן של האפליקציה (אחרי כל שינוי באפליקציה)
```
cd chavruta-mobile
npm install
npm run export:web
```
הפקודה בונה לתוך `chavruta-app/server/public/app`. אחר כך commit + push לריפו של השרת - Render מתעדכן לבד.

## 4. סריקה מ-Expo Go (בלי המחשב)
```
cd chavruta-mobile
copy .env.example .env      (ולערוך את EXPO_PUBLIC_API_URL לכתובת Render)
npm install -g eas-cli
eas login
eas init
npm run update
```
הפקודה מפרסמת את האפליקציה בענן של Expo, ומוצג קוד QR/קישור שאפשר לשלוח - נפתח ב-Expo Go בכל טלפון (דורש חשבון Expo חינמי).

## מגבלות ב-Render החינמי
- השרת "נרדם" אחרי ~15 דקות בלי שימוש; הכניסה הראשונה אחריו לוקחת כחצי דקה.
- קבצים שמועלים (תמונות, וידאו, תמונות פרופיל) נמחקים בכל הפעלה מחדש/פריסה מחדש. לקבצים קבועים צריך דיסק מתמשך (בתשלום) או אחסון חיצוני.
- כניסה עם Google באפליקציה עצמה עדיין לא נתמכת (באתר כן); באפליקציה נכנסים עם שם משתמש וסיסמה.
