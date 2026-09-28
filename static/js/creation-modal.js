(() => {
  const opener = document.getElementById("addTrackBtn");
  const card = document.querySelector("[data-create-track-card]");
  const modal = document.getElementById("trackCreationModal");
  const form = document.getElementById("trackCreationForm");
  if (!modal || !form || (!opener && !card)) return;

  form.noValidate = true;
  const close = () => {
    window.SonaryModal?.close(modal);
    document.body.classList.remove("modal-open");
  };
  const open = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    window.SonaryModal?.open(modal);
    document.body.classList.add("modal-open");
    modal.querySelector("input, textarea, button")?.focus();
  };

  opener?.addEventListener("click", open);
  if (card) {
    card.addEventListener("pointerdown", open);
    card.addEventListener("click", open);
  }
  modal
    .querySelectorAll("[data-close-creation]")
    .forEach((button) => button.addEventListener("click", close));

  if (form.querySelector("[data-track-error]:not([hidden])")) open();
  form.querySelectorAll('input[name="trackRating"]').forEach((input) => {
    const output = input.parentElement.querySelector("output");
    const update = () => {
      output.value = `${input.value}/10`;
      input.style.setProperty("--rating-fill", `${input.value * 10}%`);
    };
    update();
    input.addEventListener("input", update);
  });
})();
