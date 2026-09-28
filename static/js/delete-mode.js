document.addEventListener("DOMContentLoaded", () => {
  const deleteButton = document.getElementById("deleteTrackBtn");
  const actions = document.querySelector(".filter-actions");
  const content = document.querySelector(".content:not(.playlists-page)");
  if (!deleteButton || !actions || !content) return;
  const cardClickHandlers = new Map();
  const selectedCards = () => [
    ...content.querySelectorAll(
      "#diaryTrackList > .track-card.is-selected-for-delete[data-track-id]",
    ),
  ];
  const confirm = () => {
    const selected = selectedCards();
    if (!selected.length) return;
    window.openDeleteMockDialogs?.(
      selected,
      exitMode,
      selected.length === 1 ? "трек" : "треки",
      async () => {
        const data = new FormData();
        selected.forEach((card) =>
          data.append("track_ids", card.dataset.trackId),
        );
        return window.SonaryDiary.send("/tracks/delete", data);
      },
    );
  };
  const actionRow = window.SonaryActionRow(
    document.querySelector(".diary-action-row"),
    () => exitMode(),
    confirm,
  );
  const sync = () => {
    const count = selectedCards().length;
    const mode = actions.classList.contains("is-delete-mode");
    const topConfirm = actions.querySelector(".confirm-delete-btn");
    if (topConfirm) topConfirm.disabled = count === 0;
    actionRow.render(
      mode,
      count,
      content.querySelectorAll("#diaryTrackList > .track-card[data-track-id]")
        .length,
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
      .querySelectorAll(".track-card.is-selected-for-delete")
      .forEach((card) => card.classList.remove("is-selected-for-delete"));
    cardClickHandlers.forEach((handler, card) =>
      card.removeEventListener("click", handler, true),
    );
    cardClickHandlers.clear();
    window.setBootstrapButtonIcon?.(deleteButton, false);
    sync();
  };

  const enterMode = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actions.classList.contains("is-delete-mode")) return;
    actions.classList.add("is-delete-mode");
    content.classList.add("delete-mode");
    window.setBootstrapButtonIcon?.(deleteButton, false);

    content
      .querySelectorAll("#diaryTrackList > .track-card[data-track-id]")
      .forEach((card) => {
        const selector = document.createElement("button");
        selector.className = "delete-card-selector";
        selector.type = "button";
        selector.setAttribute("aria-label", "Выбрать запись для удаления");
        selector.innerHTML =
          '<i class="bi bi-check-lg" aria-hidden="true"></i>';
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
      .querySelector(".confirm-delete-btn")
      .addEventListener("click", confirm);
    modeActions
      .querySelector(".cancel-delete-btn")
      .addEventListener("click", exitMode);
    actions.append(modeActions);
    sync();
  };

  deleteButton.addEventListener("click", enterMode);
  document.addEventListener("sonary:list-updated", () => {
    exitMode();
    deleteButton.disabled = !content.querySelector(
      "#diaryTrackList > .track-card[data-track-id]",
    );
  });
  document
    .querySelector("[data-delete-track-action]")
    ?.addEventListener("click", enterMode);
  sync();
  document.addEventListener("click", (event) => {
    if (!actions.classList.contains("is-delete-mode")) return;
    if (
      event.target.closest(
        '.track-card, [role="dialog"], button, a, input, select, textarea, label',
      )
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitMode();
  });
});
