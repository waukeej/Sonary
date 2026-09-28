document.addEventListener("DOMContentLoaded", () => {
  const selectionDialog = document.getElementById("deleteSelectionDialog");
  const warningDialog = document.getElementById("deleteWarningDialog");
  if (!selectionDialog || !warningDialog) return;
  let finish = () => {};
  let performDelete = null;
  let currentEntityName = "записи";
  const hideAll = () => {
    window.SonaryModal?.close(selectionDialog);
    window.SonaryModal?.close(warningDialog);
  };
  const cancelProcess = () => {
    hideAll();
    finish();
  };
  const permanentDeleteLabels = {
    трек: "Трек будет удалён навсегда",
    треки: "Треки будут удалены навсегда",
    плейлист: "Плейлист будет удалён навсегда",
    плейлисты: "Плейлисты будут удалены навсегда",
    отзыв: "Отзыв будет удалён навсегда",
  };
  const deletedLabels = {
    трек: "Трек удалён.",
    треки: "Треки удалены.",
    плейлист: "Плейлист удалён.",
    плейлисты: "Плейлисты удалены.",
    отзыв: "Отзыв удалён.",
    записи: "Записи удалены.",
  };

  window.openDeleteMockDialogs = (
    cards,
    onFinish,
    entityName = "записи",
    operation = null,
  ) => {
    performDelete = operation;
    finish = onFinish || (() => {});
    currentEntityName = entityName;
    selectionDialog.querySelector("#deleteSelectionTitle").textContent =
      `Вы хотите удалить ${entityName}`;
    warningDialog.querySelector("#deleteWarningTitle").textContent =
      entityName === "связи с плейлистом"
        ? window.SonaryI18n.t("playlist_backend.remove_only")
        : permanentDeleteLabels[entityName] || "Запись будет удалена навсегда";
    selectionDialog.querySelector(".delete-dialog-text").textContent =
      entityName === "связи с плейлистом"
        ? window.SonaryI18n.t("playlist_backend.remove_only")
        : "Выбранные записи будут удалены без возможности восстановления.";
    warningDialog.querySelector(".delete-dialog-text").textContent =
      entityName === "связи с плейлистом"
        ? window.SonaryI18n.t("playlist_backend.remove_only")
        : "После подтверждения восстановить её будет невозможно.";
    window.SonaryModal?.open(selectionDialog);
  };
  selectionDialog
    .querySelector(".delete-dialog-cancel")
    .addEventListener("click", cancelProcess);
  warningDialog
    .querySelector(".delete-warning-cancel")
    .addEventListener("click", cancelProcess);
  selectionDialog
    .querySelector(".delete-dialog-next")
    .addEventListener("click", () =>
      window.SonaryModal?.swap(selectionDialog, warningDialog),
    );
  warningDialog
    .querySelector(".delete-warning-confirm")
    .addEventListener("click", async (event) => {
      if (performDelete) {
        event.currentTarget.disabled = true;
        try {
          if (await performDelete()) {
            hideAll();
            finish();
          }
        } finally {
          warningDialog.querySelector(".delete-warning-confirm").disabled =
            false;
        }
        return;
      }
      hideAll();
      finish();
      window.SonaryUI?.notify(
        deletedLabels[currentEntityName] || "Удаление завершено.",
      );
    });
  [selectionDialog, warningDialog].forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) cancelProcess();
    }),
  );
});
