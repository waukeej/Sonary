document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".profile-hero");
  const settingsModal = document.getElementById("settingsModal");
  const profileModal = document.getElementById("profileEditModal");
  const profileHeaderModal = document.getElementById("profileHeaderModal");
  if (!hero || !settingsModal || !profileModal || !profileHeaderModal) return;
  let editButton = hero.querySelector(".profile-settings-btn");
  if (!editButton) {
    editButton = document.createElement("button");
    editButton.className = "profile-settings-btn";
    editButton.type = "button";
    editButton.title = "Редактировать профиль";
    editButton.setAttribute("aria-label", "Редактировать профиль");
    editButton.innerHTML = '<i class="bi bi-pencil"></i>';
    hero.append(editButton);
  }
  const close = (modal) => {
    window.SonaryModal?.close(modal);
  };
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    profileModal.querySelector("form").reset();
    cropped = false;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    profileModal.querySelector(".profile-edit-preview img").src =
      hero.querySelector("[data-profile-avatar]").src;
    window.SonaryProfile.clearErrors(profileModal);
    window.SonaryModal?.open(profileModal);
  });
  const openHeaderModal = () => window.SonaryModal?.open(profileHeaderModal);
  hero.addEventListener("click", (event) => {
    if (!event.target.closest("button")) openHeaderModal();
  });
  hero.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openHeaderModal();
  });
  document
    .getElementById("closeProfileEditBtn")
    .addEventListener("click", () => close(profileModal));
  document
    .getElementById("closeProfileHeaderBtn")
    .addEventListener("click", () => close(profileHeaderModal));
  document
    .getElementById("cancelProfileEditBtn")
    .addEventListener("click", () => close(profileModal));
  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) close(profileModal);
  });
  profileHeaderModal.addEventListener("click", (event) => {
    if (event.target === profileHeaderModal) close(profileHeaderModal);
  });
  const avatarInput = profileModal.querySelector('input[type="file"]');
  let previewUrl;
  let cropped = false;
  avatarInput?.addEventListener("change", () => {
    cropped = false;
  });
  avatarInput?.addEventListener("sonary:media-cropped", (event) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = event.detail.previewUrl;
    cropped = true;
    profileModal.querySelector(".profile-edit-preview img").src = previewUrl;
  });
  profileModal
    .querySelector("form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (avatarInput.files.length && !cropped) {
        window.SonaryProfile.showErrors(form, {
          avatar: "Сначала примените обрезку изображения.",
        });
        return;
      }
      if (
        await window.SonaryProfile.save(
          form,
          new FormData(form),
          form.querySelector('[type="submit"]'),
        )
      ) {
        avatarInput.value = "";
        cropped = false;
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          previewUrl = null;
        }
        close(profileModal);
      }
    });
});
