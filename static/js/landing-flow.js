document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('welcomeCard');
  const welcomeFooter = document.querySelector('.welcome-footer');
  const views = [...document.querySelectorAll('.welcome-view')];
  const state = { current: 'home', history: [] };
  const registrationForm = document.querySelector('[data-view="register-profile"]');
  const loginForm = document.querySelector('[data-view="login-name"]');
  const loginError = document.getElementById('loginIdentityError');
  const setLoginError = (message) => {
    loginForm.elements.identity.setAttribute('aria-invalid', 'true');
    loginError.textContent = message;
    loginError.hidden = false;
    loginForm.elements.identity.focus();
  };
  loginForm.elements.identity.addEventListener('input', () => {
    loginForm.elements.identity.removeAttribute('aria-invalid');
    loginError.hidden = true;
    loginError.textContent = '';
  });
  const routes = {
    'login-name': 'login-password',
    'login-password': null,
    'register-profile': 'register-agreement',
    'register-password': null,
  };

  const notify = (message, kind = 'error') => window.SonaryUI?.notify(window.SonaryI18n?.translate(message) || message, kind);
  const setRegistrationError = (field, message) => {
    const input = registrationForm?.elements.namedItem(field);
    const error = registrationForm?.querySelector(`#register${field === 'username' ? 'Username' : 'Email'}Error`);
    if (!input || !error) return;
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  };
  ['username', 'email'].forEach((field) => {
    const input = registrationForm?.elements.namedItem(field);
    input?.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      const error = registrationForm.querySelector(`#register${field === 'username' ? 'Username' : 'Email'}Error`);
      error.hidden = true;
      error.textContent = '';
    });
  });
  const queueSuccessSound = () => {
    try {
      if (sessionStorage.getItem('sonary-auth-sound-played') !== '1') {
        sessionStorage.setItem('sonary-auth-sound-pending', '1');
      }
    } catch { /* Audio preference must not block a successful sign-in. */ }
  };
  const show = (name, push = true) => {
    if (push && state.current !== name) state.history.push(state.current);
    state.current = name;
    views.forEach((view) => { view.hidden = view.dataset.view !== name; });
    const isArticle = ['about', 'faq', 'tos'].includes(name);
    const isHome = name === 'home';
    card.classList.toggle('is-article', isArticle);
    card.classList.toggle('is-flow', !isArticle && !isHome);
    card.classList.toggle('is-home', isHome);
    card.classList.toggle('is-agreement', name === 'register-agreement');
    document.body.classList.toggle('is-agreement-flow', name === 'register-agreement');
    welcomeFooter.hidden = name === 'register-agreement';
    if (name === 'register-agreement') syncAgreementIdentity();
    const firstInput = card.querySelector(`.welcome-view[data-view="${name}"] input`);
    if (name !== 'home' && name !== 'register-agreement') setTimeout(() => firstInput?.focus(), 220);
  };
  const back = () => show(state.history.pop() || 'home', false);
  const factorForm = document.querySelector('[data-view="login-factor"]');
  const emailForm = document.querySelector('[data-view="register-email"]');
  const t = text => window.SonaryI18n?.translate(text) || text;
  const authError = (form, message = '') => {
    const error = form.querySelector('[data-auth-error]');
    error.textContent = t(message); error.hidden = !message;
    form.elements.code.setAttribute('aria-invalid', String(!!message));
  };
  let factorMethod = null, factorRecovery = false, factorSent = false, factorBusy = false;
  const factorSend = factorForm.querySelector('[data-login-resend]');
  const factorUpdate = () => {
    factorForm.querySelector('[data-login-otp]').hidden = factorRecovery;
    factorForm.querySelector('[data-login-recovery-area]').hidden = !factorRecovery;
    factorForm.elements.code.disabled = factorBusy || (factorMethod === 'email' && !factorSent);
    factorForm.elements.recovery_code.disabled = factorBusy || !factorRecovery;
    factorSend.hidden = factorRecovery || factorMethod !== 'email';
    factorSend.disabled = factorBusy || factorCooldown.remaining() > 0;
    factorForm.querySelector('[data-login-recovery]').disabled = factorBusy;
    factorForm.querySelector('[data-login-recovery]').textContent = t(factorRecovery ? 'Использовать текущий способ' : 'Использовать резервный код');
    factorForm.querySelector('[type="submit"]').disabled = factorBusy || (factorRecovery ? !factorForm.elements.recovery_code.value.trim() : factorForm.elements.code.disabled || !/^\d{6}$/.test(factorForm.elements.code.value));
    window.SonaryInputs.sync(factorForm.elements.code);
  };
  const factorCooldown = window.SonaryInputs.cooldown(factorSend, seconds => {
    factorSend.textContent = seconds ? t('Повторная отправка через {seconds} с').replace('{seconds}', seconds) : t(factorSent ? 'Отправить повторно' : 'Отправить код');
    factorUpdate();
  });
  factorForm.querySelector('[data-login-recovery]').addEventListener('click', () => {
    factorRecovery = !factorRecovery;
    factorForm.elements.code.value = factorForm.elements.recovery_code.value = '';
    authError(factorForm); factorUpdate();
    (factorRecovery ? factorForm.elements.recovery_code : factorForm.elements.code).focus();
  });
  factorForm.addEventListener('input', () => { window.SonaryInputs.sync(factorForm.elements.code); authError(factorForm); factorUpdate(); });
  document.querySelector('[data-login-resend]')?.addEventListener('click', async event => {
    if (factorBusy || factorCooldown.remaining()) return;
    factorBusy = true; authError(factorForm); factorUpdate();
    try {
      await window.SonaryAuth.submit('second-factor/resend', new FormData());
      factorSent = true;
      factorForm.elements.code.value = '';
      factorCooldown.start(60);
      factorForm.querySelector('[data-auth-status]').textContent = t('Код отправлен. Проверьте почту.');
    } catch (error) { authError(factorForm, error.message); if (error.retryAfter) factorCooldown.start(error.retryAfter); }
    finally { factorBusy = false; factorUpdate(); if (factorSent) factorForm.elements.code.focus(); }
  });
  let emailBusy = false, emailSent = false;
  const emailSend = emailForm.querySelector('[data-registration-resend]');
  const emailUpdate = () => {
    emailForm.elements.code.disabled = emailBusy || !emailSent;
    emailSend.disabled = emailBusy || emailCooldown.remaining() > 0;
    emailForm.querySelector('[data-correct-email]').disabled = emailBusy;
    emailForm.querySelector('[type="submit"]').disabled = emailBusy || !emailSent || !/^\d{6}$/.test(emailForm.elements.code.value);
    window.SonaryInputs.sync(emailForm.elements.code);
  };
  const emailCooldown = window.SonaryInputs.cooldown(emailSend, seconds => {
    emailSend.textContent = seconds ? t('Повторная отправка через {seconds} с').replace('{seconds}', seconds) : t(emailSent ? 'Отправить повторно' : 'Отправить код');
    emailUpdate();
  });
  const registrationPending = result => {
    emailSent = result.email_sent;
    emailForm.elements.code.value = '';
    emailForm.querySelector('[data-registration-email]').textContent = result.email;
    emailForm.querySelector('[data-registration-description]').textContent = t(emailSent ? 'Мы отправили шестизначный код на указанный адрес.' : 'Подтвердите адрес, чтобы завершить регистрацию.');
    emailForm.querySelector('[data-auth-status]').textContent = '';
    registrationForm.elements.username.value = result.username;
    registrationForm.elements.email.value = result.email;
    authError(emailForm, result.delivery_error || '');
    emailCooldown.start(result.resend_after || 0);
    show('register-email'); emailUpdate();
  };
  emailForm.addEventListener('input', () => { window.SonaryInputs.sync(emailForm.elements.code); authError(emailForm); emailUpdate(); });
  emailForm.querySelector('[data-correct-email]').addEventListener('click', () => show('register-profile'));
  emailSend.addEventListener('click', async () => {
    if (emailBusy || emailCooldown.remaining()) return;
    emailBusy = true; authError(emailForm); emailUpdate();
    try {
      const result = await window.SonaryAuth.submit('registration/resend', new FormData());
      registrationPending(result);
      emailForm.querySelector('[data-auth-status]').textContent = t('Код отправлен. Проверьте почту.');
    } catch (error) { authError(emailForm, error.message); if (error.retryAfter) emailCooldown.start(error.retryAfter); }
    finally { emailBusy = false; emailUpdate(); if (emailSent) emailForm.elements.code.focus(); }
  });

  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => show(button.dataset.go)));
  document.querySelector('[data-landing-logout]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await window.SonaryAuth.submit('logout', new FormData());
      location.href = result.redirect;
    } catch (error) { notify(error.message); button.disabled = false; }
  });
  document.querySelectorAll('.welcome-article [data-back]').forEach((button) => {
    const toolbar = document.createElement('div');
    toolbar.className = 'welcome-article-toolbar';
    button.before(toolbar);
    toolbar.append(button);
  });
  document.querySelectorAll('[data-back]').forEach((button) => {
    button.textContent = '← Назад';
    button.setAttribute('aria-label', 'Назад');
    button.addEventListener('click', back);
  });

  const agreement = document.querySelector('[data-view="register-agreement"]');
  const signaturePad = agreement?.querySelector('[data-signature-pad]');
  const agreementConfirm = agreement?.querySelector('[data-confirm-agreement]');
  const requiredConsents = agreement ? [...agreement.querySelectorAll('.agreement-required')] : [];
  let hasSignature = false;

  const syncAgreementIdentity = () => {
    if (!agreement) return;
    const username = document.querySelector('[data-view="register-profile"] [name="username"]')?.value.trim() || 'НИКНЕЙМ';
    agreement.querySelector('[data-agreement-name]').textContent = username.toUpperCase();
    agreement.querySelector('[data-agreement-date]').textContent = new Intl.DateTimeFormat('ru-RU').format(new Date());
  };
  const updateAgreementConfirmation = () => {
    if (agreementConfirm) agreementConfirm.disabled = !(hasSignature && requiredConsents.every((checkbox) => checkbox.checked));
  };

  if (signaturePad) {
    const context = signaturePad.getContext('2d');
    let isDrawing = false;
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1e1b18';
    const point = (event) => {
      const rect = signaturePad.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (signaturePad.width / rect.width), y: (event.clientY - rect.top) * (signaturePad.height / rect.height) };
    };
    signaturePad.addEventListener('pointerdown', (event) => {
      isDrawing = true;
      signaturePad.setPointerCapture(event.pointerId);
      const start = point(event);
      context.beginPath();
      context.moveTo(start.x, start.y);
    });
    signaturePad.addEventListener('pointermove', (event) => {
      if (!isDrawing) return;
      const next = point(event);
      context.lineTo(next.x, next.y);
      context.stroke();
      hasSignature = true;
      updateAgreementConfirmation();
    });
    signaturePad.addEventListener('pointerup', () => { isDrawing = false; });
    signaturePad.addEventListener('pointercancel', () => { isDrawing = false; });
    agreement.querySelector('[data-clear-signature]').addEventListener('click', () => {
      context.clearRect(0, 0, signaturePad.width, signaturePad.height);
      hasSignature = false;
      updateAgreementConfirmation();
    });
  }
  requiredConsents.forEach((checkbox) => checkbox.addEventListener('change', updateAgreementConfirmation));
  agreementConfirm?.addEventListener('click', () => { if (!agreementConfirm.disabled) show('register-password'); });

  document.querySelectorAll('.welcome-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const view = form.dataset.view;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (view === 'login-factor') {
      if (factorBusy) return;
      const data = new FormData();
      data.set('code', factorRecovery ? form.elements.recovery_code.value : form.elements.code.value);
      data.set('recovery', factorRecovery ? '1' : '0');
      factorBusy = true; authError(form); factorUpdate();
      try {
        const result = await window.SonaryAuth.submit('second-factor', data);
        form.reset();
        queueSuccessSound();
        location.href = result.redirect;
      } catch (error) { authError(form, error.message); }
      finally { factorBusy = false; factorUpdate(); }
      return;
    }
    if (view === 'register-email') {
      if (emailBusy) return;
      const data = new FormData(form);
      emailBusy = true; authError(form); emailUpdate();
      try {
        const result = await window.SonaryAuth.submit('registration/confirm', data);
        form.reset(); queueSuccessSound(); location.href = result.redirect;
      } catch (error) {
        if (error.field === 'username' || error.field === 'email') { show('register-profile'); setRegistrationError(error.field, error.message); }
        else authError(form, error.message);
      } finally { emailBusy = false; emailUpdate(); }
      return;
    }
    if (view === 'login-name') {
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const identity = form.elements.identity.value;
        const result = await window.SonaryAuth.submit('check-identity', new FormData(form));
        if (state.current !== view || form.elements.identity.value !== identity) return;
        if (result.exists) show('login-password');
        else setLoginError(result.error);
      } catch (error) { setLoginError(error.sourceMessage || error.message); }
      finally { submit.disabled = false; }
      return;
    }
    if (view === 'register-profile') {
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const username = form.elements.username.value;
        const email = form.elements.email.value;
        const availability = await window.SonaryAuth.submit('check-registration', new FormData(form));
        if (state.current !== view || form.elements.username.value !== username || form.elements.email.value !== email) return;
        if (!availability.username_available) {
          setRegistrationError('username', 'Этот логин уже занят.');
        }
        if (!availability.email_available) {
          setRegistrationError('email', 'Эта почта уже занята.');
        }
        if (availability.username_available && availability.email_available) show(routes[view]);
        else form.querySelector('[aria-invalid="true"]')?.focus();
      } catch (error) {
        if (error.field === 'username' || error.field === 'email') setRegistrationError(error.field, error.sourceMessage || error.message);
        else notify(error.message);
      } finally { submit.disabled = false; }
      return;
    }
    if (view === 'login-password' || view === 'register-password') {
      const data = new FormData(form);
      if (view === 'login-password') {
        data.set('identity', document.querySelector('[name="identity"]').value);
      } else {
        const profile = document.querySelector('[data-view="register-profile"]');
        data.set('username', profile.querySelector('[name="username"]').value);
        data.set('email', profile.querySelector('[name="email"]').value);
      }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const result = await window.SonaryAuth.submit(view === 'login-password' ? 'login' : 'register', data);
        if (result.requires_2fa) {
          form.reset();
          factorForm.reset();
          factorMethod = result.method;
          factorRecovery = false; factorSent = result.email_sent;
          authError(factorForm);
          factorForm.querySelector('[data-login-email]').textContent = result.masked_email;
          factorForm.querySelector('[data-login-email]').hidden = result.method !== 'email';
          factorForm.querySelector('[data-auth-status]').textContent = result.method === 'email' ? t(result.email_sent ? 'Код отправлен. Проверьте почту.' : 'Письмо пока не отправлено. Повторите отправку или используйте резервный код.') : '';
          document.querySelector('[data-login-factor-message]').textContent = t(result.method === 'totp' ? 'Введите код из приложения-аутентификатора' : 'Получите код на email аккаунта.');
          factorCooldown.start(result.resend_after || 0); factorUpdate();
          show('login-factor');
          return;
        }
        if (result.requires_email_verification) {
          form.reset(); registrationPending(result); return;
        }
        queueSuccessSound();
        location.href = result.redirect;
      } catch (error) {
        if (view === 'register-password' && (error.field === 'username' || error.field === 'email')) {
          show('register-profile');
          setRegistrationError(error.field, error.sourceMessage || error.message);
          registrationForm.elements.namedItem(error.field)?.focus();
        } else notify(error.message);
      }
      finally { submit.disabled = false; }
      return;
    }
    show(routes[view]);
  }));

  if (!document.querySelector('[data-landing-logout]')) {
    if (new URLSearchParams(location.search).get('auth') === 'login') show('login-name', false);
    if (new URLSearchParams(location.search).get('auth') === 'register') show('register-profile', false);
  }
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  if (['about', 'tos', 'faq'].includes(requestedPage)) show(requestedPage, false);
  if (!document.querySelector('[data-landing-logout]') && !requestedPage) {
    fetch('/auth/registration/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (result?.pending && (state.current === 'home' || (state.current === 'register-profile' && !registrationForm.elements.username.value))) registrationPending(result); })
      .catch(() => {});
  }
});
