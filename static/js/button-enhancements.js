(() => {
  const iconTitles = {
    "bi-play-fill": "Воспроизвести трек",
    "bi-play": "Воспроизвести трек",
    "bi-pause-fill": "Поставить на паузу",
    "bi-heart": "Добавить в понравившиеся",
    "bi-heart-fill": "Убрать из понравившихся",
    "bi-plus-lg": "Добавить в плейлист",
    "bi-music-note-list": "Добавить в очередь",
    "bi-skip-start": "Предыдущий трек",
    "bi-skip-end": "Следующий трек",
    "bi-x-lg": "Закрыть",
    "bi-trash3": "Удалить",
    "bi-pencil": "Редактировать",
    "bi-gear": "Открыть настройки",
    "bi-calendar2-week": "Выбрать дату",
    "bi-grid": "Изменить вид",
    "bi-card-list": "Изменить вид",
    "bi-menu-app": "Открыть или закрыть меню",
    "bi-three-dots": "Дополнительные действия",
    "bi-grip-vertical": "Перетащить",
  };
  const inferTitle = (button) => {
    if (button.title) return button.title;
    const aria = button.getAttribute("aria-label");
    if (aria) return aria;
    if (button.id === "addTrackBtn") return "Добавить трек";
    if (button.id === "playlistAddAction") return "Создать плейлист";
    if (button.id === "createPlaylistFromMenu") return "Создать плейлист";
    if (button.id === "addTrackToCheckedPlaylists")
      return "Добавить в выбранные плейлисты";
    if (button.id === "deleteTrackBtn") return "Удалить трек";
    if (button.id === "deletePlaylistBtn") return "Удалить плейлист";
    if (
      button.classList.contains("card-play-btn") ||
      button.classList.contains("playlist-track-play")
    )
      return "Воспроизвести трек";
    if (button.classList.contains("card-menu-btn"))
      return "Добавить в плейлист";
    const icon = button.querySelector(".bi");
    if (icon) {
      const key = [...icon.classList].find((name) => iconTitles[name]);
      if (key) return iconTitles[key];
    }
    const text = button.textContent.trim().replace(/\s+/g, " ");
    return text || "Выполнить действие";
  };
  const addLikeButton = (container, beforeButton) => {
    if (!container || container.querySelector(".track-like-action")) return;
    const like =
      container.querySelector(
        '.card-like-btn, button[aria-label="Нравится"]',
      ) || document.createElement("button");
    like.type = "button";
    like.classList.add("track-like-action");
    like.setAttribute("aria-label", "Добавить в понравившиеся");
    like.title = "Добавить в понравившиеся";
    like.innerHTML = '<i class="bi bi-heart"></i>';
    container.insertBefore(like, beforeButton);
  };
  const addQueueButton = (container) => {
    if (!container || container.querySelector(".track-queue-action")) return;
    const queue =
      [...container.querySelectorAll("button")].find((button) =>
        button.querySelector(".bi-music-note-list"),
      ) || document.createElement("button");
    queue.type = "button";
    queue.classList.add("track-queue-action");
    queue.setAttribute("aria-label", "Добавить в очередь");
    queue.title = "Добавить в очередь";
    queue.innerHTML = '<i class="bi bi-music-note-list"></i>';
    container.append(queue);
  };
  const process = () => {
    document.querySelectorAll(".card-controls").forEach((controls) => {
      addLikeButton(controls, controls.querySelector(".card-menu-btn"));
      addQueueButton(controls);
    });
    document.querySelectorAll(".playlist-track-actions").forEach((actions) => {
      const add = actions.querySelector('[aria-label="Добавить в плейлист"]');
      addLikeButton(actions, add);
      if (add) {
        const queue = actions.querySelector(
          '[aria-label="Добавить в очередь"]',
        );
        if (queue && add.nextElementSibling !== queue) actions.append(queue);
      }
    });
    document.querySelectorAll(".player-actions").forEach((actions) => {
      const add = actions.querySelector('[aria-label="Добавить в плейлист"]');
      addLikeButton(actions, add);
      const queue = actions.querySelector('[aria-label="Очередь"]');
      if (queue && actions.lastElementChild !== queue) actions.append(queue);
    });
    const roundButtons =
      ".playlist-more-btn,.track-more-btn,.track-edit-btn,.profile-settings-btn,.playlist-round-action,.profile-avatar-btn,.delete-card-selector";
    document.querySelectorAll("button").forEach((button) => {
      const iconOnly =
        !!button.querySelector(".bi") && !button.textContent.trim();
      button.classList.toggle(
        "ui-square-button",
        iconOnly && !button.matches(roundButtons),
      );
      button.title = inferTitle(button);
    });
  };
  document.head.insertAdjacentHTML(
    "beforeend",
    "<style>.track-like-action.is-liked{border-color:var(--theme-accent);background:var(--theme-accent);color:var(--theme-background)}.card-controls .track-like-action,.card-controls .track-queue-action,.player-actions .track-like-action{width:var(--button-size);height:var(--button-size);padding:0}.playlist-track-actions .track-like-action{width:34px;height:34px;padding:0}</style>",
  );
  document.addEventListener("click", (event) => {
    const player = event.target.closest(".player-bar");
    const isControl = event.target.closest(
      'button,.player-volume,.progress-container,.progress-bar,.progress-thumb,input[type="range"],[role="slider"]',
    );
    if (!player || isControl || !player.dataset.trackId) return;
    window.SonaryNavigation.go(`/track/${player.dataset.trackId}`);
  });
  process();
  const observer = new MutationObserver(process);
  observer.observe(document.body, { childList: true, subtree: true });
})();
