(function () {
  const selector = 'input.track-progress-slider[type="range"]';

  const syncSlider = (slider) => {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const value = Number(slider.value || min);
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty("--progress-value", `${percent}%`);

    const progressRow = slider.closest(".player-progress-row");
    const duration = Number(slider.dataset.duration || 0);
    if (progressRow && duration > 0) {
      const elapsed = Math.round(duration * (percent / 100));
      const remaining = Math.max(0, duration - elapsed);
      const formatTime = (seconds) =>
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      progressRow.querySelector(".player-current-time").textContent =
        formatTime(elapsed);
      progressRow.querySelector(".player-remaining-time").textContent =
        `−${formatTime(remaining)}`;
    }

    const cardRow = slider.closest(".track-card-bottom");
    if (cardRow && duration > 0) {
      const elapsed = Math.round(duration * (percent / 100));
      const remaining = Math.max(0, duration - elapsed);
      const formatTime = (seconds) =>
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      const timeStamps = cardRow.querySelectorAll(".time-stamp");
      if (timeStamps[0]) timeStamps[0].textContent = formatTime(elapsed);
      if (timeStamps[1])
        timeStamps[1].textContent = `−${formatTime(remaining)}`;
    }
  };

  const setupSlider = (slider) => {
    if (slider.dataset.progressReady === "true") return;
    slider.dataset.progressReady = "true";
    syncSlider(slider);
    slider.addEventListener("input", () => syncSlider(slider));
    slider.addEventListener("click", (event) => event.stopPropagation());
    slider.addEventListener("pointerdown", (event) => event.stopPropagation());
    slider.addEventListener("pointerup", (event) => event.stopPropagation());
    slider.addEventListener("touchstart", (event) => event.stopPropagation(), {
      passive: true,
    });
  };

  const setupAll = (root = document) => {
    if (root.matches?.(selector)) setupSlider(root);
    root.querySelectorAll?.(selector).forEach(setupSlider);
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupAll();
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) setupAll(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
