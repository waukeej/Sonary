document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("playlistCreationModal");
  const form = document.getElementById("playlistCreationForm");
  if (!modal || !form) return;
  const close = () => {
    window.SonaryModal?.close(modal);
    document.body.classList.remove("modal-open");
  };
  const updateLabels = () => {
    const editing = form.getAttribute("action").endsWith("/edit");
    modal.querySelector("h2").textContent = window.SonaryI18n.t(
      editing ? "playlist_backend.edit" : "playlist_backend.new",
    );
    const button = form.querySelector('[type="submit"]');
    button.textContent = window.SonaryI18n.t(
      editing ? "playlist_backend.save" : "playlist_backend.create",
    );
    button.title = button.textContent;
  };
  document.addEventListener("sonary:language", updateLabels);
  const open = (event, editing = false, trackId = null) => {
    event?.stopPropagation();
    form.reset();
    form.querySelectorAll("[data-pending-track]").forEach((el) => el.remove());
    form.querySelectorAll("[data-track-error]").forEach((el) => {
      el.hidden = true;
    });
    form.querySelector("[data-media-preview]").hidden = true;
    form.action = "/playlists";
    form.dataset.sourceTrack = !editing && trackId ? trackId : "";
    if (!editing && trackId) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "track_ids";
      input.value = trackId;
      input.dataset.pendingTrack = "";
      form.append(input);
    }
    const data = document.getElementById("playlistEditData");
    if (editing && data) {
      const playlist = JSON.parse(data.textContent);
      form.action = `/playlist/${playlist.id}/edit`;
      form.elements.playlistTitle.value = playlist.title;
      form.elements.playlistDescription.value = playlist.description;
      form.elements.privacy.value = playlist.privacy;
    }
    updateLabels();
    document.getElementById("addToPlaylistMenu")?.setAttribute("hidden", "");
    window.SonaryModal?.open(modal);
    document.body.classList.add("modal-open");
  };
  document
    .querySelector("[data-edit-playlist]")
    ?.addEventListener("click", (event) => open(event, true));
  document.getElementById("playlistAddAction")?.addEventListener("click", open);
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.target.closest("[data-create-playlist-card]") &&
        !event.target.closest(".is-selection-mode")
      ) {
        event.preventDefault();
        open(event);
      }
    },
    true,
  );
  document
    .querySelector("[data-create-playlist-card]")
    ?.addEventListener("keydown", (event) => {
      if (event.target.closest(".is-selection-mode")) return;
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      open();
    });
  document
    .getElementById("createPlaylistFromMenu")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      open(
        event,
        false,
        document.getElementById("addToPlaylistMenu")?.dataset.trackId,
      );
    });
  modal
    .querySelectorAll("[data-close-creation]")
    .forEach((button) => button.addEventListener("click", close));
  if (form.querySelector("[data-track-error]:not([hidden])")) {
    window.SonaryModal?.open(modal);
    document.body.classList.add("modal-open");
  }
});
