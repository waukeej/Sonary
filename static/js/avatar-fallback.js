(() => {
  const avatarPath = (seed) => {
    const value = String(seed || "10012030");
    const hash = [...value].reduce(
      (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
      0,
    );
    return `/static/images/avatars/avatar-${(hash % 6) + 1}.png`;
  };

  const applyFallbacks = () => {
    document.querySelectorAll("[data-profile-avatar]").forEach((image) => {
      if (image.dataset.avatarCustom === "true") return;
      image.src = avatarPath(image.dataset.avatarSeed);
    });
  };

  window.SonaryAvatar = {
    setCustom(source) {
      document.querySelectorAll("[data-profile-avatar]").forEach((image) => {
        image.dataset.avatarCustom = "true";
        image.src = source;
      });
    },
  };

  document.addEventListener("DOMContentLoaded", applyFallbacks);
})();
