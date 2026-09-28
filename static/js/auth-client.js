window.SonaryAuth = {
  async submit(action, data) {
    return this.request("/auth/" + action, data);
  },
  async request(url, data) {
    const tokenResponse = await fetch("/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!tokenResponse.ok)
      throw new Error(
        window.SonaryI18n?.translate(
          "Не удалось начать запрос. Обновите страницу.",
        ) || "Не удалось начать запрос. Обновите страницу.",
      );
    const token = await tokenResponse.json();
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: data,
      headers: { "X-CSRFToken": token.csrf_token, Accept: "application/json" },
    });
    if (!response.headers.get("Content-Type")?.includes("application/json")) {
      throw new Error(
        window.SonaryI18n?.translate(
          "Не удалось выполнить запрос. Обновите страницу и попробуйте снова.",
        ) ||
          "Не удалось выполнить запрос. Обновите страницу и попробуйте снова.",
      );
    }
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(
        window.SonaryI18n?.translate(
          result.error || "Не удалось выполнить запрос.",
        ) ||
          result.error ||
          "Не удалось выполнить запрос.",
      );
      error.field = result.field;
      error.sourceMessage = result.error;
      error.fields = result.errors;
      throw error;
    }
    return result;
  },
};

window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
