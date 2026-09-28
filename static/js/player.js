(() => {
  if (window.parent && window.parent !== window && window.parent.SonaryShell) {
    window.SonaryPlayer = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) =>
            window.parent.SonaryPlayer?.[key]?.(...args),
      },
    );
    return;
  }
  const bar = document.querySelector(".player-bar");
  if (!bar || window.SonaryPlayer) return;
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 0.5;
  let audioContext, normalization;
  const configureGain = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audioContext) {
      audioContext = new Context();
      normalization = audioContext.createGain();
      audioContext
        .createMediaElementSource(audio)
        .connect(normalization)
        .connect(audioContext.destination);
    }
    const gain = Number(current()?.normalization_gain_db || 0);
    normalization.gain.value = 10 ** (Math.min(12, Math.max(-60, gain)) / 20);
    return audioContext.resume();
  };
  const documents = () =>
    [document, document.querySelector("#sonaryPage")?.contentDocument].filter(
      Boolean,
    );
  const nodes = (selector) =>
    documents().flatMap((doc) => [...doc.querySelectorAll(selector)]);
  const key = `sonary-player:${bar.dataset.playerUser}`;
  let queue = [],
    index = -1,
    generation = 0,
    lastSaved = 0,
    leaving = false;
  const defaultCover = bar.querySelector(".player-cover").src;
  const current = () => queue[index];
  const t = (text) => window.SonaryI18n?.translate(text) || text;
  const volumeKey = `sonary-player-volume:${bar.dataset.playerUser}`;
  let lastVolume = 0.5;
  try {
    const saved = JSON.parse(localStorage.getItem(volumeKey));
    if (
      saved &&
      Number.isFinite(saved.volume) &&
      saved.volume >= 0 &&
      saved.volume <= 1
    ) {
      audio.volume = saved.volume;
      audio.muted = saved.muted === true;
      if (
        Number.isFinite(saved.lastVolume) &&
        saved.lastVolume > 0 &&
        saved.lastVolume <= 1
      )
        lastVolume = saved.lastVolume;
    }
  } catch {}
  const volumeControl = document.querySelector("[data-volume-control]");
  const syncVolume = () => {
    if (audio.volume > 0) lastVolume = audio.volume;
    const silent = audio.muted || audio.volume === 0;
    const value = silent ? 0 : Math.round(audio.volume * 100);
    if (volumeControl) {
      volumeControl.querySelector("[data-volume-slider]").value = value;
      volumeControl.querySelector("[data-volume-value]").textContent =
        `${value}%`;
      volumeControl.querySelectorAll("button").forEach((button) => {
        button.querySelector("i").className = silent
          ? "bi bi-volume-mute"
          : "bi bi-volume-up";
        const label = button.hasAttribute("data-volume-toggle")
          ? "Громкость"
          : silent
            ? "Включить звук"
            : "Выключить звук";
        button.setAttribute("aria-label", t(label));
        button.title = t(label);
        if (button.hasAttribute("data-volume-mute"))
          button.setAttribute("aria-pressed", String(silent));
      });
    }
    try {
      localStorage.setItem(
        volumeKey,
        JSON.stringify({
          volume: audio.volume,
          muted: audio.muted,
          lastVolume,
        }),
      );
    } catch {}
  };
  const setVolume = (value) => {
    if (!Number.isFinite(value)) return;
    audio.volume = Math.max(0, Math.min(1, value));
    audio.muted = false;
    syncVolume();
  };
  const toggleMute = () => {
    if (audio.muted || audio.volume === 0) {
      audio.volume = audio.volume || lastVolume;
      audio.muted = false;
    } else audio.muted = true;
    syncVolume();
  };
  if (volumeControl) {
    const button = volumeControl.querySelector("[data-volume-toggle]");
    const popup = volumeControl.querySelector(".player-volume-popup");
    let touch = false;
    const hover = () =>
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const open = (value) => {
      volumeControl.classList.toggle("is-open", value);
      button.setAttribute("aria-expanded", String(value));
      popup.inert = !value;
    };
    volumeControl.addEventListener("pointerdown", (event) => {
      touch = event.pointerType === "touch";
    });
    volumeControl.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch" && hover()) open(true);
    });
    volumeControl.addEventListener("pointerleave", () => {
      if (!touch && hover()) open(false);
    });
    volumeControl.addEventListener("focusin", () => {
      if (!touch && hover()) open(true);
    });
    volumeControl.addEventListener("focusout", (event) => {
      if (!volumeControl.contains(event.relatedTarget)) open(false);
    });
    button.addEventListener("click", () => {
      if (touch || !hover()) open(!volumeControl.classList.contains("is-open"));
      else toggleMute();
    });
    volumeControl
      .querySelector("[data-volume-mute]")
      .addEventListener("click", toggleMute);
    volumeControl
      .querySelector("[data-volume-slider]")
      .addEventListener("input", (event) =>
        setVolume(Number(event.target.value) / 100),
      );
    document.addEventListener("pointerdown", (event) => {
      if (!volumeControl.contains(event.target)) open(false);
    });
    volumeControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        button.focus();
        open(false);
      }
    });
  }
  audio.addEventListener("volumechange", syncVolume);
  document.addEventListener("sonary:language", syncVolume);
  syncVolume();
  const notify = () =>
    window.SonaryUI?.notify(t("Не удалось воспроизвести трек."), "error");
  const json = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok || response.redirected) throw new Error("Unavailable");
    return response.json();
  };
  const liked = new Set(),
    likeRequests = new Set();
  const syncLikes = () =>
    nodes(".card-like-btn,.track-like-action,.track-like-btn").forEach(
      (button) => {
        const id = Number(button.closest("[data-track-id]")?.dataset.trackId),
          active = liked.has(id);
        button.classList.toggle("is-liked", active);
        button.setAttribute("aria-pressed", String(active));
        const label = t(
          active ? "Убрать из понравившихся" : "Добавить в понравившиеся",
        );
        button.setAttribute("aria-label", label);
        button.title = label;
        const icon = button.querySelector("i");
        if (icon) icon.className = active ? "bi bi-heart-fill" : "bi bi-heart";
      },
    );
  const refreshLikes = async () => {
    try {
      const data = await json("/tracks/likes");
      liked.clear();
      data.ids.forEach((id) => liked.add(id));
      syncLikes();
    } catch {}
  };
  const likeTrack = async (id, value = !liked.has(Number(id))) => {
    id = Number(id);
    if (!id || likeRequests.has(id)) return;
    likeRequests.add(id);
    try {
      const token = await json("/auth/csrf");
      const response = await fetch(`/track/${id}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRFToken": token.csrf_token,
        },
        body: JSON.stringify({ liked: value }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.liked) liked.add(id);
      else liked.delete(id);
      syncLikes();
      const frame = document.querySelector("#sonaryPage");
      if (
        frame?.contentDocument.querySelector(
          '.playlist-detail-page[data-system-key="liked"]',
        )
      )
        window.SonaryShell.go(frame.contentWindow.location.href, true);
    } catch {
      window.SonaryUI?.notify(
        t("Не удалось сохранить отметку. Попробуйте снова."),
        "error",
      );
    } finally {
      likeRequests.delete(id);
    }
  };
  const getTrack = (id) => json(`/track/${Number(id)}/playback`);
  const refreshQueue = async () => {
    const snapshot = queue;
    const valid = await Promise.all(
      snapshot.map(async (track) => {
        try {
          const response = await fetch(`/track/${track.id}/playback`, {
            headers: { Accept: "application/json" },
          });
          return ![403, 404, 410].includes(response.status);
        } catch {
          return true;
        }
      }),
    );
    if (queue !== snapshot || valid.every(Boolean)) return;
    const old = current(),
      wasPlaying = !audio.paused,
      oldIndex = index;
    queue = snapshot.filter((_, i) => valid[i]);
    index = queue.indexOf(old);
    if (old && index < 0)
      select(
        Math.min(
          valid.slice(0, oldIndex).filter(Boolean).length,
          queue.length - 1,
        ),
        wasPlaying,
      );
    else render();
  };
  const save = () => {
    if (leaving) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ids: queue.map((track) => track.id),
          index,
          position: audio.currentTime || 0,
          playing: !audio.paused,
        }),
      );
    } catch {}
  };
  const format = (n) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
  const progress = () => {
    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : Number(current()?.duration_seconds || 0);
    nodes(".track-progress-slider").forEach((slider) => {
      const row = slider.closest("[data-track-id]");
      const active = row?.dataset.trackId === String(current()?.id);
      const total = active ? duration : Number(slider.dataset.duration || 0);
      const position = active ? audio.currentTime || 0 : 0;
      slider.step = "any";
      const percent = total ? (position / total) * 100 : 0;
      slider.value = percent;
      slider.style.setProperty("--progress-value", `${percent}%`);
      const parent = slider.closest(".player-progress-row,.track-card-bottom");
      const times = parent?.querySelectorAll("time,.time-stamp");
      if (times?.length === 2) {
        times[0].textContent = format(position);
        times[1].textContent = `−${format(Math.max(0, total - position))}`;
      }
    });
  };
  const renderQueue = () => {
    if (
      document.querySelector(
        ".sonary-queue-panel.is-dragging,.sonary-queue-panel.is-swiping",
      )
    )
      return;
    const list = document.querySelector(".sonary-queue-list");
    if (!list) return;
    const template = document.getElementById("queueTrackTemplate");
    if (!template) return;
    list.replaceChildren();
    queue.forEach((track, at) => {
      const row = template.content.firstElementChild.cloneNode(true);
      const shell = document.createElement("div");
      shell.className = "queue-swipe-shell";
      shell.dataset.queueIndex = at;
      row.dataset.trackId = track.id;
      row.querySelector("img").src = track.cover;
      row.querySelector("h3").textContent = track.title;
      row.querySelector("p").textContent = track.artist;
      row.querySelector("[data-queue-duration]").textContent = format(
        track.duration_seconds || 0,
      );
      const play = row.querySelector("[data-queue-play]");
      play.setAttribute("aria-pressed", String(at === index && !audio.paused));
      play.querySelector("i").className =
        at === index && !audio.paused ? "bi bi-pause-fill" : "bi bi-play-fill";
      play.onclick = () => (at === index ? toggle() : select(at));
      shell.append(row);
      list.append(shell);
    });
    const header = document.querySelector(".sonary-queue-head");
    if (header && !header.querySelector("[data-clear-queue]")) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.dataset.clearQueue = "";
      clear.innerHTML = '<i class="bi bi-trash3"></i>';
      clear.setAttribute("aria-label", t("Очистить очередь"));
      clear.onclick = () => {
        queue = [];
        select(-1, false);
      };
      header.insertBefore(clear, header.lastElementChild);
    }
  };
  const render = () => {
    const track = current();
    bar.dataset.trackId = track?.id || "";
    bar.querySelector(".title").textContent = track?.title || "—";
    bar.querySelector(".artist").textContent = track?.artist || "—";
    const slider = bar.querySelector(".track-progress-slider");
    slider.dataset.duration = track?.duration_seconds || 0;
    slider.disabled = !track;
    bar.querySelector(".player-text").setAttribute("data-no-i18n", "");
    bar.querySelector(".player-cover").src = track?.cover || defaultCover;
    const controls = bar.querySelectorAll(".player-buttons button");
    controls[0].disabled = !track;
    controls[1].disabled = !track;
    controls[2].disabled = index + 1 >= queue.length;
    bar
      .querySelector(
        ".player-actions button:has(.bi-plus-lg),.player-actions button:has(.bi-plus)",
      )
      ?.toggleAttribute("disabled", !track);
    nodes(
      ".card-play-btn,.profile-track-actions button:first-child,.main-play,.track-detail-page .listen-playlist-btn",
    ).forEach((button) => {
      const id = button.closest("[data-track-id]")?.dataset.trackId;
      const active = Boolean(track && !audio.paused && id === String(track.id));
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", t(active ? "Пауза" : "Воспроизвести"));
      const icon = button.querySelector("i");
      if (icon)
        icon.className = active ? "bi bi-pause-fill" : "bi bi-play-fill";
    });
    progress();
    renderQueue();
    syncLikes();
    save();
  };
  const play = async () => {
    try {
      await configureGain();
      await audio.play();
    } catch (error) {
      if (error.name !== "AbortError") {
        render();
        window.SonaryUI?.notify(
          t("Нажмите Play, чтобы начать воспроизведение."),
          "error",
        );
      }
    }
  };
  const select = (at, playing = true, position = 0) => {
    generation++;
    audio.pause();
    index = at;
    audio.onloadedmetadata = null;
    const track = current();
    if (!track) {
      index = -1;
      audio.removeAttribute("src");
      audio.load();
      render();
      return;
    }
    audio.src = track.audio_url;
    audio.onloadedmetadata = () => {
      if (position && Number.isFinite(audio.duration))
        audio.currentTime = Math.min(position, audio.duration);
      progress();
    };
    render();
    if (playing) play();
  };
  const toggle = () => (audio.paused ? play() : audio.pause());
  const enqueue = async (id, next = false) => {
    try {
      const track = await getTrack(id);
      if (!track.audio_url) throw new Error("No audio");
      queue.splice(next ? index + 1 : queue.length, 0, track);
      if (index < 0) select(0, false);
      else render();
    } catch {
      notify();
    }
  };
  const playTrack = async (id) => {
    if (String(current()?.id) === String(id)) {
      toggle();
      return;
    }
    const token = ++generation;
    try {
      const track = await getTrack(id);
      if (token !== generation) return;
      if (!track.audio_url) throw new Error("No audio");
      let at = queue.findIndex((item) => item.id === track.id);
      if (at < 0) {
        at = queue.length;
        queue.push(track);
      } else queue[at] = track;
      select(at);
    } catch {
      if (token === generation) notify();
    }
  };
  const playPlaylist = async (id) => {
    const token = ++generation;
    try {
      const tracks = await json(`/playlist/${Number(id)}/playback`);
      if (token !== generation) return;
      queue = tracks;
      select(queue.length ? 0 : -1);
    } catch {
      notify();
    }
  };
  const next = () => {
    if (index + 1 < queue.length) select(index + 1);
    else {
      audio.pause();
      render();
    }
  };
  const removeQueue = (at) => {
    if (!Number.isInteger(at) || at < 0 || at >= queue.length) return;
    const wasPlaying = !audio.paused;
    queue.splice(at, 1);
    if (at < index) index--;
    else if (at === index) {
      select(Math.min(at, queue.length - 1), wasPlaying);
      return;
    }
    render();
  };
  const swipeQueue = (at, direction) => {
    if (direction === "left") removeQueue(at);
    else if (queue[at]) likeTrack(queue[at].id, true);
  };
  const reorder = (order) => {
    if (
      order.length !== queue.length ||
      new Set(order).size !== queue.length ||
      order.some((i) => !Number.isInteger(i) || i < 0 || i >= queue.length)
    )
      return;
    const playing = current();
    queue = order.map((i) => queue[i]);
    index = queue.indexOf(playing);
    render();
  };
  const bound = new WeakSet();
  const bindDocument = (doc) => {
    if (bound.has(doc)) return;
    bound.add(doc);
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("input", onSeek, true);
    doc.addEventListener("keydown", onKey, true);
    if (doc !== document) {
      render();
      refreshQueue();
    }
    refreshLikes();
  };
  window.SonaryPlayer = {
    enqueue,
    playTrack,
    playPlaylist,
    next,
    setVolume,
    toggleMute,
    reorder,
    bindDocument,
    swipeQueue,
    likeTrack,
    refreshLikes,
    refreshUI: render,
  };
  const onClick = (event) => {
    const button = event.target.closest(
      "button,.playlist-art-shell,.profile-playlist-cover",
    );
    if (!button || button.disabled) return;
    if (button.closest(".delete-mode,.is-remove-mode")) return;
    const playlist = button.closest("[data-playlist-id]");
    let action;
    if (button.matches(".card-like-btn,.track-like-action,.track-like-btn"))
      action = () =>
        likeTrack(button.closest("[data-track-id]")?.dataset.trackId);
    else if (button.closest(".player-buttons")) {
      const at = [...button.parentElement.children].indexOf(button);
      action =
        at === 0
          ? () => {
              if (audio.currentTime > 3 || index === 0) audio.currentTime = 0;
              else if (index > 0) select(index - 1);
            }
          : at === 1
            ? toggle
            : next;
    } else if (button.matches(".listen-playlist-btn") && playlist)
      action = () => playPlaylist(playlist.dataset.playlistId);
    else if (
      button.matches(
        ".card-play-btn,.profile-track-actions button:first-child,.track-detail-page .listen-playlist-btn",
      )
    ) {
      const row = button.closest("[data-track-id]");
      if (row && !row.classList.contains("is-remove-mode"))
        action = () => playTrack(row.dataset.trackId);
    } else if (
      button.matches(".playlist-art-shell,.profile-playlist-cover") &&
      playlist
    )
      action = () => playPlaylist(playlist.dataset.playlistId);
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      action();
    }
  };
  const onSeek = (event) => {
    const slider = event.target.closest(".track-progress-slider");
    if (!slider) return;
    event.stopImmediatePropagation();
    if (
      slider.closest("[data-track-id]")?.dataset.trackId ===
        String(current()?.id) &&
      Number.isFinite(audio.duration)
    )
      audio.currentTime = (Number(slider.value) / 100) * audio.duration;
    progress();
    save();
  };
  audio.addEventListener("ended", next);
  let animationFrame = null;
  const stopAnimation = () => {
    if (animationFrame !== null) window.cancelAnimationFrame?.(animationFrame);
    animationFrame = null;
    progress();
  };
  const animateProgress = () => {
    animationFrame = null;
    if (audio.paused || audio.ended) return;
    progress();
    animationFrame = window.requestAnimationFrame?.(animateProgress) ?? null;
  };
  audio.addEventListener("playing", () => {
    stopAnimation();
    animateProgress();
  });
  audio.addEventListener("pause", stopAnimation);
  audio.addEventListener("ended", stopAnimation);
  audio.addEventListener("play", render);
  audio.addEventListener("pause", render);
  audio.addEventListener("error", () => {
    notify();
    render();
  });
  audio.addEventListener("timeupdate", () => {
    progress();
    if (Date.now() - lastSaved > 1000) {
      save();
      lastSaved = Date.now();
    }
  });
  const onKey = (event) => {
    if (
      ["Enter", " "].includes(event.key) &&
      event.target.matches(".playlist-art-shell,.profile-playlist-cover")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.target.click();
    }
  };
  bindDocument(document);
  window.addEventListener("pagehide", () => {
    save();
    leaving = true;
    audio.pause();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      leaving = false;
      render();
    }
  });
  document.addEventListener("sonary:queue-ready", renderQueue);
  document.addEventListener("sonary:language", render);
  document.addEventListener("DOMContentLoaded", async () => {
    let state;
    try {
      state = JSON.parse(sessionStorage.getItem(key));
    } catch {}
    const token = generation;
    if (state && Array.isArray(state.ids)) {
      const restored = await Promise.all(
        state.ids
          .slice(0, 500)
          .map((id) =>
            Number.isSafeInteger(id) && id > 0
              ? getTrack(id).catch(() => null)
              : null,
          ),
      );
      if (token !== generation) return;
      queue = restored.filter((track) => track?.audio_url);
      const at =
        restored.slice(0, state.index + 1).filter((track) => track?.audio_url)
          .length - 1;
      select(
        queue.length ? Math.max(0, at) : -1,
        Boolean(state.playing),
        Math.max(0, Number(state.position) || 0),
      );
    } else render();
  });
})();
