document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("welcomeCard");
  const welcomeFooter = document.querySelector(".welcome-footer");
  const views = [...document.querySelectorAll(".welcome-view")];
  const state = { current: "home", history: [] };
  const registrationForm = document.querySelector(
    '[data-view="register-profile"]',
  );
  const loginForm = document.querySelector('[data-view="login-name"]');
  const loginError = document.getElementById("loginIdentityError");
  const setLoginError = (message) => {
    loginForm.elements.identity.setAttribute("aria-invalid", "true");
    loginError.textContent = message;
    loginError.hidden = false;
    loginForm.elements.identity.focus();
  };
  loginForm.elements.identity.addEventListener("input", () => {
    loginForm.elements.identity.removeAttribute("aria-invalid");
    loginError.hidden = true;
    loginError.textContent = "";
  });
  const routes = {
    "login-name": "login-password",
    "login-password": null,
    "register-profile": "register-agreement",
    "register-password": null,
  };

  const notify = (message, kind = "error") =>
    window.SonaryUI?.notify(
      window.SonaryI18n?.translate(message) || message,
      kind,
    );
  const setRegistrationError = (field, message) => {
    const input = registrationForm?.elements.namedItem(field);
    const error = registrationForm?.querySelector(
      `#register${field === "username" ? "Username" : "Email"}Error`,
    );
    if (!input || !error) return;
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.hidden = false;
  };
  ["username", "email"].forEach((field) => {
    const input = registrationForm?.elements.namedItem(field);
    input?.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      const error = registrationForm.querySelector(
        `#register${field === "username" ? "Username" : "Email"}Error`,
      );
      error.hidden = true;
      error.textContent = "";
    });
  });
  const queueSuccessSound = () => {
    try {
      if (sessionStorage.getItem("sonary-auth-sound-played") !== "1") {
        sessionStorage.setItem("sonary-auth-sound-pending", "1");
      }
    } catch {
                                                                 
    }
  };
  const show = (name, push = true) => {
    if (push && state.current !== name) state.history.push(state.current);
    state.current = name;
    views.forEach((view) => {
      view.hidden = view.dataset.view !== name;
    });
    const isArticle = ["about", "faq", "tos"].includes(name);
    const isHome = name === "home";
    card.classList.toggle("is-article", isArticle);
    card.classList.toggle("is-flow", !isArticle && !isHome);
    card.classList.toggle("is-home", isHome);
    card.classList.toggle("is-agreement", name === "register-agreement");
    document.body.classList.toggle(
      "is-agreement-flow",
      name === "register-agreement",
    );
    welcomeFooter.hidden = name === "register-agreement";
    if (name === "register-agreement") syncAgreementIdentity();
    const firstInput = card.querySelector(
      `.welcome-view[data-view="${name}"] input`,
    );
    if (name !== "home" && name !== "register-agreement")
      setTimeout(() => firstInput?.focus(), 220);
  };
  const back = () => show(state.history.pop() || "home", false);

  document
    .querySelectorAll("[data-go]")
    .forEach((button) =>
      button.addEventListener("click", () => show(button.dataset.go)),
    );
  document
    .querySelector("[data-landing-logout]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await window.SonaryAuth.submit("logout", new FormData());
        location.href = result.redirect;
      } catch (error) {
        notify(error.message);
        button.disabled = false;
      }
    });
  document
    .querySelectorAll(".welcome-article [data-back]")
    .forEach((button) => {
      const toolbar = document.createElement("div");
      toolbar.className = "welcome-article-toolbar";
      button.before(toolbar);
      toolbar.append(button);
    });
  document.querySelectorAll("[data-back]").forEach((button) => {
    button.textContent = "← Назад";
    button.setAttribute("aria-label", "Назад");
    button.addEventListener("click", back);
  });

  const agreement = document.querySelector('[data-view="register-agreement"]');
  const signaturePad = agreement?.querySelector("[data-signature-pad]");
  const agreementConfirm = agreement?.querySelector("[data-confirm-agreement]");
  const requiredConsents = agreement
    ? [...agreement.querySelectorAll(".agreement-required")]
    : [];
  let hasSignature = false;

  const syncAgreementIdentity = () => {
    if (!agreement) return;
    const username =
      document
        .querySelector('[data-view="register-profile"] [name="username"]')
        ?.value.trim() || "НИКНЕЙМ";
    agreement.querySelector("[data-agreement-name]").textContent =
      username.toUpperCase();
    agreement.querySelector("[data-agreement-date]").textContent =
      new Intl.DateTimeFormat("ru-RU").format(new Date());
  };
  const updateAgreementConfirmation = () => {
    if (agreementConfirm)
      agreementConfirm.disabled = !(
        hasSignature && requiredConsents.every((checkbox) => checkbox.checked)
      );
  };

  if (signaturePad) {
    const context = signaturePad.getContext("2d");
    let isDrawing = false;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1e1b18";
    const point = (event) => {
      const rect = signaturePad.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (signaturePad.width / rect.width),
        y: (event.clientY - rect.top) * (signaturePad.height / rect.height),
      };
    };
    signaturePad.addEventListener("pointerdown", (event) => {
      isDrawing = true;
      signaturePad.setPointerCapture(event.pointerId);
      const start = point(event);
      context.beginPath();
      context.moveTo(start.x, start.y);
    });
    signaturePad.addEventListener("pointermove", (event) => {
      if (!isDrawing) return;
      const next = point(event);
      context.lineTo(next.x, next.y);
      context.stroke();
      hasSignature = true;
      updateAgreementConfirmation();
    });
    signaturePad.addEventListener("pointerup", () => {
      isDrawing = false;
    });
    signaturePad.addEventListener("pointercancel", () => {
      isDrawing = false;
    });
    agreement
      .querySelector("[data-clear-signature]")
      .addEventListener("click", () => {
        context.clearRect(0, 0, signaturePad.width, signaturePad.height);
        hasSignature = false;
        updateAgreementConfirmation();
      });
  }
  requiredConsents.forEach((checkbox) =>
    checkbox.addEventListener("change", updateAgreementConfirmation),
  );
  agreementConfirm?.addEventListener("click", () => {
    if (!agreementConfirm.disabled) show("register-password");
  });

  document.querySelectorAll("[data-code-boxes]").forEach((box) => {
    const digits = [...box.querySelectorAll("input")];
    digits.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && digits[index + 1]) digits[index + 1].focus();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && digits[index - 1])
          digits[index - 1].focus();
      });
      input.addEventListener("paste", (event) => {
        const values = event.clipboardData
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, 5)
          .split("");
        if (!values.length) return;
        event.preventDefault();
        values.forEach((value, valueIndex) => {
          if (digits[valueIndex]) digits[valueIndex].value = value;
        });
        digits[Math.min(values.length, 5) - 1].focus();
      });
    });
  });

  document.querySelectorAll(".welcome-form").forEach((form) =>
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const view = form.dataset.view;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (view === "login-name") {
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const identity = form.elements.identity.value;
          const result = await window.SonaryAuth.submit(
            "check-identity",
            new FormData(form),
          );
          if (
            state.current !== view ||
            form.elements.identity.value !== identity
          )
            return;
          if (result.exists) show("login-password");
          else setLoginError(result.error);
        } catch (error) {
          setLoginError(error.sourceMessage || error.message);
        } finally {
          submit.disabled = false;
        }
        return;
      }
      if (view === "register-profile") {
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const username = form.elements.username.value;
          const email = form.elements.email.value;
          const availability = await window.SonaryAuth.submit(
            "check-registration",
            new FormData(form),
          );
          if (
            state.current !== view ||
            form.elements.username.value !== username ||
            form.elements.email.value !== email
          )
            return;
          if (!availability.username_available) {
            setRegistrationError("username", "Этот логин уже занят.");
          }
          if (!availability.email_available) {
            setRegistrationError("email", "Эта почта уже занята.");
          }
          if (availability.username_available && availability.email_available)
            show(routes[view]);
          else form.querySelector('[aria-invalid="true"]')?.focus();
        } catch (error) {
          if (error.field === "username" || error.field === "email")
            setRegistrationError(
              error.field,
              error.sourceMessage || error.message,
            );
          else notify(error.message);
        } finally {
          submit.disabled = false;
        }
        return;
      }
      if (view === "login-password" || view === "register-password") {
        const data = new FormData(form);
        if (view === "login-password") {
          data.set(
            "identity",
            document.querySelector('[name="identity"]').value,
          );
        } else {
          const profile = document.querySelector(
            '[data-view="register-profile"]',
          );
          data.set(
            "username",
            profile.querySelector('[name="username"]').value,
          );
          data.set("email", profile.querySelector('[name="email"]').value);
        }
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const result = await window.SonaryAuth.submit(
            view === "login-password" ? "login" : "register",
            data,
          );
          queueSuccessSound();
          location.href = result.redirect;
        } catch (error) {
          if (
            view === "register-password" &&
            (error.field === "username" || error.field === "email")
          ) {
            show("register-profile");
            setRegistrationError(
              error.field,
              error.sourceMessage || error.message,
            );
            registrationForm.elements.namedItem(error.field)?.focus();
          } else notify(error.message);
        } finally {
          submit.disabled = false;
        }
        return;
      }
      show(routes[view]);
    }),
  );

  if (!document.querySelector("[data-landing-logout]")) {
    if (new URLSearchParams(location.search).get("auth") === "login")
      show("login-name", false);
    if (new URLSearchParams(location.search).get("auth") === "register")
      show("register-profile", false);
  }
  const requestedPage = new URLSearchParams(window.location.search).get("page");
  if (["about", "tos", "faq"].includes(requestedPage))
    show(requestedPage, false);
});
