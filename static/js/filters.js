document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const filteredPage = document.querySelector(".diary-page")
    ? "/diary"
    : document.querySelector(".playlists-page")
      ? "/playlists"
      : null;
  const fields = [
    ["mood", "moodFilter"],
    ["sort", "trackSort"],
  ];
  let requestController,
    committedQuery = location.search;
  const updateList = async (query) => {
    if (!filteredPage) return;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    const selector =
      filteredPage === "/diary" ? "#diaryTrackList" : "#playlistsGrid";
    const list = document.querySelector(selector),
      content = list?.closest("main");
    if (!list || !content) return;
    list.setAttribute("aria-busy", "true");
    const url = filteredPage + (query ? "?" + query : "");
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/html" },
      });
      if (!response.ok || response.redirected)
        throw new Error("Unable to load list");
      const page = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const replacement = page.querySelector(selector);
      if (!replacement) throw new Error("Missing list");
      if (controller.signal.aborted) return;
      document.dispatchEvent(
        new CustomEvent("sonary:popover-open", { detail: { type: "filters" } }),
      );
      list.replaceChildren(...replacement.childNodes);
      content
        .querySelectorAll(":scope > .diary-empty-results,:scope > .auth-error")
        .forEach((node) => node.remove());
      replacement
        .closest("main")
        .querySelectorAll(":scope > .diary-empty-results,:scope > .auth-error")
        .forEach((node) => list.before(node));
      committedQuery = query ? "?" + query : "";
                                                                               
      history.replaceState(history.state, "", url);
      if (window.parent !== window && window.parent.SonaryShell) {
        window.parent.history.replaceState({ sonary: url }, "", url);
      }
      document.dispatchEvent(new Event("sonary:list-updated"));
      window.SonaryPlayer?.refreshUI?.();
    } catch (error) {
      if (controller.signal.aborted) return;
      const previous = new URLSearchParams(committedQuery);
      fields.forEach(([key, id]) => {
        const input = document.getElementById(id);
        if (input) input.value = previous.get(key) || "";
      });
      window.SonaryUI?.notify(
        window.SonaryI18n?.translate(
          "Не удалось обновить список. Попробуйте снова.",
        ) || "Не удалось обновить список. Попробуйте снова.",
        "error",
      );
    } finally {
      if (requestController === controller) list.removeAttribute("aria-busy");
    }
  };
  if (filteredPage) {
    fields.forEach(([key, id]) => {
      const input = document.getElementById(id);
      if (input) input.value = params.get(key) || "";
    });
    const applyFilters = () => {
      const next = new URLSearchParams();
      fields.forEach(([key, id]) => {
        const value = document.getElementById(id)?.value;
        if (value) next.set(key, value);
      });
      updateList(next.toString());
    };
    fields.forEach(([, id]) => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
  }
  document
    .querySelector(".reset-filters-btn")
    ?.addEventListener("click", () => {
      if (filteredPage) {
        fields.forEach(([, id]) => {
          const input = document.getElementById(id);
          if (input) input.value = "";
        });
        updateList("");
        return;
      }
      const moodFilter = document.getElementById("moodFilter");
      if (moodFilter) moodFilter.value = "";
      const trackSort = document.getElementById("trackSort");
      if (trackSort) trackSort.value = "";
    });
});
