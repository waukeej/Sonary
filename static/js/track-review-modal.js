document.addEventListener("DOMContentLoaded", () => {
  const editButton = document.querySelector(".track-edit-btn");
  const modal = document.getElementById("reviewEditModal");
  const form = document.getElementById("reviewEditForm");
  if (!editButton || !modal || !form) return;
  const close = () => {
    window.SonaryModal?.close(modal);
    document.body.classList.remove("modal-open");
  };
  editButton.addEventListener("click", () => {
    window.SonaryModal?.open(modal);
    document.body.classList.add("modal-open");
  });
  modal
    .querySelectorAll("[data-close-review]")
    .forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  if (form.querySelector("[data-track-error]:not([hidden])"))
    window.SonaryModal?.open(modal);
  const rating = form.querySelector('[name="trackRating"]');
  rating?.addEventListener("input", () => {
    rating.parentElement.querySelector("output").value = `${rating.value}/10`;
  });
  const coverInput = form.querySelector('[name="cover"]');
  const coverPreview = document.getElementById("reviewCoverPreview");
  coverInput?.addEventListener("sonary:media-cropped", (event) => {
    coverPreview.querySelector("img").src = event.detail.previewUrl;
  });
});
