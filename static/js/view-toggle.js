document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("viewToggleBtn");
  const content = document.querySelector(".content");
  const playlistsButton = document.getElementById("playlistsNavBtn");
  const diaryButton = document.getElementById("diaryNavBtn");
  const minWidthForTwoCards = 900;
  const storageKey = "sonary-content-view";
  let selectedGridView = localStorage.getItem(storageKey) !== "list";

  const applyMode = (gridView, persist = false) => {
    if (!button || !content) return;
    content.classList.toggle("grid-view", gridView);
    button.title = gridView ? "Показать списком" : "Показать сеткой";
    button.setAttribute("aria-label", button.title);
    window.setBootstrapButtonIcon?.(button, gridView, false);
    if (persist) {
      selectedGridView = gridView;
      localStorage.setItem(storageKey, gridView ? "grid" : "list");
    }
  };

  const syncViewToggle = () => {
    if (!button || !content) return;
    const canShowTwoCards = content.clientWidth >= minWidthForTwoCards;
    button.hidden = !canShowTwoCards;

    if (!canShowTwoCards) {
      content.classList.remove("grid-view");
      button.classList.remove("is-active");
      window.setBootstrapButtonIcon?.(button, false, false);
      return;
    }

    applyMode(selectedGridView);
  };

  button?.addEventListener("click", () => {
    applyMode(!selectedGridView, true);
                                                                                     
    button.classList.remove("is-active");
  });

  syncViewToggle();
  requestAnimationFrame(syncViewToggle);
  window.addEventListener("pageshow", syncViewToggle);
  if (content && "ResizeObserver" in window) {
    new ResizeObserver(syncViewToggle).observe(content);
  } else {
    window.addEventListener("resize", syncViewToggle);
  }

  playlistsButton?.addEventListener("click", () => {
    window.SonaryNavigation.go("/playlists");
  });

  diaryButton?.addEventListener("click", () => {
    window.SonaryNavigation.go("/diary");
  });
});
