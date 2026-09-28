document.addEventListener("DOMContentLoaded", () => {
  const iconMap = [
    ["#toggleMenuBtn", "menu-app"],
    ["#diaryNavBtn", "book"],
    ["#calendarNavBtn", "calendar3"],
    ["#playlistsNavBtn", "collection-play"],
    ["#openSettingsBtn", "gear"],
    ["#calendarBtn", "calendar2-week", "calendar2-week-fill"],
    ["#viewToggleBtn", "grid", "card-list"],
    [
      "#addTrackBtn, #playlistAddAction",
      "clipboard-plus",
      "clipboard-plus-fill",
    ],
    [
      '#deleteTrackBtn, #deletePlaylistBtn, .filter-actions button[title^="Удалить"]',
      "clipboard-x",
      "clipboard-x-fill",
    ],
    [".card-play-btn", "play", "pause-fill"],
    [".card-menu-btn", "plus"],
    [
      ".player-buttons button:nth-of-type(1)",
      "skip-start",
      "skip-start-fill",
      "momentary",
    ],
    [".player-buttons button:nth-of-type(2)", "play", "pause-fill"],
    [
      ".player-buttons button:nth-of-type(3)",
      "skip-end",
      "skip-end-fill",
      "momentary",
    ],
    ['.player-actions button[aria-label="Очередь"]', "music-note-list"],
    ['.player-actions button[aria-label="Добавить в плейлист"]', "plus"],
  ];

  const setIcon = (button, iconName) => {
    const icon = document.createElement("i");
    icon.className = `bi bi-${iconName}`;
    icon.setAttribute("aria-hidden", "true");
    const holder = button.querySelector(".icon");
    if (holder) {
      holder.replaceChildren(icon);
    } else {
      button.replaceChildren(icon);
    }
  };

  window.setBootstrapButtonIcon = (button, active, markActive = true) => {
    if (!button?.dataset.icon) return;
    button.classList.toggle("is-active", markActive && active);
    setIcon(
      button,
      active && button.dataset.activeIcon
        ? button.dataset.activeIcon
        : button.dataset.icon,
    );
  };

  iconMap.forEach(([selector, iconName, activeIcon, behavior]) => {
    document.querySelectorAll(selector).forEach((button) => {
      button.dataset.icon = iconName;
      if (activeIcon) button.dataset.activeIcon = activeIcon;
      setIcon(
        button,
        button.classList.contains("is-active") && activeIcon
          ? activeIcon
          : iconName,
      );
      if (!activeIcon) return;

      button.addEventListener("click", () => {
        if (button.id === "calendarBtn" || button.id === "viewToggleBtn")
          return;
        if (behavior === "momentary") {
          window.setBootstrapButtonIcon(button, true);
          window.setTimeout(
            () => window.setBootstrapButtonIcon(button, false),
            300,
          );
          return;
        }
        window.setBootstrapButtonIcon(
          button,
          !button.classList.contains("is-active"),
        );
      });
    });
  });
});
