document.addEventListener("DOMContentLoaded", () => {
  const openButton = document.querySelector("[data-playlist-add]");
  const modal = document.getElementById("playlistTrackPicker");
  if (!modal) return;
  const form = document.getElementById("playlistCreationForm");
  let creating = false;
  const checkboxes = () => [
    ...modal.querySelectorAll(".playlist-track-checkbox"),
  ];
  const add = modal.querySelector(".playlist-track-picker-add");
  const sync = () => {
    add.disabled = !checkboxes().some((box) => box.checked);
  };
  const open = (forCreation = false) => {
    creating = forCreation;
    const pending = [...form.querySelectorAll("[data-pending-track]")].map(
      (el) => el.value,
    );
    checkboxes().forEach((box) => {
      box.checked = creating && pending.includes(box.value);
      box
        .closest(".playlist-track-choice")
        ?.classList.toggle("is-selected", box.checked);
    });
    sync();
    window.SonaryModal?.open(modal);
    document.body.classList.add("playlist-picker-open");
  };
  const close = () =>
    window.SonaryModal?.close(modal, () =>
      document.body.classList.remove("playlist-picker-open"),
    );
  openButton?.addEventListener("click", () => open());
  if (openButton)
    document
      .querySelector("[data-open-track-picker]")
      ?.addEventListener("click", () => open());
  document
    .querySelector("[data-create-pick-tracks]")
    ?.addEventListener("click", () => open(true));
  modal
    .querySelector(".playlist-track-picker-close")
    .addEventListener("click", close);
  modal
    .querySelector(".playlist-track-picker-cancel")
    .addEventListener("click", close);
  add.addEventListener("click", async (event) => {
    const ids = checkboxes()
      .filter((box) => box.checked)
      .map((box) => box.value);
    if (!ids.length) {
      window.SonaryUI?.notify(
        window.SonaryI18n.t("playlist_backend.select_track"),
        "error",
      );
      return;
    }
    if (creating) {
      form
        .querySelectorAll("[data-pending-track]")
        .forEach((el) => el.remove());
      ids.forEach((id) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "track_ids";
        input.value = id;
        input.dataset.pendingTrack = "";
        form.append(input);
      });
      close();
    } else {
      event.currentTarget.disabled = true;
      try {
        await window.SonaryPlaylists.submitIds(
          `/playlist/${document.querySelector(".playlist-detail-page").dataset.playlistId}/tracks/add`,
          "track_ids",
          ids,
        );
      } finally {
        sync();
      }
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.addEventListener("change", (event) => {
    if (event.target.matches(".playlist-track-checkbox")) {
      event.target
        .closest(".playlist-track-choice")
        ?.classList.toggle("is-selected", event.target.checked);
      sync();
    }
  });
  sync();
});
