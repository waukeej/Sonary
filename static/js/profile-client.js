(() => {
  const clearErrors = (root) => {
    root.querySelectorAll("[data-profile-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    root
      .querySelectorAll("[aria-invalid]")
      .forEach((el) => el.removeAttribute("aria-invalid"));
  };
  const showErrors = (root, errors) => {
    Object.entries(errors).forEach(([field, message]) => {
      const node =
        [...root.querySelectorAll("[data-profile-error]")].find(
          (el) => el.dataset.profileError === field,
        ) || root.querySelector('[data-profile-error="form"]');
      if (node) {
        node.textContent = message;
        node.hidden = false;
      }
      [...root.querySelectorAll("[name]")]
        .find((el) => el.name === field)
        ?.setAttribute("aria-invalid", "true");
    });
    root.querySelector('[aria-invalid="true"]')?.focus();
  };
  const apply = (profile) => {
    document.querySelectorAll("[data-profile-field]").forEach((el) => {
      el.textContent = profile[el.dataset.profileField] ?? "";
    });
    document.querySelectorAll("[data-profile-username]").forEach((el) => {
      el.textContent = "@" + profile.username;
    });
    const roots = [
      document.getElementById("settingsModal"),
      document.getElementById("profileEditModal"),
    ];
    roots.forEach((root) =>
      root
        ?.querySelectorAll(
          'input[name]:not([type="file"]),textarea[name],select[name]',
        )
        .forEach((input) => {
          if (!(input.name in profile)) return;
          input.value = profile[input.name];
          if ("defaultValue" in input) input.defaultValue = input.value;
        }),
    );
    if (profile.avatar_url) window.SonaryAvatar?.setCustom(profile.avatar_url);
    document.dispatchEvent(
      new CustomEvent("sonary:profile-saved", { detail: profile }),
    );
  };
  window.SonaryProfile = {
    clearErrors,
    showErrors,
    async save(root, data, button) {
      clearErrors(root);
      button.disabled = true;
      try {
        const result = await window.SonaryAuth.request(
          "/settings/profile",
          data,
        );
        apply(result.profile);
        window.SonaryUI?.notify("Профиль сохранён.");
        return true;
      } catch (error) {
        showErrors(
          root,
          error.fields || { form: error.sourceMessage || error.message },
        );
        return false;
      } finally {
        button.disabled = false;
      }
    },
  };
})();
