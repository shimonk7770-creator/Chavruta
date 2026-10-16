// server/public/js/googleLogin.js
// התחברות עם Google דרך Firebase Authentication (חלון קופץ). התהליך:
//  1) המשתמש לוחץ -> Firebase פותח חלון Google ומחזיר idToken
//  2) שולחים את ה-idToken ל-POST /auth/google -> השרת מאמת אותו מול Firebase Admin ופותח session
//  3) מעבירים לדף הבית
// ה-idToken הוא ההוכחה היחידה שהשרת סומך עליה - לא האימייל/השם שהדפדפן רואה.
(function () {
  var btn = document.getElementById("google-login-btn");
  var errBox = document.getElementById("google-error");
  if (!btn || typeof firebase === "undefined") return;

  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  var config;
  try {
    config = JSON.parse(btn.getAttribute("data-config"));
    firebase.initializeApp(config);
  } catch (e) {
    showError("הגדרות Firebase שגויות");
    return;
  }

  btn.addEventListener("click", async function () {
    errBox.hidden = true;
    btn.disabled = true;
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" }); // תמיד לתת לבחור חשבון
      var result = await firebase.auth().signInWithPopup(provider);
      var idToken = await result.user.getIdToken();

      var res = await fetch("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: idToken }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.success) throw new Error(data.message || "ההתחברות נכשלה. נסו שוב.");
      // מנקים את ההתחברות של Firebase בדפדפן - אנחנו עובדים עם session של האתר
      await firebase.auth().signOut().catch(function () {});
      window.location.href = data.redirect || "/";
    } catch (e) {
      if (e && (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request")) {
        // המשתמש סגר את החלון - לא שגיאה אמיתית
      } else if (e && e.code === "auth/unauthorized-domain") {
        showError("הדומיין הזה לא מאושר ב-Firebase (Authentication -> Settings -> Authorized domains)");
      } else if (e && e.code === "auth/operation-not-allowed") {
        showError("ספק Google לא מופעל ב-Firebase Console (Authentication -> Sign-in method)");
      } else {
        showError((e && e.message) || "ההתחברות נכשלה. נסו שוב.");
      }
    } finally {
      btn.disabled = false;
    }
  });
})();
