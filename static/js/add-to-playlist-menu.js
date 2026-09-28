(() => {
  const menu = document.getElementById("addToPlaylistMenu");
  if (!menu) return;
  const submit = document.getElementById("addTrackToCheckedPlaylists");
  const choices = () => [...menu.querySelectorAll(".add-playlist-switch")];
  const syncSubmit = () => {
    const enabled = choices().some((choice) => choice.checked);
    submit.disabled = !enabled;
    submit.setAttribute("aria-disabled", String(!enabled));
  };
  let anchor = null;
  const isTrigger = (button) => {
    if (!button || button.closest("#addToPlaylistMenu")) return false;
    if (button.classList.contains("card-menu-btn")) return true;
    return Boolean(
      button.querySelector(".bi-plus, .bi-plus-lg") &&
        button.closest(
          ".player-actions,.card-controls,.playlist-track-actions,.profile-track-actions",
        ),
    );
  };
  const close = () => {
    menu.hidden = true;
    anchor = null;
    delete menu.dataset.trackId;
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
  const open = (button) => {
    document.dispatchEvent(
      new CustomEvent("sonary:popover-open", {
        detail: { type: "add-to-playlist" },
      }),
    );
    anchor = button;
    menu.dataset.trackId =
      button.closest("[data-track-id]")?.dataset.trackId || "";
    menu.hidden = false;
    syncSubmit();
    position();
  };
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (!isTrigger(button)) {
        if (!event.target.closest("#addToPlaylistMenu")) close();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (anchor === button && !menu.hidden) close();
      else open(button);
    },
    true,
  );
  menu.addEventListener("change", (event) => {
    if (event.target.matches(".add-playlist-switch")) syncSubmit();
  });
  menu.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!event.target.closest("#addTrackToCheckedPlaylists") || submit.disabled)
      return;
    const trackId = anchor?.closest("[data-track-id]")?.dataset.trackId;
    if (!trackId) {
      window.SonaryUI?.notify(
        window.SonaryI18n.t("playlist_backend.unavailable"),
        "error",
      );
      return;
    }
    const data = new FormData();
    data.set("track_id", trackId);
    choices()
      .filter((choice) => choice.checked)
      .forEach((choice) => data.append("playlist_ids", choice.value));
    submit.disabled = true;
    try {
      if (await window.SonaryPlaylists.send("/playlists/add-track", data))
        close();
    } finally {
      syncSubmit();
    }
  });
  document.addEventListener("sonary:popover-open", (event) => {
    if (event.detail?.type !== "add-to-playlist") close();
  });
  addEventListener("resize", position);
  addEventListener("scroll", position, true);
  syncSubmit();
})();
