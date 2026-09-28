(() => {
  let frame, pending;
  const path = (value) => {
    const url = new URL(value, location.href);
    return url.origin === location.origin
      ? url.pathname + url.search + url.hash
      : null;
  };
  const go = (value, replace = false) => {
    const target = path(value);
    if (!target) {
      location.assign(value);
      return;
    }
    if (
      target === "/" ||
      target.startsWith("/?") ||
      target.startsWith("/auth/")
    ) {
      location.assign(target);
      return;
    }
    pending = target;
    if (replace) history.replaceState({ sonary: target }, "", target);
    else history.pushState({ sonary: target }, "", target);
    frame.contentWindow.location.replace(target);
  };
  window.SonaryShell = { go };
  window.SonaryNavigation = { go };
  const syncPreferences = () => {
    const child = frame?.contentWindow.SonaryPreferences,
      own = window.SonaryPreferences;
    if (!child || !own) return;
    if (child.theme !== own.theme) child.setTheme(own.theme);
    if (child.language !== own.language) child.setLanguage(own.language);
  };
  document.addEventListener("sonary:theme", syncPreferences);
  document.addEventListener("sonary:language", syncPreferences);
  addEventListener("popstate", () => {
    pending = location.pathname + location.search + location.hash;
    frame.contentWindow.location.replace(pending);
  });
  addEventListener("DOMContentLoaded", () => {
    frame = document.getElementById("sonaryPage");
    history.replaceState(
      { sonary: location.pathname + location.search + location.hash },
      "",
      location.href,
    );
    frame.addEventListener("load", () => {
      const doc = frame.contentDocument,
        url = path(frame.contentWindow.location.href);
      if (!doc || !url) return;
      if (!doc.querySelector(".player-bar")) {
        location.replace(url);
        return;
      }
      if (pending && url !== pending)
        history.replaceState({ sonary: url }, "", url);
      else if (
        !pending &&
        url !== location.pathname + location.search + location.hash
      )
        history.replaceState({ sonary: url }, "", url);
      pending = null;
      document.title = doc.title;
      syncPreferences();
      document
        .querySelectorAll(".sidebar button[onclick]")
        .forEach((button) => {
          const target =
            button.id === "diaryNavBtn"
              ? "/diary"
              : button.id === "calendarNavBtn"
                ? "/calendar"
                : button.id === "playlistsNavBtn"
                  ? "/playlists"
                  : null;
          if (target && url.split("?")[0] === target)
            button.setAttribute("aria-current", "page");
          else button.removeAttribute("aria-current");
        });
      const avatar = doc.querySelector(".header [data-profile-avatar]"),
        shellAvatar = document.querySelector(".header [data-profile-avatar]");
      if (avatar && shellAvatar && shellAvatar.src !== avatar.src)
        shellAvatar.src = avatar.src;
      window.SonaryPlayer?.bindDocument(doc);
      [".add-playlist-list", ".playlist-track-picker-list"].forEach(
        (selector) => {
          const source = doc.querySelector(selector),
            target = document.querySelector(selector);
          if (source && target)
            target.replaceChildren(
              ...[...source.childNodes].map((node) => node.cloneNode(true)),
            );
        },
      );
    });
  });
})();
