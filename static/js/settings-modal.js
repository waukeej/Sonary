document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("settingsModal");
  const openButton = document.getElementById("openSettingsBtn");
  const closeButton = document.getElementById("closeSettingsBtn");
  const closeModal = () => {
    if (window.SonarySecurity?.cancelGate()) return;
    window.SonaryModal?.close(modal);
  };

  if (closeButton) {
    const icon = document.createElement("i");
    icon.className = "bi bi-x-lg";
    icon.setAttribute("aria-hidden", "true");
    closeButton.replaceChildren(icon);
  }

  openButton?.addEventListener("click", () => {
    window.SonaryModal?.open(modal);
  });
  closeButton?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  modal?.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      if (tab.dataset.settingsTab !== "security") window.SonarySecurity?.leave();
      modal
        .querySelectorAll(".settings-tab, .settings-panel")
        .forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      modal
        .querySelector(`#settings-${tab.dataset.settingsTab}`)
        .classList.add("active");
      modal.querySelector(".settings-footer").hidden = tab.dataset.settingsTab === "security";
      if (tab.dataset.settingsTab === "security") window.SonarySecurity?.load();
    });
  });

  const accountInputs = [
    ...(modal?.querySelectorAll("[data-account-input]") || []),
  ];
  const accountEdits = [
    ...(modal?.querySelectorAll("[data-edit-account-field]") || []),
  ];
  const lockAccountInputs = (activeInput = null) => {
    accountInputs.forEach((input) => {
      const isActive = input === activeInput;
      input.readOnly = !isActive;
      input.classList.toggle("is-editing", isActive);
    });
    accountEdits.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.editAccountField === activeInput?.id),
      ),
    );
  };

  lockAccountInputs();
  accountEdits.forEach((button) => {
    button.addEventListener("click", () => {
      const input = modal.querySelector(`#${button.dataset.editAccountField}`);
      if (!input) return;
      lockAccountInputs(input);
      input.focus();
      input.select();
    });
  });
  modal
    ?.querySelector(".settings-footer button")
    ?.addEventListener("click", async (event) => {
      const panel = modal.querySelector(".settings-panel.active");
      if (panel.id === "settings-general") {
        window.SonaryUI?.notify("Настройки сохранены.");
        return;
      }
      const data = new FormData();
      panel
        .querySelectorAll("[name]:not(:disabled)")
        .forEach((input) => data.set(input.name, input.value));
      if (await window.SonaryProfile.save(modal, data, event.currentTarget))
        lockAccountInputs();
    });
});
