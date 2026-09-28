                                                                               
(() => {
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
                                    
    }
  };
  const system = matchMedia("(prefers-color-scheme: dark)");
  const savedLanguage = read("sonary-language");
  let language = ["ru", "en"].includes(savedLanguage)
    ? savedLanguage
    : (navigator.languages?.[0] || navigator.language || "en")
          .split("-")[0]
          .toLowerCase() === "ru"
      ? "ru"
      : "en";
  let theme = read("sonary-theme");
  if (!["system", "light", "dark"].includes(theme)) theme = "system";
  function apply() {
    document.documentElement.dataset.theme =
      theme === "system" ? (system.matches ? "dark" : "light") : theme;
    document.documentElement.lang = language;
    document.dispatchEvent(new CustomEvent("sonary:theme"));
  }
  window.SonaryPreferences = {
    get language() {
      return language;
    },
    get theme() {
      return theme;
    },
    setLanguage(value) {
      if (!["ru", "en"].includes(value)) return;
      language = value;
      write("sonary-language", value);
      apply();
      document.dispatchEvent(new CustomEvent("sonary:language"));
    },
    setTheme(value) {
      if (!["system", "light", "dark"].includes(value)) return;
      theme = value;
      write("sonary-theme", value);
      apply();
    },
  };
  system.addEventListener("change", () => {
    if (theme === "system") apply();
  });
  apply();
  document.addEventListener("DOMContentLoaded", () => {
    const themeSelect = document.getElementById("settingsTheme");
    const languageSelect = document.getElementById("settingsLanguage");
    if (themeSelect) {
      themeSelect.value = theme;
      themeSelect.addEventListener("change", () =>
        window.SonaryPreferences.setTheme(themeSelect.value),
      );
    }
    if (languageSelect) {
      languageSelect.value = language;
      languageSelect.addEventListener("change", () =>
        window.SonaryPreferences.setLanguage(languageSelect.value),
      );
    }
  });
})();
