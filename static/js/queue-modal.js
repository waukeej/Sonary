(() => {
  const setup = () => {
    const originalToggle = [
      ...document.querySelectorAll(".player-actions button"),
    ].find((button) => button.querySelector(".bi-music-note-list"));
    if (!originalToggle) return false;

    const panel = document.getElementById("sonaryQueuePanel");
    if (!panel) return false;
    if (panel.dataset.queueReady) return true;
    panel.dataset.queueReady = "true";
    panel.classList.add("is-modal");

    const header = panel.querySelector(".sonary-queue-head");
    const initialItems = [...panel.querySelectorAll(".sonary-queue-item")];
    const surface = document.createElement("div");
    const list = document.createElement("div");
    surface.className = "sonary-queue-surface";
    list.className = "sonary-queue-list";
    surface.append(header, list);
    initialItems.forEach((item, index) => {
      const art = item.querySelector(".sonary-queue-art");
      if (art && art.tagName !== "IMG")
        art.outerHTML = `<img class="sonary-queue-art" src="/static/images/cover-${index + 1}.svg" alt="Обложка трека">`;
      list.append(item);
    });
    panel.replaceChildren(surface);

    list.querySelectorAll(".sonary-queue-item").forEach((item) => {
      const time = item.querySelector("time");
      if (time)
        time.outerHTML =
          '<span class="sonary-drag-handle" aria-label="Перетащить"><i class="bi bi-grip-vertical"></i></span>';
    });

    document.head.insertAdjacentHTML(
      "beforeend",
      `<style>
      .sonary-queue-panel.is-modal[hidden]{display:none!important}
      .sonary-queue-panel.is-modal{position:fixed;inset:0;z-index:50;display:grid;width:100%;height:100%;place-items:center;overflow:hidden;padding:24px 24px 98px;background:rgb(0 0 0 / 0%);border:0;border-radius:0;box-shadow:none;opacity:0;transition:background .28s ease,opacity .28s ease}
      .sonary-queue-panel.is-modal.is-open{background:rgb(0 0 0 / 68%);opacity:1}.sonary-queue-panel.is-modal.is-closing{background:rgb(0 0 0 / 0%);opacity:0}
      .sonary-queue-surface{display:grid;width:min(1160px,calc(100vw - 48px));height:min(calc(100vh - 122px),900px);grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid #8b542d;border-radius:20px;background:rgb(36 24 18 / 88%);box-shadow:0 24px 70px rgb(0 0 0 / 48%);backdrop-filter:blur(8px);transform:translateY(calc(100% + 48px));transition:transform .32s cubic-bezier(.22,.8,.3,1)}
      .sonary-queue-panel.is-modal.is-open .sonary-queue-surface{transform:translateY(0)}.sonary-queue-panel.is-modal.is-closing .sonary-queue-surface{transform:translateY(calc(100% + 48px))}
      .sonary-queue-surface .sonary-queue-head{position:relative;z-index:3;width:100%;box-sizing:border-box;border:0;border-bottom:1px solid color-mix(in srgb,#8b542d 78%,transparent);border-radius:0;background:transparent;box-shadow:0 8px 16px rgb(0 0 0 / 14%)}
      .sonary-queue-head{display:flex;min-height:58px;align-items:center;justify-content:space-between;padding:0 16px;color:var(--theme-text);font-weight:700}.sonary-queue-head button{display:grid;width:36px;height:36px;place-items:center;padding:0}
      .sonary-queue-list{display:flex;min-width:0;min-height:0;flex-direction:column;gap:14px;overflow-x:hidden;overflow-y:auto;padding:16px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:thin;scrollbar-color:var(--theme-accent) var(--theme-inactive)}
      .sonary-queue-list::-webkit-scrollbar{width:10px}.sonary-queue-list::-webkit-scrollbar-track{border-radius:999px;background:var(--theme-inactive)}.sonary-queue-list::-webkit-scrollbar-thumb{border:2px solid var(--theme-inactive);border-radius:999px;background:var(--theme-accent)}
      .sonary-queue-surface .sonary-queue-item{position:relative;display:grid;width:100%;min-width:0;box-sizing:border-box;grid-template-columns:42px minmax(0,1fr) 48px;flex:0 0 auto;gap:12px;align-items:center;margin:0;padding:10px 12px 10px 14px;border:1px solid color-mix(in srgb,#8b542d 78%,transparent);border-radius:var(--radius-control);background:transparent;cursor:default}
      .sonary-drag-handle{display:flex;width:48px;height:42px;align-items:center;justify-content:center;align-self:center;justify-self:end;color:var(--theme-accent);line-height:1;cursor:grab;touch-action:none;user-select:none}.sonary-drag-handle:active{cursor:grabbing}.sonary-drag-handle .bi{display:block;font-size:30px!important;line-height:1!important;transform:scaleY(1.12)}
      .sonary-queue-item.dragging{opacity:.42;background:var(--theme-inactive)}.sonary-queue-item.drag-over{border-top:3px solid var(--theme-accent)}
      @media(max-width:600px){.sonary-queue-panel.is-modal{padding:12px 12px 80px}.sonary-queue-surface{width:calc(100vw - 24px);height:calc(100vh - 104px)}.sonary-queue-list{gap:10px;padding:12px}}
    </style>`,
    );

    originalToggle.setAttribute("aria-label", "Очередь");
    originalToggle.title = "Очередь";
    const toggle = originalToggle.cloneNode(true);
    originalToggle.replaceWith(toggle);
    const originalClose = surface.querySelector("#closeSonaryQueue");
    const closeButton = originalClose.cloneNode(true);
    originalClose.replaceWith(closeButton);
    const openQueue = () => {
      document.dispatchEvent(
        new CustomEvent("sonary:popover-open", {
          detail: { type: "queue-modal" },
        }),
      );
      panel.hidden = false;
      panel.classList.remove("is-closing");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => panel.classList.add("is-open")),
      );
    };
    const closeQueue = () => {
      if (panel.hidden || panel.classList.contains("is-closing")) return;
      finishDrag(null, true);
      finishSwipe(true);
      panel.classList.remove("is-open");
      panel.classList.add("is-closing");
      setTimeout(() => {
        panel.hidden = true;
        panel.classList.remove("is-closing");
      }, 330);
    };
    toggle.addEventListener("click", openQueue);
    closeButton.addEventListener("click", closeQueue);
    panel.addEventListener("click", (event) => {
      if (event.target === panel) closeQueue();
    });
    document.addEventListener("sonary:popover-open", (event) => {
      if (event.detail?.type !== "queue-modal") closeQueue();
    });
    let draggedItem = null;
    let activePointerId = null;
    let scrollDirection = 0;
    let scrollFrame = null;
    let pending = null,
      holdTimer = null,
      originalOrder = [],
      pointerY = 0,
      suppressClickUntil = 0,
      touchDrag = false;
    let swipe = null;
    const queueItem = (target) =>
      target.closest(".queue-swipe-shell") ||
      target.closest(".sonary-queue-item");
    const finishSwipe = (cancel = false) => {
      if (!swipe) return;
      const { item, dx, locked } = swipe;
      item.style.removeProperty("--swipe-x");
      item.classList.remove("is-swiping");
      panel.classList.remove("is-swiping");
      swipe = null;
      if (locked) suppressClickUntil = Date.now() + 400;
      if (
        !cancel &&
        locked &&
        Math.abs(dx) >= Math.min(90, item.getBoundingClientRect().width * 0.28)
      ) {
        window.SonaryPlayer?.swipeQueue(
          Number(item.dataset.queueIndex),
          dx < 0 ? "left" : "right",
        );
      }
    };
    const clearPending = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      pending = null;
    };
    const placeDragged = () => {
      const next = [...list.children].find(
        (item) =>
          item !== draggedItem &&
          pointerY <
            item.getBoundingClientRect().top +
              item.getBoundingClientRect().height / 2,
      );
      if (draggedItem && draggedItem.nextElementSibling !== (next || null))
        list.insertBefore(draggedItem, next || null);
    };

    const stopAutoScroll = () => {
      scrollDirection = 0;
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
    };

    const autoScroll = () => {
      if (!draggedItem || !scrollDirection) return;
      list.scrollTop += scrollDirection * 12;
      placeDragged();
      scrollFrame = requestAnimationFrame(autoScroll);
    };

    const updatePosition = (clientX, clientY) => {
      pointerY = clientY;
      placeDragged();

      const listRect = list.getBoundingClientRect();
      const edge = 54;
      const nextDirection =
        clientY < listRect.top + edge
          ? -1
          : clientY > listRect.bottom - edge
            ? 1
            : 0;
      if (nextDirection !== scrollDirection) {
        stopAutoScroll();
        scrollDirection = nextDirection;
        if (scrollDirection) scrollFrame = requestAnimationFrame(autoScroll);
      }
    };

    const finishDrag = (event, cancel = false) => {
      if (event && pending && event.pointerId !== pending.id) return;
      clearPending();
      if (
        !draggedItem ||
        (event?.pointerId !== undefined && activePointerId !== event.pointerId)
      )
        return;
      if (list.hasPointerCapture?.(activePointerId))
        list.releasePointerCapture(activePointerId);
      if (cancel || event?.type === "pointercancel")
        originalOrder.forEach((item) => list.append(item));
      draggedItem.classList.remove("dragging");
      draggedItem = null;
      touchDrag = false;
      activePointerId = null;
      panel.classList.remove("is-dragging");
      stopAutoScroll();
      suppressClickUntil = Date.now() + 400;
      window.SonaryPlayer?.reorder(
        [...list.querySelectorAll("[data-queue-index]")].map((item) =>
          Number(item.dataset.queueIndex),
        ),
      );
    };

    const startDrag = () => {
      if (!pending || !pending.item.isConnected) {
        clearPending();
        return;
      }
      draggedItem = pending.item;
      activePointerId = pending.id;
      pointerY = pending.y;
      touchDrag = pending.touch;
      originalOrder = [...list.children];
      draggedItem.classList.add("dragging");
      panel.classList.add("is-dragging");
      if (!touchDrag) list.setPointerCapture?.(activePointerId);
      clearPending();
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        if (
          pending &&
          pending.id === event.pointerId &&
          Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8
        ) {
          if (pending.touch) clearPending();
          else startDrag();
        }
        if (!draggedItem || event.pointerId !== activePointerId) return;
        event.preventDefault();
        updatePosition(event.clientX, event.clientY);
      },
      { passive: false },
    );
    window.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") finishDrag(event);
    });
    window.addEventListener("pointercancel", (event) => {
      if (event.pointerType !== "touch") finishDrag(event);
    });
    window.addEventListener("blur", () => {
      finishDrag(null, true);
      finishSwipe(true);
    });
    list.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          finishDrag(null, true);
          finishSwipe(true);
          return;
        }
        if (event.target.closest("button,input,a") || pending || draggedItem)
          return;
        const item = queueItem(event.target),
          touch = event.touches[0];
        if (!item) return;
        if (!event.target.closest(".sonary-drag-handle")) {
          swipe = {
            item,
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            dx: 0,
            locked: false,
          };
          return;
        }
        pending = {
          item,
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
          touch: true,
        };
        holdTimer = setTimeout(startDrag, 350);
      },
      { passive: true },
    );
    list.addEventListener(
      "touchmove",
      (event) => {
        if (swipe) {
          const finger = [...event.touches].find(
            (t) => t.identifier === swipe.id,
          );
          if (!finger) return;
          const dx = finger.clientX - swipe.x,
            dy = finger.clientY - swipe.y;
          if (!swipe.locked) {
            if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
              finishSwipe(true);
              return;
            }
            if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
            swipe.locked = true;
            swipe.item.classList.add("is-swiping");
            panel.classList.add("is-swiping");
          }
          event.preventDefault();
          swipe.dx = dx;
          swipe.item.style.setProperty(
            "--swipe-x",
            `${Math.max(-130, Math.min(130, dx))}px`,
          );
          return;
        }
        const touch = [...event.touches].find(
          (item) => item.identifier === (pending?.id ?? activePointerId),
        );
        if (!touch) return;
        if (
          pending &&
          Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > 8
        )
          clearPending();
        if (touchDrag && draggedItem) {
          event.preventDefault();
          updatePosition(touch.clientX, touch.clientY);
        }
      },
      { passive: false },
    );
    const finishTouch = (event) => {
      if (
        swipe &&
        [...event.changedTouches].some((t) => t.identifier === swipe.id)
      )
        finishSwipe(event.type === "touchcancel");
      const touch = [...event.changedTouches].find(
        (item) => item.identifier === (pending?.id ?? activePointerId),
      );
      if (touch)
        finishDrag(
          { pointerId: touch.identifier },
          event.type === "touchcancel",
        );
    };
    list.addEventListener("touchend", finishTouch);
    list.addEventListener("touchcancel", finishTouch);
    list.addEventListener("contextmenu", (event) => {
      if (pending || draggedItem) event.preventDefault();
    });
    list.addEventListener(
      "click",
      (event) => {
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );

    list.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      if (event.target.closest("button,input,a") || pending || draggedItem)
        return;
      const item = queueItem(event.target);
      if (!item) return;
      if (event.button !== undefined && event.button !== 0) return;
      const touch = event.pointerType === "touch";
      if (!touch) event.preventDefault();
      pending = {
        item,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        touch,
      };
      holdTimer = setTimeout(startDrag, touch ? 350 : 180);
    });
    list.addEventListener("dragstart", (event) => event.preventDefault());
    document.dispatchEvent(new Event("sonary:queue-ready"));
    return true;
  };
  const timer = setInterval(() => {
    if (setup()) clearInterval(timer);
  }, 50);
  setTimeout(() => clearInterval(timer), 5000);
})();
