(() => {
  const currentPath = window.location.pathname;
  const items = [
    { href: "/diary", label: "Дневник", icon: "book" },
    { href: "/calendar", label: "Календарь", icon: "calendar3" },
    { href: "/playlists", label: "Плейлисты", icon: "collection-play" },
    { href: "/profile", label: "Профиль", icon: "person" },
    { action: "settings", label: "Настройки", icon: "gear" },
  ];

  const mount = () => {
    if (
      !document.querySelector(".main-container") ||
      document.querySelector(".ui-bottom-nav")
    )
      return;

    const nav = document.createElement("nav");
    nav.className = "ui-bottom-nav";
    nav.setAttribute("aria-label", "Основная навигация");
    nav.innerHTML = items
      .map((item) => {
        if (item.action) {
          return `<button type="button" data-mobile-action="${item.action}" aria-label="${item.label}"><i class="bi bi-${item.icon}"></i><span>${item.label}</span></button>`;
        }
        const active = currentPath === item.href ? ' aria-current="page"' : "";
        return `<a href="${item.href}"${active}><i class="bi bi-${item.icon}"></i><span>${item.label}</span></a>`;
      })
      .join("");
    document.body.append(nav);
                                                                                     
    if (window.SonaryShell) {
      nav.querySelectorAll("a[href]").forEach((link) =>
        link.addEventListener("click", (event) => {
          if (
            event.button ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          window.SonaryNavigation.go(link.getAttribute("href"));
        }),
      );
      const syncCurrent = () =>
        nav.querySelectorAll("a[href]").forEach((link) => {
          if (link.getAttribute("href") === location.pathname)
            link.setAttribute("aria-current", "page");
          else link.removeAttribute("aria-current");
        });
      document
        .getElementById("sonaryPage")
        ?.addEventListener("load", syncCurrent);
      window.addEventListener("popstate", syncCurrent);
    }

    nav
      .querySelector('[data-mobile-action="settings"]')
      ?.addEventListener("click", () => {
        const desktopSettings = document.getElementById("openSettingsBtn");
        if (desktopSettings) {
          desktopSettings.click();
          return;
        }
        const modal = document.getElementById("settingsModal");
        if (modal) window.SonaryModal?.open(modal);
      });
  };

  document.addEventListener("DOMContentLoaded", mount);
})();
