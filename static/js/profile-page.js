document.addEventListener("DOMContentLoaded", () => {
  const formatMobileLocation = () => {
                                                                                
    if (document.querySelector(".profile-location [data-profile-field]"))
      return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const location = document.querySelector(".profile-location");
    if (!location || location.dataset.mobileLayout) return;
    const rawLocation = location.textContent.trim();
    const [city = "Город", country = "Страна"] = rawLocation
      .split(",")
      .map((part) => part.trim());
    location.dataset.mobileLayout = "true";
    location.replaceChildren();
    const countryLine = document.createElement("span");
    countryLine.className = "profile-country";
    countryLine.innerHTML =
      '<i class="bi bi-flag-fill" aria-hidden="true"></i>';
    countryLine.append(` ${country}`);
    const cityLine = document.createElement("span");
    cityLine.className = "profile-city";
    cityLine.textContent = city;
    location.append(countryLine, cityLine);
  };
  formatMobileLocation();

  const paginate = (
    containerSelector,
    itemSelector,
    actionsSelector,
    pageSize,
  ) => {
    const container = document.querySelector(containerSelector);
    const actions = document.querySelector(actionsSelector);
    if (!container || !actions) return;
    const items = [...container.querySelectorAll(itemSelector)];
    const more = actions.querySelector('[id^="more"]');
    const collapse = actions.querySelector(".profile-collapse");
    if (!items.length) {
      actions.hidden = true;
      return;
    }
    let visible = Math.min(pageSize, items.length);
    const render = () => {
      items.forEach((item, index) => {
        item.hidden = index >= visible;
      });
      more.hidden = visible >= items.length;
      collapse.hidden = visible <= pageSize;
      actions.hidden = more.hidden && collapse.hidden;
    };
    more.addEventListener("click", () => {
      visible = Math.min(visible + pageSize, items.length);
      render();
    });
    collapse.addEventListener("click", () => {
      visible = Math.min(pageSize, items.length);
      render();
      items[0]?.scrollIntoView({ block: "nearest" });
    });
    render();
  };
  paginate(
    "#profileTracks",
    ".profile-track[data-track-id]",
    '[data-profile-pagination="tracks"]',
    5,
  );
  paginate(
    "#profilePlaylists",
    ".profile-playlist[data-playlist-id]",
    '[data-profile-pagination="playlists"]',
    5,
  );

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".profile-track,.profile-playlist");
    if (!card?.dataset.href || event.target.closest("button, input, label"))
      return;
    const playlistCover = event.target.closest(".profile-playlist-cover");
    if (playlistCover) {
      const icon = playlistCover.querySelector(".bi");
      if (card.classList.contains("is-playing")) {
        const showPause = !card.classList.contains("is-paused");
        card.classList.toggle("is-paused", showPause);
        if (icon)
          icon.className = showPause ? "bi bi-pause-fill" : "bi bi-play-fill";
        return;
      }
      document
        .querySelectorAll(".profile-playlist.is-playing")
        .forEach((item) => item.classList.remove("is-playing", "is-paused"));
      card.classList.add("is-playing");
      playlistCover.setAttribute("aria-pressed", "true");
      return;
    }
    window.SonaryNavigation.go(card.dataset.href);
  });
});
