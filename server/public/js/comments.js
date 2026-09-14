// server/public/js/comments.js
// טעינת תגובות, הוספת תגובה ומחיקתה - הכול דרך jQuery/Ajax בלי רענון עמוד (דרישה 25 במסמך הדרישות)

$(function () {
  // בעת טעינת הדף - טוענים את התגובות לכל פוסט המוצג
  $(".post-card").each(function () {
    const postId = $(this).data("post-id");
    loadComments(postId);
  });

  // שליחת תגובה חדשה
  $(document).on("submit", ".comment-form", function (e) {
    e.preventDefault();
    const $form = $(this);
    const postId = $form.data("post-id");
    const content = $form.find('input[name="content"]').val();

    $.ajax({
      url: `/api/posts/${postId}/comments`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ content }),
      success: function () {
        $form.find('input[name="content"]').val("");
        loadComments(postId); // רענון רשימת התגובות בלבד, לא כל הדף
      },
      error: function (xhr) {
        alert((xhr.responseJSON && xhr.responseJSON.message) || "שגיאה בשליחת התגובה");
      },
    });
  });

  // מחיקת תגובה
  $(document).on("click", ".delete-comment-btn", function () {
    const commentId = $(this).data("comment-id");
    const postId = $(this).data("post-id");
    if (!confirm("למחוק את התגובה?")) return;

    $.ajax({
      url: `/api/comments/${commentId}`,
      method: "DELETE",
      success: function () {
        loadComments(postId);
      },
    });
  });

  function loadComments(postId) {
    $.ajax({
      url: `/api/posts/${postId}/comments`,
      method: "GET",
      success: function (response) {
        const $container = $(`#comments-${postId}`);
        $container.empty();
        response.comments.forEach(function (comment) {
          $container.append(
            `<p class="comment">
              <strong>${escapeHtml(comment.authorId.fullName)}:</strong> ${escapeHtml(comment.content)}
              <button class="btn-link delete-comment-btn" data-comment-id="${comment._id}" data-post-id="${postId}">מחק</button>
            </p>`
          );
        });
      },
    });
  }

  // מניעת XSS בצד הלקוח - לעולם לא מכניסים טקסט ממשתמש ל-HTML בלי בריחה (escaping)
  function escapeHtml(str) {
    return $("<div>").text(str).html();
  }
});
