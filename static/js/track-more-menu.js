document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("trackMoreBtn");
  const menu = document.getElementById("trackMoreMenu");
  if (!button || !menu) return;
  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !event.target.closest(".track-more-wrap")) close();
  });
  menu.querySelector("button:nth-of-type(2)")?.addEventListener("click", () => {
    const review = document.querySelector(".track-long-text");
    window.openDeleteMockDialogs?.(
      [review],
      () => {},
      "отзыв",
      async () => {
        const page = document.querySelector(".track-detail-page");
        const data = new FormData();
        return window.SonaryDiary.send(page.dataset.deleteUrl, data);
      },
    );
    close();
  });
});
