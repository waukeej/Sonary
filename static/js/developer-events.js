(() => {
  const endpoint = "http://127.0.0.1:5001/__developer_console";

  const send = (message) => {
    const payload = JSON.stringify({ message, page: location.pathname });
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        mode: "cors",
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  };

  const readableLabel = (element) => {
    const explicit = element.getAttribute("aria-label") || element.title;
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    return explicit || text || element.id || "элемент интерфейса";
  };

  document.addEventListener("click", (event) => {
    const action = event.target.closest(
      'button, a, [role="button"], [role="link"]',
    );
    if (!action) return;
    send(`Пользователь нажал «${readableLabel(action)}».`);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    const dialogTitle = form
      .closest('[role="dialog"]')
      ?.querySelector("h1, h2, h3")
      ?.textContent?.trim();
    send(
      dialogTitle
        ? `Пользователь отправил форму «${dialogTitle}».`
        : "Пользователь отправил форму.",
    );
  });

  document.addEventListener("change", (event) => {
    const control = event.target;
    if (control.matches('input[type="range"]')) {
      send(
        `Пользователь изменил положение ползунка «${readableLabel(control)}» на ${control.value}.`,
      );
      return;
    }
    if (control.matches('input[type="checkbox"], input[role="switch"]')) {
      send(
        `Пользователь ${control.checked ? "включил" : "выключил"} «${readableLabel(control)}».`,
      );
      return;
    }
    if (control.matches("select")) {
      send(
        `Пользователь выбрал «${control.options[control.selectedIndex]?.text || control.value}» в поле «${readableLabel(control)}».`,
      );
      return;
    }
    if (control.matches('input[type="file"]')) {
      send(`Пользователь выбрал файл в поле «${readableLabel(control)}».`);
    }
  });

  document.addEventListener("sonary:developer-action", (event) => {
    if (event.detail?.message) send(event.detail.message);
  });

  window.SonaryDeveloperConsole = { log: send };
})();
