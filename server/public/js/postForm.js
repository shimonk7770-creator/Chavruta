// server/public/js/postForm.js
// תצוגה מקדימה לתמונות שנבחרו בטופס "פרסום פוסט חדש" (server/views/groups/show.ejs)
// תוספת לפי משוב המשתמש (אוקטובר 2026): "הפרסום לא מושך כל כך" - תצוגה מקדימה לפני פרסום בפועל
$(function () {
  const $input = $("#postImages");
  const $preview = $("#postImagePreview");
  if (!$input.length || !$preview.length) return;

  $input.on("change", function () {
    $preview.empty();
    // עד 6 תמונות לפוסט (BR - מגבלת multer.limits.files, ראו server/middleware/upload.js)
    const files = Array.from(this.files || []).slice(0, 6);
    files.forEach(function (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        $preview.append(
          $("<img>", {
            src: e.target.result,
            class: "post-image-preview-thumb",
            alt: "תצוגה מקדימה",
          })
        );
      };
      reader.readAsDataURL(file);
    });
  });
});
