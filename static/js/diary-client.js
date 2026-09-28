(() => {
  const showErrors = (root, errors) => {
    root.querySelectorAll("[data-track-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    Object.entries(errors).forEach(([name, message]) => {
      const node =
        [...root.querySelectorAll("[data-track-error]")].find(
          (el) => el.dataset.trackError === name,
        ) || root.querySelector('[data-track-error="form"]');
      if (node) {
        node.textContent = message;
        node.hidden = false;
      } else window.SonaryUI?.notify(message, "error");
    });
  };
  const send = async (url, data, root = document) => {
    try {
      const tokenResponse = await fetch("/auth/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!tokenResponse.ok) throw new Error("Не удалось выполнить запрос.");
      const token = await tokenResponse.json();
      data.set("csrf_token", token.csrf_token);
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        body: data,
        headers: {
          "X-CSRFToken": token.csrf_token,
          Accept: "application/json",
        },
      });
      if (response.ok && response.redirected) {
        if (window.SonaryNavigation) window.SonaryNavigation.go(response.url);
        else location.assign(response.url);
        return true;
      }
      const result = await response.json();
      showErrors(
        root,
        result.errors || {
          form: result.error || "Не удалось выполнить запрос.",
        },
      );
    } catch (error) {
      console.error("Diary request failed", error);
      showErrors(root, {
        form: "Не удалось выполнить запрос. Попробуйте позже.",
      });
    }
    return false;
  };
  window.SonaryDiary = { send, showErrors };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-diary-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await send(form.action, new FormData(form), form);
        } finally {
          button.disabled = false;
        }
      });
      form.querySelectorAll('[data-media-crop="cover"]').forEach((input) =>
        input.addEventListener("sonary:media-cropped", (event) => {
          form.querySelector(".review-cover-preview img").src =
            event.detail.previewUrl;
        }),
      );
      const rating = form.querySelector('[name="trackRating"]');
      if (rating) {
        const update = () => {
          rating.parentElement.querySelector("output").value =
            `${rating.value}/10`;
        };
        rating.addEventListener("input", update);
        update();
      }
    });
    const privacy = document.querySelector(".track-private-toggle input");
    privacy?.addEventListener("change", async () => {
      privacy.disabled = true;
      const page = document.querySelector(".track-detail-page");
      const data = new FormData();
      data.set("privacy", privacy.checked ? "private" : "public");
      if (!(await send(`/track/${page.dataset.trackId}/edit`, data)))
        privacy.checked = !privacy.checked;
      privacy.disabled = false;
    });
  });
})();
