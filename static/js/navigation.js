(() => {
  const shell = window.parent !== window && window.parent.SonaryShell;
  if (shell) {
    document.documentElement.classList.add("sonary-frame");
    window.SonaryNavigation = { go: (url) => shell.go(url) };
    document.addEventListener("sonary:theme", () =>
      window.parent.SonaryPreferences?.setTheme(window.SonaryPreferences.theme),
    );
    document.addEventListener("sonary:language", () =>
      window.parent.SonaryPreferences?.setLanguage(
        document.documentElement.lang,
      ),
    );
  } else window.SonaryNavigation ||= { go: (url) => location.assign(url) };
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a[href]");
      const activeShell = shell || window.SonaryShell;
      if (
        !activeShell ||
        !link ||
        link.target ||
        link.hasAttribute("download") ||
        event.button ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const url = new URL(link.href, location.href);
      if (
        url.origin !== location.origin ||
        link.getAttribute("href").startsWith("#")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activeShell.go(url.href);
    },
    true,
  );
})();
