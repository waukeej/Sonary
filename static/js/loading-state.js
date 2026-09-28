(() => {
  if (window.SonaryLoading) return;

  const content = document.querySelector(".content");
  const contentWrapper = content?.closest(".content-wrapper");
  if (!content || !contentWrapper) return;

  const loadingTargets = [...content.querySelectorAll("[data-loading-target]")];
  const hasExplicitTargets = loadingTargets.length > 0;
  const itemLoadingMode = document.body.hasAttribute("data-loading-items");
  const heroTargets = [...content.querySelectorAll("[data-loading-hero]")];
  heroTargets.forEach((hero) => hero.classList.add("sonary-hero-loading"));

  document.head.insertAdjacentHTML(
    "beforeend",
    `<style>
    .sonary-loading-host{position:relative}
    .sonary-loading-layer{position:absolute;z-index:40;overflow:hidden;padding:16px;background:var(--theme-background);color:var(--theme-text);opacity:1;transition:opacity .28s ease}
    .sonary-loading-layer.is-targeted{padding:0;border-radius:inherit}
    .sonary-loading-layer.is-hiding{opacity:0;pointer-events:none}
    .sonary-skeleton-view{width:100%;height:100%;box-sizing:border-box}
    .sonary-skeleton-list{display:grid;align-content:start;gap:8px}
    .sonary-skeleton-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:14px}
    .sonary-skeleton-row{display:grid;grid-template-columns:52px minmax(0,1fr) 46px auto;align-items:center;gap:14px;min-height:70px;padding:9px 12px;box-sizing:border-box;border:1px solid var(--theme-border);border-radius:7px;background:var(--theme-surface)}
    .sonary-skeleton-playlist{display:grid;grid-template-columns:76px minmax(0,1fr) var(--button-size);align-items:center;gap:14px;min-height:102px;padding:12px;box-sizing:border-box;border:1px solid var(--theme-border);border-radius:7px;background:var(--theme-surface)}
    .sonary-skeleton-card{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:12px;min-height:174px;padding:14px;box-sizing:border-box;border:1px solid var(--theme-border);border-radius:8px;background:var(--theme-surface)}
    .sonary-skeleton-card-main{display:grid;grid-template-columns:64px minmax(100px,.55fr) minmax(140px,1fr) minmax(180px,.72fr);align-items:center;gap:14px;min-width:0}
    .sonary-skeleton-card-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .sonary-skeleton-badge{height:40px;box-sizing:border-box;border:1px solid var(--theme-accent);border-radius:5px;background:var(--theme-inactive)}
    .sonary-skeleton-card-footer{display:grid;grid-template-columns:34px minmax(70px,1fr) 34px auto;align-items:center;gap:10px;min-width:0}
    .sonary-skeleton-progress{height:4px;border-radius:999px;background:linear-gradient(90deg,var(--theme-inactive) 20%,var(--theme-border) 45%,var(--theme-inactive) 70%);background-size:220% 100%;animation:sonary-shimmer 1.2s ease-in-out infinite}
    .sonary-skeleton-time{width:28px;height:10px;border-radius:999px;background:var(--theme-inactive)}
    .sonary-skeleton-media{display:grid;width:52px;height:52px;place-items:center;border:1px solid var(--theme-border);border-radius:6px;background:var(--theme-inactive)}
    .sonary-skeleton-playlist .sonary-skeleton-media{width:76px;height:76px}
    .sonary-skeleton-card .sonary-skeleton-media{width:64px;height:64px}
    .sonary-loading-spinner{width:22px;height:22px;box-sizing:border-box;border:3px solid var(--theme-border);border-top-color:var(--theme-accent);border-radius:50%;animation:sonary-spin .8s linear infinite}
    .sonary-skeleton-copy{display:grid;gap:8px;min-width:0}
    .sonary-skeleton-line{display:block;width:100%;height:12px;border-radius:999px;background:linear-gradient(90deg,var(--theme-inactive) 20%,var(--theme-border) 45%,var(--theme-inactive) 70%);background-size:220% 100%;animation:sonary-shimmer 1.2s ease-in-out infinite}
    .sonary-skeleton-line.short{width:42%}.sonary-skeleton-line.medium{width:68%}.sonary-skeleton-line.tiny{width:28%}
    .sonary-skeleton-actions{display:flex;justify-content:flex-end;gap:8px}
    .sonary-skeleton-button{display:block;width:34px;height:34px;box-sizing:border-box;border:1px solid var(--theme-accent);border-radius:5px;background:var(--theme-inactive)}
    .sonary-skeleton-section-title{width:150px;height:24px;margin-bottom:14px}
    .sonary-skeleton-text{display:grid;align-content:start;gap:12px;height:100%;box-sizing:border-box;padding:18px;border:1px solid var(--theme-border);border-radius:8px;background:var(--theme-surface)}
    .sonary-skeleton-text .sonary-skeleton-line:nth-child(4n+2){width:88%}.sonary-skeleton-text .sonary-skeleton-line:nth-child(4n+3){width:72%}.sonary-skeleton-text .sonary-skeleton-line:nth-child(4n+4){width:94%}
    [data-loading-hero] .detail-cover-frame,[data-loading-hero] .profile-page-avatar{position:relative;overflow:hidden}
    [data-loading-hero] .detail-cover-frame::after,[data-loading-hero] .profile-page-avatar::after{content:"";position:absolute;top:50%;left:50%;width:34px;height:34px;box-sizing:border-box;border:4px solid var(--theme-border);border-top-color:var(--theme-accent);border-radius:50%;opacity:0;transform:translate(-50%,-50%);transition:opacity .25s ease}
    .sonary-hero-loading .detail-cover-frame::after,.sonary-hero-loading .profile-page-avatar::after{opacity:1;animation:sonary-hero-spin .8s linear infinite}
    [data-loading-hero] .detail-cover-frame>img{transition:opacity .25s ease,filter .25s ease}
    .sonary-hero-loading .detail-cover-frame>img{opacity:.18;filter:blur(7px)}
    .sonary-hero-loading .profile-page-avatar>.bi{opacity:0}
    [data-loading-hero] h1,[data-loading-hero] p,[data-loading-hero] .profile-counts span,[data-loading-hero] .track-detail-badges span{transition:color .28s ease,background-color .28s ease}
    .sonary-hero-loading h1,.sonary-hero-loading p,.sonary-hero-loading .profile-counts span,.sonary-hero-loading .track-detail-badges span{color:transparent!important;border-color:transparent!important;border-radius:999px;background:linear-gradient(90deg,var(--theme-inactive) 20%,var(--theme-border) 45%,var(--theme-inactive) 70%);background-size:220% 100%;animation:sonary-shimmer 1.2s ease-in-out infinite}
    .sonary-hero-loading h1{width:min(520px,72%)}.sonary-hero-loading p{width:min(430px,62%)}.sonary-hero-loading .track-detail-summary{width:min(560px,80%)}.sonary-hero-loading .track-detail-badges{width:min(360px,70%)}
    @keyframes sonary-hero-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
    @keyframes sonary-spin{to{transform:rotate(360deg)}}
    @keyframes sonary-shimmer{to{background-position:-220% 0}}
    @media(max-width:900px){.sonary-skeleton-grid{grid-template-columns:1fr}.sonary-skeleton-card-main{grid-template-columns:52px minmax(90px,.55fr) minmax(120px,1fr) minmax(180px,.72fr)}}
    @media(max-width:620px){.sonary-skeleton-row{grid-template-columns:44px minmax(0,1fr)}.sonary-skeleton-row>.sonary-skeleton-line,.sonary-skeleton-row>.sonary-skeleton-actions{grid-column:2}.sonary-skeleton-actions{justify-content:flex-start;flex-wrap:wrap}.sonary-skeleton-card{padding:10px}.sonary-skeleton-card-main{grid-template-columns:48px 84px minmax(0,1fr) 84px;gap:8px}.sonary-skeleton-card-badges{grid-template-columns:1fr;gap:6px}.sonary-skeleton-badge{height:30px}.sonary-skeleton-card-footer{grid-template-columns:28px minmax(50px,1fr) 28px auto;gap:6px}.sonary-skeleton-card-footer .sonary-skeleton-button{width:30px;height:30px}}
  </style>`,
  );

  document.head.insertAdjacentHTML(
    "beforeend",
    `<style>
    @media (max-width: 620px) {
      .sonary-skeleton-card-footer .sonary-skeleton-actions { display: none; }
      .sonary-skeleton-card-footer { grid-template-columns: 28px minmax(50px, 1fr) 28px; }
    }
  </style>`,
  );

  const line = (size = "") =>
    `<span class="sonary-skeleton-line ${size}"></span>`;
  const spinnerMedia = () =>
    '<div class="sonary-skeleton-media"><span class="sonary-loading-spinner" aria-hidden="true"></span></div>';
  const actions = (count = 4) =>
    `<div class="sonary-skeleton-actions">${Array.from({ length: count }, () => '<span class="sonary-skeleton-button"></span>').join("")}</div>`;
  const copy = () =>
    `<div class="sonary-skeleton-copy">${line()}${line("medium")}</div>`;

  const trackRows = (count = 5) =>
    Array.from(
      { length: count },
      () => `
    <div class="sonary-skeleton-row">${spinnerMedia()}${copy()}${line("tiny")}${actions(4)}</div>`,
    ).join("");

  const playlistCards = (count = 4) =>
    Array.from(
      { length: count },
      () => `
    <div class="sonary-skeleton-playlist">${spinnerMedia()}<div class="sonary-skeleton-copy">${line("medium")}${line()}${line("short")}</div>${actions(1)}</div>`,
    ).join("");

  const diaryCards = (count = 6) =>
    Array.from(
      { length: count },
      () => `
    <div class="sonary-skeleton-card">
      <div class="sonary-skeleton-card-main">${spinnerMedia()}${copy()}<div class="sonary-skeleton-copy">${line()}${line("medium")}</div><div class="sonary-skeleton-card-badges">${Array.from({ length: 4 }, () => '<span class="sonary-skeleton-badge"></span>').join("")}</div></div>
      <div class="sonary-skeleton-card-footer"><span class="sonary-skeleton-time"></span><span class="sonary-skeleton-progress"></span><span class="sonary-skeleton-time"></span>${actions(3)}</div>
    </div>`,
    ).join("");

  const longText = () =>
    `<div class="sonary-skeleton-text">${line("short")}${Array.from({ length: 14 }, () => line()).join("")}</div>`;

  const getVariant = (target) => {
    if (target.classList.contains("track-long-text")) return "text";
    if (target.classList.contains("playlist-track-list")) return "tracks";
    if (
      target.querySelector("#profileTracks") &&
      target.querySelector("#profilePlaylists")
    )
      return "profile-combined";
    if (target.querySelector("#profileTracks")) return "profile-tracks";
    if (target.querySelector("#profilePlaylists")) return "profile-playlists";
    if (content.classList.contains("playlists-page")) return "playlists";
    return "diary";
  };

  const skeletonFor = (variant) => {
    if (variant === "text") return longText();
    if (variant === "tracks")
      return `<div class="sonary-skeleton-view sonary-skeleton-list">${trackRows()}</div>`;
    if (variant === "profile-combined")
      return `<div class="sonary-skeleton-view"><div class="sonary-skeleton-line sonary-skeleton-section-title"></div><div class="sonary-skeleton-list">${trackRows()}</div><div class="sonary-skeleton-line sonary-skeleton-section-title" style="margin-top:30px"></div><div class="sonary-skeleton-grid">${playlistCards()}</div></div>`;
    if (variant === "profile-tracks")
      return `<div class="sonary-skeleton-view"><div class="sonary-skeleton-line sonary-skeleton-section-title"></div><div class="sonary-skeleton-list">${trackRows()}</div></div>`;
    if (variant === "profile-playlists")
      return `<div class="sonary-skeleton-view"><div class="sonary-skeleton-line sonary-skeleton-section-title"></div><div class="sonary-skeleton-grid">${playlistCards()}</div></div>`;
    if (variant === "playlists")
      return `<div class="sonary-skeleton-view sonary-skeleton-grid">${playlistCards(6)}</div>`;
    return `<div class="sonary-skeleton-view sonary-skeleton-grid">${diaryCards()}</div>`;
  };

  const createLayer = (variant, targeted = false) => {
    const layer = document.createElement("div");
    layer.className = `sonary-loading-layer${targeted ? " is-targeted" : ""}`;
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-label", "Загрузка контента");
    layer.innerHTML = skeletonFor(variant);
    return layer;
  };

  const layers = [];
  let fallbackLayer = null;

  if (hasExplicitTargets) {
    loadingTargets.forEach((target) => {
      const layer = createLayer(getVariant(target), true);
      target.classList.add("sonary-loading-host");
      target.append(layer);
      layer.style.inset = "0";
      layers.push(layer);
    });
  } else if (!itemLoadingMode) {
    fallbackLayer = createLayer(getVariant(content));
    contentWrapper.classList.add("sonary-loading-host");
    contentWrapper.append(fallbackLayer);
    layers.push(fallbackLayer);
  }

  const placeLayer = () => {
    if (!fallbackLayer) return;
    fallbackLayer.style.inset = "auto";
    const wrapperRect = contentWrapper.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const filterArea = content.querySelector(":scope > .filter-area");
    const filterRect = filterArea?.getBoundingClientRect();
    const contentTop = contentRect.top - wrapperRect.top;
    const loadingTop = filterRect
      ? Math.max(contentTop, filterRect.bottom - wrapperRect.top)
      : contentTop;
    fallbackLayer.style.top = `${loadingTop}px`;
    fallbackLayer.style.right = `${Math.max(0, wrapperRect.right - contentRect.right)}px`;
    fallbackLayer.style.bottom = `${Math.max(0, wrapperRect.bottom - contentRect.bottom)}px`;
    fallbackLayer.style.left = `${Math.max(0, contentRect.left - wrapperRect.left)}px`;
  };

  let hideTimer = null;
  const show = () => {
    clearTimeout(hideTimer);
    placeLayer();
    heroTargets.forEach((hero) => hero.classList.add("sonary-hero-loading"));
    layers.forEach((layer) => {
      layer.hidden = false;
      layer.classList.remove("is-hiding");
    });
  };
  const hide = () => {
    heroTargets.forEach((hero) => hero.classList.remove("sonary-hero-loading"));
    layers.forEach((layer) => layer.classList.add("is-hiding"));
    hideTimer = setTimeout(
      () =>
        layers.forEach((layer) => {
          layer.hidden = true;
        }),
      290,
    );
  };

  const resizeObserver = new ResizeObserver(placeLayer);
  resizeObserver.observe(contentWrapper);
  resizeObserver.observe(content);
  window.addEventListener("resize", placeLayer);
  content.addEventListener("scroll", placeLayer, { passive: true });

  window.SonaryLoading = {
    show,
    hide,
    element: layers[0] || null,
    elements: layers,
    reposition: placeLayer,
  };
  requestAnimationFrame(placeLayer);
  if (!document.body.hasAttribute("data-loading-persistent"))
    setTimeout(hide, 900);
})();
