(() => {
  const duration = 300;
  const open = (modal) => {
    if (!modal) return;
    modal.hidden = false;
    modal.classList.remove("is-closing");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => modal.classList.add("is-open")),
    );
  };
  const close = (modal, afterClose) => {
    if (!modal || modal.hidden || modal.classList.contains("is-closing"))
      return;
    modal.classList.remove("is-open");
    modal.classList.add("is-closing");
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove("is-closing");
      afterClose?.();
    }, duration);
  };
  const swap = (from, to) => close(from, () => open(to));
  window.SonaryModal = { open, close, swap, duration };
})();
