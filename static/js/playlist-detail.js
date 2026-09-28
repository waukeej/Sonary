document.addEventListener("DOMContentLoaded", () => {
  const page = document.querySelector(".playlist-detail-page");
  const moreButton = document.getElementById("playlistMoreBtn");
  const moreMenu = document.getElementById("playlistMoreMenu");
  const closeMoreMenu = () => {
    if (!moreMenu) return;
    moreMenu.hidden = true;
    moreButton.setAttribute("aria-expanded", "false");
  };
  moreButton?.addEventListener("click", () => {
    moreMenu.hidden = !moreMenu.hidden;
    moreButton.setAttribute("aria-expanded", String(!moreMenu.hidden));
  });
  document.addEventListener("click", (event) => {
    if (
      moreMenu &&
      !moreMenu.hidden &&
      !event.target.closest(".playlist-more-wrap")
    )
      closeMoreMenu();
  });
  moreMenu
    ?.querySelector("[data-delete-playlist]")
    ?.addEventListener("click", () => {
      window.openDeleteMockDialogs?.(
        [page.querySelector(".playlist-hero")],
        () => {},
        "плейлист",
        () =>
          window.SonaryPlaylists.send(
            `/playlist/${page.dataset.playlistId}/delete`,
            new FormData(),
          ),
      );
      closeMoreMenu();
    });

  const trackList = page.querySelector(".playlist-track-list");
  const rows = [
    ...trackList.querySelectorAll(":scope > .profile-track[data-track-id]"),
  ];
  trackList.addEventListener("click", (event) => {
    const row = event.target.closest(".profile-track[data-track-id]");
    if (!row) return;
    if (event.target.closest('button, input, label, a, [role="slider"]'))
      return;
    if (!row.classList.contains("is-remove-mode"))
      window.SonaryNavigation.go(row.dataset.href);
  });

  const editActions = page.querySelector(".playlist-edit-actions");
  const removeButton = page.querySelector("[data-playlist-remove]");
  const addButton = page.querySelector("[data-playlist-add]");
  if (!editActions || !removeButton || !addButton) return;
  const modeActions = document.createElement("div");
  modeActions.className = "playlist-track-remove-actions";
  modeActions.hidden = true;
  modeActions.innerHTML =
    '<button type="button" class="playlist-round-action playlist-track-remove-cancel" aria-label="Отменить" title="Отменить"><i class="bi bi-x-lg"></i></button><button type="button" class="playlist-round-action playlist-track-remove-confirm" aria-label="Подтвердить" title="Подтвердить"><i class="bi bi-check-lg"></i></button>';
  editActions.insertBefore(
    modeActions,
    editActions.querySelector(".playlist-more-wrap"),
  );
  const selectedRows = () =>
    rows.filter((row) => row.querySelector(".playlist-track-selector:checked"));
  const confirm = () => {
    const selected = selectedRows();
    if (!selected.length) return;
    window.openDeleteMockDialogs?.(
      selected,
      exitRemoveMode,
      "связи с плейлистом",
      () =>
        window.SonaryPlaylists.submitIds(
          `/playlist/${page.dataset.playlistId}/tracks/remove`,
          "track_ids",
          selected.map((row) => row.dataset.trackId),
        ),
    );
  };
  const sync = () => {
    const count = selectedRows().length;
    const available = rows.filter((row) => !row.hidden).length;
    modeActions.querySelector(".playlist-track-remove-confirm").disabled =
      count === 0;
    removeButton.disabled = available === 0;
  };
  const exitRemoveMode = () => {
    addButton.hidden = false;
    removeButton.hidden = false;
    modeActions.hidden = true;
    page.querySelector(".playlist-more-wrap").hidden = false;
    rows.forEach((row) => {
      row.classList.remove("is-remove-mode", "is-marked-for-remove");
      row.querySelector(".playlist-track-selector")?.remove();
    });
    sync();
  };
  const toggle = (row) => {
    const selector = row.querySelector(".playlist-track-selector");
    selector.checked = !selector.checked;
    row.classList.toggle("is-marked-for-remove", selector.checked);
    sync();
  };
  trackList.addEventListener(
    "click",
    (event) => {
      const row = event.target.closest(".profile-track.is-remove-mode");
      if (
        !row ||
        event.target.closest('button, input, label, a, [role="slider"]')
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggle(row);
    },
    true,
  );
  const enterRemoveMode = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!modeActions.hidden || !rows.some((row) => !row.hidden)) return;
    addButton.hidden = true;
    removeButton.hidden = true;
    modeActions.hidden = false;
    closeMoreMenu();
    page.querySelector(".playlist-more-wrap").hidden = true;
    rows.forEach((row) => {
      row.classList.add("is-remove-mode");
      row.insertAdjacentHTML(
        "beforeend",
        '<input class="playlist-track-selector" type="checkbox" aria-label="Выбрать запись для удаления">',
      );
      const selector = row.querySelector(".playlist-track-selector");
      selector.addEventListener("change", () => {
        row.classList.toggle("is-marked-for-remove", selector.checked);
        sync();
      });
      selector.addEventListener("click", (event) => event.stopPropagation());
    });
    sync();
  };
  removeButton.addEventListener("click", enterRemoveMode, true);
  modeActions
    .querySelector(".playlist-track-remove-cancel")
    .addEventListener("click", exitRemoveMode);
  modeActions
    .querySelector(".playlist-track-remove-confirm")
    .addEventListener("click", confirm);
  page.addEventListener("sonary:track-visibility", () => {
    rows
      .filter((row) => row.hidden)
      .forEach((row) => {
        const selector = row.querySelector(".playlist-track-selector");
        if (selector) selector.checked = false;
        row.classList.remove("is-marked-for-remove");
      });
    sync();
  });
  document.addEventListener("click", (event) => {
    if (
      modeActions.hidden ||
      event.target.closest(
        '.profile-track, [role="dialog"], button, a, input, select, textarea, label',
      )
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitRemoveMode();
  });
  sync();
});
