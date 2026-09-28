document.addEventListener("DOMContentLoaded", () => {
  const togglePlaylistPlayback = (card, cover) => {
    const icon = cover.querySelector(".bi");
    if (card.classList.contains("is-playing")) {
      const showPause = !card.classList.contains("is-paused");
      card.classList.toggle("is-paused", showPause);
      if (icon)
        icon.className = showPause ? "bi bi-pause-fill" : "bi bi-play-fill";
      return;
    }
    document.querySelectorAll(".playlist-card.is-playing").forEach((item) => {
      if (item === card) return;
      item.classList.remove("is-playing", "is-paused");
      const itemIcon = item.querySelector(".playlist-art-shell .bi");
      if (itemIcon) itemIcon.className = "bi bi-play-fill";
      item
        .querySelector(".playlist-art-shell")
        ?.setAttribute("aria-pressed", "false");
    });
    card.classList.add("is-playing");
    cover.setAttribute("aria-pressed", "true");
  };

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".playlist-card");
    if (
      !card ||
      card.classList.contains("create-entry-card") ||
      event.target.closest("button")
    )
      return;
    const cover = event.target.closest(".playlist-art-shell");
    if (cover) return togglePlaylistPlayback(card, cover);
    window.SonaryNavigation.go(card.dataset.href);
  });

  document.addEventListener("keydown", (event) => {
    const cover = event.target.closest(".playlist-art-shell");
    if (!cover || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    togglePlaylistPlayback(cover.closest(".playlist-card"), cover);
  });
});
