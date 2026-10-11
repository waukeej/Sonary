(() => {
  const t = text => window.SonaryI18n?.translate(text) || text;
  const sync = input => {
    const root = input?.closest('[data-otp]');
    if (!root) return;
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    const position = Math.min(input.selectionStart ?? input.value.length, 5);
    root.querySelectorAll('.sonary-otp-slots span').forEach((slot, i) => {
      slot.textContent = input.value[i] || '';
      slot.classList.toggle('is-current', i === position);
    });
    root.classList.toggle('is-disabled', input.disabled);
    root.classList.toggle('is-invalid', input.getAttribute('aria-invalid') === 'true');
  };
  const resetPasswords = root => root.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = button.parentElement.querySelector('input');
    input.type = 'password';
    button.setAttribute('aria-label', t('Показать пароль'));
    button.setAttribute('aria-pressed', 'false');
    button.querySelector('[data-eye-slash]').setAttribute('hidden', '');
  });
  const enhance = root => {
    root.querySelectorAll('[data-otp] input').forEach(sync);
    root.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.closest('.password-control')) return;
      const wrapper = document.createElement('span');
      wrapper.className = 'password-control';
      input.before(wrapper);
      wrapper.append(input);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.passwordToggle = '';
      button.setAttribute('aria-label', t('Показать пароль'));
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path data-eye-slash hidden d="M3 3 21 21"/></svg>';
      wrapper.append(button);
      button.addEventListener('click', () => {
        const start = input.selectionStart, end = input.selectionEnd;
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', t(visible ? 'Скрыть пароль' : 'Показать пароль'));
        button.querySelector('[data-eye-slash]').toggleAttribute('hidden', !visible);
        input.focus({ preventScroll: true });
        if (start !== null) input.setSelectionRange(start, end);
      });
    });
  };
  const cooldown = (button, update) => {
    let until = 0;
    const remaining = () => Math.max(0, Math.ceil((until - Date.now()) / 1000));
    const tick = () => { update(remaining()); };
    const timer = setInterval(() => { if (button.isConnected) tick(); else clearInterval(timer); }, 500);
    return { start(seconds = 60) { until = Date.now() + seconds * 1000; tick(); }, remaining };
  };
  window.SonaryInputs = { sync, enhance, resetPasswords, cooldown };
  document.addEventListener('DOMContentLoaded', () => {
    enhance(document);
    ['input', 'click', 'keyup', 'focusin'].forEach(type => document.addEventListener(type, event => sync(event.target)));
    document.addEventListener('paste', event => {
      if (!event.target.matches('[data-otp] input')) return;
      const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      event.preventDefault();
      event.target.value = digits;
      event.target.dispatchEvent(new Event('input', { bubbles: true }));
    });
    new MutationObserver(records => records.forEach(record => {
      if (record.type === 'attributes') {
        if (record.attributeName === 'hidden' && record.target.hidden) resetPasswords(record.target);
        else if (record.target.matches('[data-otp] input')) sync(record.target);
      } else record.addedNodes.forEach(node => { if (node.nodeType === 1) enhance(node); });
    })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'aria-invalid', 'hidden'] });
  });
})();
