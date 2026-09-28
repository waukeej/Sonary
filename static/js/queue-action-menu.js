(() => {
  const menu = document.getElementById("queueActionMenu");
  if (!menu) return;
  let anchor = null;
  const isTrigger = (button) => {
    if (!button?.querySelector(".bi-music-note-list")) return false;
    if (
      button.closest(".sonary-queue-panel,.queue-action-menu,.player-actions")
    )
      return false;
    const label =
      `${button.getAttribute("aria-label") || ""} ${button.title || ""}`.toLowerCase();
    return (
      label.includes("очеред") ||
      Boolean(
        button.closest(
          ".playlist-track-actions,.profile-track-actions,.card-controls,.track-detail-actions",
        ),
      )
    );
  };
  const close = () => {
    menu.hidden = true;
    anchor = null;
  };
  const position = () => {
    if (!anchor || menu.hidden) return;
    const rect = anchor.getBoundingClientRect();
    const left = Math.min(
      innerWidth - menu.offsetWidth - 10,
      Math.max(10, rect.right - menu.offsetWidth),
    );
    let top = rect.top - menu.offsetHeight - 8;
    if (top < 10)
      top = Math.min(innerHeight - menu.offsetHeight - 10, rect.bottom + 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (!isTrigger(button)) {
        if (!event.target.closest("#queueActionMenu")) close();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      document.dispatchEvent(
        new CustomEvent("sonary:popover-open", {
          detail: { type: "queue-action" },
        }),
      );
      anchor = button;
      menu.hidden = false;
      position();
    },
    true,
  );
  menu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const button = event.target.closest("button");
    if (!button) return;
    const id = anchor?.closest("[data-track-id]")?.dataset.trackId;
    if (id)
      await window.SonaryPlayer?.enqueue(
        id,
        button.hasAttribute("data-queue-next"),
      );
    close();
  });
  document.addEventListener("sonary:popover-open", (event) => {
    if (event.detail?.type !== "queue-action") close();
  });
  addEventListener("resize", position);
  addEventListener("scroll", position, true);
})();
