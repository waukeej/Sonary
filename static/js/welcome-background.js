(() => {
  const page = document.querySelector(".welcome-page");
  if (!page) return;
  const intro = document.querySelector(".welcome-intro");
  const card = document.querySelector(".welcome-card");
  const footer = document.querySelector(".welcome-footer");
  const canvasReadyButton = document.querySelector(
    "[data-simulate-canvas-ready]",
  );
  let skipIntro = false;

  if (card) {
    try {
      skipIntro = sessionStorage.getItem("sonaryWelcomeIntroShown") === "1";
      if (!skipIntro) sessionStorage.setItem("sonaryWelcomeIntroShown", "1");
    } catch (_) {
      skipIntro = false;
    }
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animationLoop = page.dataset.animationLoop;
  const infiniteAnimation = animationLoop === "true";
  const forceCanvasError = page.dataset.canvasError === "true";
  const lapDuration = 3000;
  const retryDelay = 500;
  const rayDuration = 650;
  let effect = null;
  let canvasReady = false;
  let cycleTimer = null;

  const markCanvasReady = () => {
    canvasReady = true;
    if (canvasReadyButton) {
      canvasReadyButton.disabled = true;
      canvasReadyButton.textContent = "Canvas готов";
    }
  };

  canvasReadyButton?.addEventListener("click", markCanvasReady);

  if (forceCanvasError) {
    page.classList.add("vanta-fallback", "vanta-error");
  } else if (reducedMotion.matches || !window.THREE || !window.VANTA?.WAVES) {
    page.classList.add("vanta-fallback");
    markCanvasReady();
  } else {
    try {
      effect = window.VANTA.WAVES({
        el: page,
        THREE: window.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 320,
        minWidth: 320,
        scale: 1,
        scaleMobile: 1,
        color:
          document.documentElement.dataset.theme === "light"
            ? 0xe8e8e8
            : 0x342019,
        shininess: 34,
        waveHeight: 13,
        waveSpeed: 0.55,
        zoom: 0.86,
      });
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(markCanvasReady),
      );
    } catch (_) {
      page.classList.add("vanta-fallback");
      markCanvasReady();
    }
  }

  document.addEventListener("sonary:theme", () => {
    effect?.setOptions({
      color:
        document.documentElement.dataset.theme === "light"
          ? 0xe8e8e8
          : 0x342019,
    });
  });

  const showPage = () => {
    intro?.remove();
    card?.classList.add("is-ready");
    footer?.classList.add("is-ready");
  };

  if (skipIntro) {
    intro?.remove();
    card?.classList.add("is-instant");
    footer?.classList.add("is-instant");
  } else if (reducedMotion.matches) {
    showPage();
  } else if (!intro) {
    card?.classList.add("is-ready");
    footer?.classList.add("is-ready");
  } else {
    function startCycle() {
      intro.classList.remove("is-cycling", "is-retrying");
      void intro.offsetWidth;
      intro.classList.add("is-cycling");
      cycleTimer = window.setTimeout(() => {
        if (canvasReady) {
          completeIntro();
          return;
        }
        intro.classList.add("is-retrying");
        cycleTimer = window.setTimeout(startCycle, retryDelay);
      }, lapDuration);
    }

    function completeIntro() {
      window.clearTimeout(cycleTimer);
      intro.classList.remove("is-cycling");
      intro.classList.add("is-complete");
      cycleTimer = window.setTimeout(
        () => intro.classList.add("is-leaving"),
        rayDuration,
      );
    }

    const finishIntro = (event) => {
      if (
        event.target !== intro ||
        event.animationName !== "welcome-intro-iris"
      )
        return;
      if (infiniteAnimation) {
        cycleTimer = window.setTimeout(() => {
          intro.classList.remove("is-leaving", "is-complete");
          startCycle();
        }, 350);
        return;
      }
      intro.removeEventListener("animationend", finishIntro);
      showPage();
    };

    intro.addEventListener("animationend", finishIntro);
    startCycle();
  }

  window.addEventListener(
    "pagehide",
    () => {
      window.clearTimeout(cycleTimer);
      effect?.destroy();
      effect = null;
    },
    { once: true },
  );
})();
