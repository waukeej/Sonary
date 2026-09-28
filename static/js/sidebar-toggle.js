document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggleMenuBtn");
  const sidebar = document.getElementById("sidebar");
  const storageKey = "sonary-sidebar-collapsed";

  if (toggleBtn && sidebar) {
    const isCollapsed = localStorage.getItem(storageKey);
    if (isCollapsed !== null) {
      sidebar.classList.toggle("collapsed", isCollapsed === "true");
    }

    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const collapsed = sidebar.classList.contains("collapsed");
      localStorage.setItem(storageKey, String(collapsed));
      document.documentElement.classList.toggle("sidebar-expanded", !collapsed);
    });
  }
});
