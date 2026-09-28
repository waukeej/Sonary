document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (event) => {
    const card = event.target.closest(".track-card");
    const interactive = event.target.closest(
      'button, input, select, textarea, label, [role="slider"]',
    );
    if (!card || card.classList.contains("create-entry-card") || interactive)
      return;
    window.SonaryNavigation.go(card.dataset.href || "/track");
  });
});
