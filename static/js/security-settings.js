document.addEventListener('DOMContentLoaded', () => {
  const settings = document.getElementById('settingsModal');
  const panel = document.getElementById('settings-security');
  const modal = document.getElementById('securityFlowModal');
  if (!panel || !modal) return;
  const p = name => panel.querySelector(`[data-security-${name}]`);
  const f = name => modal.querySelector(`[data-flow-${name}]`);
  const t = text => window.SonaryI18n?.translate(text) || text;
  const name = method => t(method === 'totp' ? 'Приложение-аутентификатор' : 'Электронная почта');
  let state = {}, operation, stage, busy = false, generation = 0, recovery = false, sent = false, prepared = false, returnFocus;
  const request = (path, values = {}) => {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return window.SonaryAuth.request('/settings/security/' + path, data);
  };
  const error = message => {
    f('error').textContent = t(message || '');
    f('error').hidden = !message;
    const input = stage === 'password' ? f('password') : recovery ? f('recovery-code') : f('code');
    input.setAttribute('aria-invalid', String(!!message));
  };
  const syncSlots = () => {
    window.SonaryInputs.sync(f('code'));
  };
  const controls = () => {
    modal.querySelectorAll('input, button').forEach(node => { node.disabled = busy; });
    settings.querySelectorAll('.settings-tab').forEach(node => { node.disabled = busy; });
    f('submit').disabled = busy || stage === 'checking' || (stage === 'setup' && !prepared) || (stage === 'factor' && state.primary === 'email' && !recovery && !sent);
    f('code').disabled = busy || (stage === 'factor' && state.primary === 'email' && !sent) || (stage === 'setup' && !prepared);
    if (stage === 'factor' || stage === 'setup') f('submit').disabled ||= recovery && stage === 'factor' ? !f('recovery-code').value.trim() : !/^\d{6}$/.test(f('code').value);
    f('send').disabled = busy || sendCooldown.remaining() > 0;
    syncSlots();
  };
  const sendCooldown = window.SonaryInputs.cooldown(f('send'), seconds => {
    const sentAlready = stage === 'factor' ? sent : prepared;
    f('send').textContent = seconds ? t('Повторная отправка через {seconds} с').replace('{seconds}', seconds) : t(sentAlready ? 'Отправить повторно' : 'Отправить код');
    f('send').disabled = busy || seconds > 0;
  });
  const focusInput = () => {
    const target = stage === 'password' ? f('password') : !f('recovery-area').hidden ? f('recovery-code') : !f('code-area').hidden && !f('code').disabled ? f('code') : !f('send').hidden ? f('send') : f('submit');
    target.focus();
  };
  const run = async task => {
    if (busy) return;
    busy = true;
    const stamp = generation;
    error('');
    controls();
    try { await task(() => stamp === generation && !settings.hidden); }
    catch (failure) {
      if (stamp === generation) {
        if (stage === 'checking') { stage = 'password'; show(); }
        error(failure.message);
        if (failure.retryAfter) sendCooldown.start(failure.retryAfter);
        if (failure.sourceMessage === 'Подтверждение истекло. Начните заново.') {
          panel.hidden = true;
          modal.hidden = false;
          recovery = sent = false;
          stage = 'password';
          show();
          error(failure.message);
        }
      }
    } finally {
      busy = false;
      controls();
      if (stamp === generation && !modal.hidden) focusInput();
      else if (stamp !== generation) await request('gate', { step: 'cancel' }).catch(() => {});
    }
  };
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text) element.textContent = t(text);
    if (cls) element.className = cls;
    return element;
  };
  const actionButton = (label, action, method, danger = false) => {
    const button = node('button', label, 'settings-secondary' + (danger ? 'security-danger' : ''));
    button.type = 'button';
    button.addEventListener('click', () => begin(action, method, button));
    return button;
  };
  const render = next => {
    state = { ...state, ...next };
    p('connected-list').replaceChildren();
    p('available-list').replaceChildren();
    ['totp', 'email', 'telegram'].forEach(method => {
      const enabled = !!state[method];
      const card = node('article', '', 'security-method-card');
      const icon = node('i', '', 'bi ' + (method === 'totp' ? 'bi-shield-lock' : method === 'email' ? 'bi-envelope' : 'bi-telegram'));
      icon.setAttribute('aria-hidden', 'true');
      const info = node('div', '', 'security-method-info');
      const title = node('strong', method === 'telegram' ? 'Telegram' : name(method));
      const description = node('p', method === 'totp' ? 'Используйте приложение для кодов.' : method === 'telegram' ? 'Подтверждение через Telegram.' : 'Получайте код на email аккаунта.');
      if (enabled && method === 'email') description.textContent = t('Код отправляется на') + ' ' + state.masked_email;
      info.append(title, description);
      card.append(icon, info);
      const actions = node('div', '', 'security-method-actions');
      if (enabled) {
        const badge = node('span', state.primary === method ? 'Основной' : 'Подключён', 'security-method-badge');
        badge.prepend('✓ ');
        actions.append(badge);
        const menu = node('details', '', 'security-method-menu');
        const summary = node('summary', '•••');
        summary.setAttribute('aria-label', t('Действия') + ': ' + name(method));
        const options = node('div', '', 'security-menu-options');
        if (state.primary !== method) options.append(actionButton('Сделать основным', 'primary', method));
        options.append(actionButton('Перенастроить', 'setup', method), actionButton('Отключить', 'disable', method, true));
        menu.append(summary, options);
        menu.addEventListener('toggle', () => {
          if (menu.open) panel.querySelectorAll('details').forEach(other => { if (other !== menu) other.open = false; });
        });
        actions.append(menu);
      } else if (method === 'telegram') {
        const soon = node('button', 'Скоро', 'settings-secondary');
        soon.disabled = true;
        actions.append(soon);
      } else actions.append(actionButton('Настроить', 'setup', method));
      card.append(actions);
      p(enabled ? 'connected-list' : 'available-list').append(card);
    });
    p('connected').hidden = !state.enabled;
    p('available').hidden = false;
    p('status').textContent = '';
  };
  const show = () => {
    error('');
    f('notice').textContent = '';
    f('password').value = '';
    f('code').value = '';
    f('recovery-code').value = '';
    f('password-area').hidden = stage !== 'password';
    f('email').hidden = true;
    f('send').hidden = true;
    f('totp').hidden = true;
    f('code-area').hidden = true;
    f('recovery-area').hidden = true;
    f('recovery').hidden = stage !== 'factor';
    f('codes-area').hidden = stage !== 'codes';
    f('submit').classList.toggle('security-danger', stage === 'confirm' && operation.action === 'disable');
    f('submit').textContent = t('Подтвердить');
    const title = document.getElementById('securityFlowTitle');
    title.textContent = t('Подтвердите, что это вы');
    f('description').textContent = '';
    if (stage === 'checking') {
      f('description').textContent = t('Загрузка…');
    } else if (stage === 'password') {
      f('submit').textContent = t('Продолжить');
      f('qr').removeAttribute('src');
      f('secret').textContent = '';
      prepared = false;
    } else if (stage === 'factor') {
      f('description').textContent = t(recovery ? 'Введите резервный код' : state.primary === 'totp' ? 'Введите код из приложения-аутентификатора' : 'Получите код на email аккаунта.');
      f('email').hidden = recovery || state.primary !== 'email';
      f('email').textContent = state.masked_email;
      f('send').hidden = recovery || state.primary !== 'email';
      f('send').textContent = t(sent ? 'Отправить повторно' : 'Отправить код');
      f('code-area').hidden = recovery;
      f('recovery-area').hidden = !recovery;
      f('recovery').textContent = t(recovery ? 'Использовать текущий способ' : 'Использовать резервный код');
    } else if (stage === 'setup') {
      title.textContent = name(operation.method);
      f('description').textContent = t(operation.method === 'totp' ? 'Отсканируйте QR в приложении-аутентификаторе или добавьте ключ вручную.' : 'Получайте код на email аккаунта.');
      f('email').hidden = operation.method !== 'email';
      f('email').textContent = state.masked_email;
      f('send').hidden = operation.method !== 'email';
      f('send').textContent = t(prepared ? 'Отправить повторно' : 'Отправить код');
      f('totp').hidden = operation.method !== 'totp' || !prepared;
      f('code-area').hidden = false;
      f('submit').textContent = t('Подключить');
    } else if (stage === 'confirm') {
      title.textContent = t('Отключить способ?');
      f('description').textContent = name(operation.method) + '. ' + t(state.email && state.totp ? 'Вы больше не сможете использовать этот способ для подтверждения входа.' : 'После этого двухфакторная аутентификация будет отключена.');
      f('submit').textContent = t('Отключить');
    } else if (stage === 'codes') {
      title.textContent = t('Резервные коды');
      f('description').textContent = t('Сохраните эти коды в безопасном месте. Каждый код можно использовать только один раз.') + ' ' + t('После закрытия этого окна коды нельзя будет посмотреть повторно.');
      f('submit').textContent = t('Готово');
    }
    syncSlots();
    controls();
  };
  const clearSecrets = () => {
    f('password').value = f('code').value = f('recovery-code').value = '';
    f('secret').textContent = f('codes').textContent = '';
    f('qr').removeAttribute('src');
    syncSlots();
    error('');
  };
  const showOverview = () => {
    modal.hidden = true;
    panel.hidden = false;
    clearSecrets();
    stage = 'overview';
    (returnFocus?.isConnected ? returnFocus : settings.querySelector('[data-settings-tab="security"]'))?.focus();
  };
  const close = () => {
    const unverified = stage === 'password' || stage === 'factor' || stage === 'checking';
    generation++;
    modal.hidden = true;
    clearSecrets();
    request('gate', { step: 'cancel' }).catch(() => {});
    if (unverified) settings.querySelector('[data-settings-tab="general"]').click();
    else load();
  };
  const finish = result => {
    render(result.state);
    if (result.recovery_codes) {
      stage = 'codes';
      show();
      f('codes').textContent = result.recovery_codes.join('\n');
    } else {
      showOverview();
      p('status').textContent = t('Настройки сохранены.');
    }
  };
  const execute = async live => {
    if (operation.action === 'overview') {
      await loadOverview(live);
    } else if (operation.action === 'setup') {
      prepared = false;
      if (operation.method === 'totp') {
        const result = await request('setup', { use_gate: '1', method: operation.method });
        if (!live()) return;
        prepared = true;
        f('secret').textContent = result.secret;
        f('qr').src = result.qr;
      }
      stage = 'setup';
      show();
    } else if (operation.action === 'primary') {
      const result = await request('manage', { ...operation, use_gate: '1' });
      if (live()) finish(result);
    } else {
      stage = 'confirm';
      show();
    }
  };
  const begin = (action, method, button) => {
    if (busy) return;
    operation = { action, method };
    returnFocus = button;
    recovery = sent = prepared = false;
    panel.querySelectorAll('details').forEach(menu => { menu.open = false; });
    stage = 'checking';
    generation++;
    show();
    panel.hidden = true;
    modal.hidden = false;
    run(async live => {
      const result = await request('gate', { step: 'status' });
      if (!live()) return;
      if (result.verified) await execute(live);
      else { stage = 'password'; show(); }
    });
  };
  f('form').addEventListener('submit', event => {
    event.preventDefault();
    if (stage === 'codes') { close(); return; }
    run(async live => {
      if (stage === 'password') {
        const result = await request('gate', { action: 'overview', method: '', step: 'password', password: f('password').value });
        f('password').value = '';
        if (!live()) return;
        state = { ...state, primary: result.primary, masked_email: result.masked_email };
        if (result.verified) await execute(live);
        else { stage = 'factor'; show(); }
      } else if (stage === 'factor') {
        await request('gate', { step: 'factor', code: (recovery ? f('recovery-code') : f('code')).value.trim(), recovery: recovery ? '1' : '0' });
        if (live()) await execute(live);
      } else if (stage === 'setup' && prepared) {
        const result = await request('confirm', { use_gate: '1', code: f('code').value.trim() });
        if (live()) finish(result);
      } else if (stage === 'confirm') {
        const result = await request('manage', { ...operation, use_gate: '1' });
        if (live()) finish(result);
      }
    });
  });
  f('send').addEventListener('click', () => run(async live => {
    if (stage === 'factor') {
      await request('gate', { step: 'send' });
      if (!live()) return;
      sent = true;
    } else {
      await request(prepared ? 'resend' : 'setup', { method: operation.method, use_gate: '1' });
      if (!live()) return;
      prepared = true;
    }
    show();
    sendCooldown.start(60);
    f('notice').textContent = t('Код отправлен. Проверьте почту.');
  }));
  f('recovery').addEventListener('click', () => { recovery = !recovery; show(); focusInput(); });
  modal.querySelectorAll('input').forEach(input => input.addEventListener('input', () => { error(''); syncSlots(); controls(); }));
  modal.querySelectorAll('[data-security-close]').forEach(button => button.addEventListener('click', close));
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) close(); }
  });
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); f('notice').textContent = t('Скопировано.'); }
    catch { error('Не удалось скопировать. Выделите и сохраните коды вручную.'); }
  };
  f('copy-secret').addEventListener('click', () => copy(f('secret').textContent));
  f('copy-codes').addEventListener('click', () => copy(f('codes').textContent));
  document.addEventListener('click', event => panel.querySelectorAll('details[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
  const loadOverview = async live => {
      const response = await fetch('/settings/security', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) {
        const failure = new Error(t(result.error));
        failure.sourceMessage = result.error;
        throw failure;
      }
      if (!live()) return;
      render(result);
      showOverview();
  };
  const leave = () => {
    generation++;
    panel.hidden = modal.hidden = true;
    clearSecrets();
    request('gate', { step: 'cancel' }).catch(() => {});
  };
  const load = () => {
    if (busy) return;
    begin('overview', '', settings.querySelector('[data-settings-tab="security"]'));
  };
  window.SonarySecurity = {
    load, leave,
    cancelGate: () => {
      if (modal.hidden) return false;
      if (!busy) close();
      return true;
    }
  };
  p('reload').addEventListener('click', load);
  new MutationObserver(() => {
    if (settings.hidden) leave();
    else if (settings.querySelector('[data-settings-tab="security"]').classList.contains('active')) load();
  }).observe(settings, { attributes: true, attributeFilter: ['hidden'] });
  const reminder = document.getElementById('securityReminder');
  if (!reminder || window.self !== window.top) return;
  reminder.querySelector('[data-security-later]').addEventListener('click', () => window.SonaryModal.close(reminder));
  reminder.querySelector('[data-security-connect]').addEventListener('click', () => {
    window.SonaryModal.close(reminder, () => {
      window.SonaryModal.open(settings);
      settings.querySelector('[data-settings-tab="security"]').click();
    });
  });
  request('reminder').then(result => { if (result.show) window.SonaryModal.open(reminder); }).catch(() => {});
});
