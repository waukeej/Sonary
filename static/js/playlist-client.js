(() => {
  const send = (url, data, root) => window.SonaryDiary.send(url, data, root);
  const submitIds = (url, key, ids) => {
    const data = new FormData();
    ids.forEach((id) => data.append(key, id));
    return send(url, data);
  };
  window.SonaryPlaylists = { send, submitIds };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-playlist-form]").forEach((form) =>
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
          const data = new FormData(form);
          if (
            form.dataset.sourceTrack &&
            !data.getAll("track_ids").includes(form.dataset.sourceTrack)
          )
            data.append("track_ids", form.dataset.sourceTrack);
          await send(form.action, data, form);
        } finally {
          button.disabled = false;
        }
      }),
    );
    const page = document.querySelector(".playlist-detail-page");
    const privacy = page?.querySelector(".playlist-private-toggle input");
    privacy?.addEventListener("change", async () => {
      privacy.disabled = true;
      const data = new FormData();
      data.set("privacy", privacy.checked ? "private" : "public");
      if (!(await send(`/playlist/${page.dataset.playlistId}/edit`, data)))
        privacy.checked = !privacy.checked;
      privacy.disabled = false;
    });
    page
      ?.querySelector(".playlist-search input")
      ?.addEventListener("input", (event) => {
        const query = event.target.value.toLocaleLowerCase();
        page
          .querySelectorAll(
            ".playlist-track-list > .profile-track[data-track-id]",
          )
          .forEach((row) => {
            row.hidden = !row
              .querySelector("section")
              .textContent.toLocaleLowerCase()
              .includes(query);
          });
        page.dispatchEvent(new Event("sonary:track-visibility"));
      });
  });
})();
