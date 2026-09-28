document.addEventListener("DOMContentLoaded", () => {
  const deleteButton = document.getElementById("deletePlaylistBtn");
  const actions = document.querySelector(".filter-actions");
  const content = document.querySelector(".content.playlists-page");
  if (!deleteButton || !actions || !content) return;
  const cardClickHandlers = new Map();
  const cards = () =>
    [
      ...content.querySelectorAll(
        "#playlistsGrid > .playlist-card[data-playlist-id]",
      ),
    ].filter((card) => !card.dataset.systemKey);
  const selectedCards = () =>
    cards().filter((card) => card.classList.contains("is-selected-for-delete"));
  const confirm = () => {
    const selected = selectedCards();
    if (selected.length)
      window.openDeleteMockDialogs?.(
        selected,
        exitMode,
        selected.length === 1 ? "плейлист" : "плейлисты",
        () =>
          window.SonaryPlaylists.submitIds(
            "/playlists/delete",
            "playlist_ids",
            selected.map((card) => card.dataset.playlistId),
          ),
      );
  };
  const actionRow = window.SonaryActionRow(
    content.querySelector(".diary-action-row"),
    () => exitMode(),
    confirm,
  );
  const sync = () => {
    const count = selectedCards().length;
    const topConfirm = actions.querySelector(".confirm-delete-btn");
    if (topConfirm) topConfirm.disabled = count === 0;
    deleteButton.disabled = cards().length === 0;
    actionRow.render(
      actions.classList.contains("is-delete-mode"),
      count,
      cards().length,
    );
  };

  const exitMode = () => {
    actions.classList.remove("is-delete-mode");
    content.classList.remove("delete-mode");
    actions.querySelector(".delete-mode-actions")?.remove();
    content
      .querySelectorAll(".delete-card-selector")
      .forEach((button) => button.remove());
    content
      .querySelectorAll(".playlist-card.is-selected-for-delete")
      .forEach((card) => card.classList.remove("is-selected-for-delete"));
    cardClickHandlers.forEach((handler, card) =>
      card.removeEventListener("click", handler, true),
    );
    cardClickHandlers.clear();
    window.setBootstrapButtonIcon?.(deleteButton, false);
    sync();
  };

  const enterDeleteMode = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actions.classList.contains("is-delete-mode")) return;
    actions.classList.add("is-delete-mode");
    content.classList.add("delete-mode");
    window.setBootstrapButtonIcon?.(deleteButton, false);
    cards().forEach((card) => {
      const selector = document.createElement("button");
      selector.className = "delete-card-selector";
      selector.type = "button";
      selector.setAttribute("aria-label", "Выбрать плейлист для удаления");
      selector.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
      const toggleCardSelection = () => {
        const selected = card.classList.toggle("is-selected-for-delete");
        selector.classList.toggle("is-selected", selected);
        selector.setAttribute("aria-pressed", String(selected));
        sync();
      };
      selector.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
        toggleCardSelection();
      });
      const selectByCardClick = (clickEvent) => {
        if (clickEvent.target.closest(".delete-card-selector")) return;
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        toggleCardSelection();
      };
      card.addEventListener("click", selectByCardClick, true);
      cardClickHandlers.set(card, selectByCardClick);
      card.append(selector);
    });
    const modeActions = document.createElement("div");
    modeActions.className = "delete-mode-actions";
    modeActions.innerHTML =
      '<button class="cancel-delete-btn" type="button" title="Отмена" aria-label="Отмена"><i class="bi bi-x-lg"></i></button><button class="confirm-delete-btn" type="button" title="Удалить выбранные" aria-label="Удалить выбранные"><i class="bi bi-trash3"></i></button>';
    modeActions
      .querySelector(".cancel-delete-btn")
      .addEventListener("click", exitMode);
    modeActions
      .querySelector(".confirm-delete-btn")
      .addEventListener("click", confirm);
    actions.append(modeActions);
    sync();
  };

  deleteButton.addEventListener("click", enterDeleteMode, true);
  document.addEventListener("sonary:list-updated", exitMode);
  content
    .querySelector("[data-delete-playlist-action]")
    ?.addEventListener("click", enterDeleteMode);
  sync();
  document.addEventListener("click", (event) => {
    if (!actions.classList.contains("is-delete-mode")) return;
    if (
      event.target.closest(
        '.playlist-card, [role="dialog"], button, a, input, select, textarea, label',
      )
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitMode();
  });
});
