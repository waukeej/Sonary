(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("profileHeatmap");
    if (!container || !window.SonaryActivity) return;
    const render = () => {
      const today = window.SonaryActivity.startOfDay(new Date());
      const accountCreatedAt = window.SonaryActivity.startOfDay(
        window.SonaryActivity.accountCreatedAt ||
          new Date(today.getFullYear(), 0, 1),
      );
      const locale = () =>
        document.documentElement.lang === "en" ? "en-US" : "ru-RU";
      const formatDate = new Intl.DateTimeFormat(locale(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const weekdays = document.createElement("div");
      weekdays.className = "profile-heatmap-weekdays";
      weekdays.innerHTML = Array.from(
        { length: 7 },
        (_, index) =>
          `<span>${new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(new Date(2026, 0, 5 + index))}</span>`,
      ).join("");
      const timeline = document.createElement("div");
      timeline.className = "profile-heatmap-timeline";
      container.replaceChildren(weekdays, timeline);
      const cursor = new Date(
        accountCreatedAt.getFullYear(),
        accountCreatedAt.getMonth(),
        1,
      );
      let currentYear = null;
      while (cursor <= today) {
        if (cursor.getFullYear() !== currentYear) {
          const year = document.createElement("h3");
          year.className = "profile-heatmap-year";
          year.textContent = String(cursor.getFullYear());
          timeline.append(year);
          currentYear = cursor.getFullYear();
        }
        const month = document.createElement("section");
        month.className = "profile-heatmap-month";
        const label = document.createElement("h4");
        label.textContent = cursor.toLocaleDateString(locale(), {
          month: "long",
        });
        const grid = document.createElement("div");
        grid.className = "profile-heatmap-grid";
        const firstWeekday =
          (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) %
          7;
        const daysInMonth = new Date(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          0,
        ).getDate();
        for (let index = 0; index < firstWeekday; index += 1)
          grid.append(document.createElement("i"));
        for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
          const date = new Date(
            cursor.getFullYear(),
            cursor.getMonth(),
            dayNumber,
          );
          const isBeforeAccount = date < accountCreatedAt;
          const count =
            isBeforeAccount || date > today
              ? 0
              : window.SonaryActivity.getCount(date);
          const day = document.createElement("span");
          day.className = `profile-heatmap-day activity-${Math.min(count, 4)}${date > today || isBeforeAccount ? " is-future" : ""}`;
          const entryWord =
            locale() === "en-US"
              ? count === 1
                ? "entry"
                : "entries"
              : "записей";
          const status = isBeforeAccount
            ? window.SonaryI18n?.translate("аккаунт ещё не создан") ||
              "аккаунт ещё не создан"
            : count
              ? `${count} ${entryWord}`
              : window.SonaryI18n?.translate("нет записей") || "нет записей";
          day.title = `${formatDate.format(date)}: ${status}`;
          day.setAttribute("aria-label", day.title);
          grid.append(day);
        }
        month.append(label, grid);
        timeline.append(month);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    };
    render();
    document.addEventListener("sonary:language", render);
  });
})();
