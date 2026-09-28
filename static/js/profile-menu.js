document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.getElementById("profileAvatarBtn");
  const menu = document.getElementById("profileDropdown");
  const logout = document.getElementById("logoutConfirmModal");
  avatar?.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    avatar.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (event) => {
    if (menu && !event.target.closest(".profile-menu-wrapper"))
      menu.hidden = true;
  });
  document.querySelectorAll("[data-auth]").forEach((button) =>
    button.addEventListener("click", () => {
      window.SonaryNavigation.go("/?auth=" + button.dataset.auth);
    }),
  );
  menu?.querySelector(".profile-logout")?.addEventListener("click", (event) => {
    event.preventDefault();
    menu.hidden = true;
    window.SonaryModal.open(logout);
  });
  logout
    ?.querySelectorAll("[data-logout-cancel], .settings-close")
    .forEach((button) =>
      button.addEventListener("click", () => window.SonaryModal.close(logout)),
    );
  logout?.addEventListener("click", (event) => {
    if (event.target === logout) window.SonaryModal.close(logout);
  });
  logout
    ?.querySelector("[data-logout-confirm]")
    ?.addEventListener("click", async () => {
      try {
        const result = await window.SonaryAuth.submit("logout", new FormData());
        window.SonaryNavigation.go(result.redirect);
      } catch (error) {
        window.SonaryUI?.notify(error.message, "error");
      }
    });
});
