                                                                                        
(() => {
  window.SonaryActionRow = (row, cancel, confirm) => {
    if (!row) return { render() {} };
    const buttons = [...row.querySelectorAll(".diary-action-card")];
    const normal = buttons.map((button) => ({
      title:
        window.SonaryI18n?.originalText(button.querySelector("h2")) ||
        button.querySelector("h2").textContent,
      subtitle:
        window.SonaryI18n?.originalText(button.querySelector("p")) ||
        button.querySelector("p").textContent,
      icon: button.querySelector(".bi").className,
      label: button.getAttribute("aria-label"),
    }));
                                                                                            
    const selecting = () => row.classList.contains("is-selection-mode");
    const translate = (text) => window.SonaryI18n?.translate(text) || text;
    const labels = ["Отменить", "Подтвердить"];
    const paint = () =>
      buttons.forEach((button, index) => {
        const title = selecting() ? labels[index] : normal[index].title;
        button.querySelector("h2").textContent = translate(title);
        button.querySelector("p").textContent = selecting()
          ? ""
          : translate(normal[index].subtitle);
        button.querySelector(".bi").className = selecting()
          ? `bi bi-${index ? "check-lg" : "x-lg"}`
          : normal[index].icon;
        button.setAttribute(
          "aria-label",
          translate(selecting() ? title : normal[index].label),
        );
        button.title = translate(title);
      });
    ["pointerdown", "click"].forEach((type) =>
      row.addEventListener(
        type,
        (event) => {
          if (!selecting()) return;
          const index = buttons.indexOf(
            event.target.closest(".diary-action-card"),
          );
          if (index < 0) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (type === "click" && !buttons[index].disabled)
            (index ? confirm : cancel)();
        },
        true,
      ),
    );
    document.addEventListener("sonary:language", paint);
    return {
      render(mode, selectedCount, availableCount) {
        row.classList.toggle("is-selection-mode", mode);
        buttons[0].disabled = false;
        buttons[1].disabled = mode ? selectedCount === 0 : availableCount === 0;
        paint();
      },
    };
  };
})();
