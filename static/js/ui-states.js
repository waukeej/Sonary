(function () {
  const noticeHost = document.createElement("div");
  noticeHost.className = "ui-notice-host";
  noticeHost.setAttribute("aria-live", "polite");

  const ensureHost = () => {
    if (!noticeHost.isConnected) document.body.append(noticeHost);
    return noticeHost;
  };

  let lastNoticeKey = "";
  let lastNoticeTime = 0;

  const notify = (message, type = "notification", duration = 2400) => {
    const noticeType = type === "error" ? "error" : "notification";
    const noticeKey = `${noticeType}:${message}`;
    const now = Date.now();
    if (noticeKey === lastNoticeKey && now - lastNoticeTime < 500) return;
    lastNoticeKey = noticeKey;
    lastNoticeTime = now;
    window.SonaryDeveloperConsole?.log(
      `${noticeType === "error" ? "Ошибка" : "Результат действия"}: ${message}`,
    );
    const node = document.createElement("div");
    node.className = `ui-notice ui-notice--${noticeType}`;
    node.setAttribute("role", noticeType === "error" ? "alert" : "status");
    node.textContent = window.SonaryI18n?.translate(message) || message;
    ensureHost().append(node);

    window.setTimeout(() => {
      node.classList.add("is-leaving");
      node.addEventListener("animationend", () => node.remove(), {
        once: true,
      });
    }, duration);
  };

  const notifyNext = (message, type = "notification") => {
    try {
      sessionStorage.setItem(
        "sonary-next-notice",
        JSON.stringify({ message, type }),
      );
    } catch (_) {
      notify(message, type);
    }
  };

  const showEmpty = (
    target,
    title = "У вас пока нет записей",
    text = "Добавьте первую запись, чтобы она появилась здесь.",
  ) => {
    target.innerHTML = `<div class="ui-empty-state"><div><h2>${title}</h2><p>${text}</p></div></div>`;
  };

  const previewImage = (input, preview) => {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const image =
        preview.querySelector("img") || document.createElement("img");
      image.src = URL.createObjectURL(file);
      preview.append(image);
    });
  };

  window.SonaryUI = { notify, notifyNext, showEmpty, previewImage };

  document.addEventListener("DOMContentLoaded", () => {
    try {
      const stored = sessionStorage.getItem("sonary-next-notice");
      if (!stored) return;
      sessionStorage.removeItem("sonary-next-notice");
      const notice = JSON.parse(stored);
      if (notice?.message) notify(notice.message, notice.type);
    } catch (_) {}
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("button, a");
    if (!action) return;
    if (action.closest("#settingsModal")) return;
    const originalLabel =
      window.SonaryI18n?.originalText(action) || action.textContent || "";
    const label =
      `${originalLabel} ${action.getAttribute("aria-label") || ""}`.trim();

    if (/поделиться/i.test(label)) {
      notify("Ссылка скопирована в буфер обмена.");
      return;
    }

    if (/сбросить пароль/i.test(label)) {
      notify("Инструкция по сбросу пароля отправлена на почту.");
      return;
    }

    if (action.closest(".settings-footer") && /сохранить/i.test(label)) {
      notify("Настройки сохранены.");
      return;
    }

    if (action.classList.contains("apply-filters-btn")) {
      notify("Фильтры применены.");
      return;
    }

    if (action.classList.contains("reset-filters-btn")) {
      notify("Фильтры сброшены.");
    }
  });

  document.addEventListener("change", (event) => {
    const toggle = event.target.closest(
      ".playlist-private-toggle input, .track-private-toggle input",
    );
    if (
      toggle?.closest(
        ".track-detail-page[data-track-id], .playlist-detail-page[data-playlist-id]",
      )
    )
      return;
    if (!toggle) return;
    const entity = toggle.closest(".playlist-private-toggle")
      ? "Плейлист"
      : "Отзыв";
    notify(
      toggle.checked
        ? `${entity} сделан приватным.`
        : `${entity} теперь публичный.`,
    );
  });
})();
