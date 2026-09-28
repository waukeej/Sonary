(() => {
  const locale = () =>
    document.documentElement.lang === "en" ? "en-US" : "ru-RU";
  const monthNames = () =>
    Array.from({ length: 12 }, (_, month) =>
      new Intl.DateTimeFormat(locale(), { month: "long" }).format(
        new Date(2026, month, 1),
      ),
    );
  const weekdays = () =>
    Array.from({ length: 7 }, (_, day) =>
      new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(
        new Date(2026, 0, 5 + day),
      ),
    );

  document.addEventListener("DOMContentLoaded", () => {
    const periodToggle = document.getElementById("calendarPeriodToggle");
    const periodLabel = document.getElementById("calendarPeriodLabel");
    const periodPopover = document.getElementById("calendarPeriodPopover");
    const periodGrid = document.getElementById("calendarPeriodGrid");
    const yearSwitch = document.getElementById("calendarYearSwitch");
    const grid = document.getElementById("calendarGrid");
    const summary = document.getElementById("calendarMonthSummary");
    const recordsModal = document.getElementById("calendarRecordsModal");
    const recordsTitle = document.getElementById("calendarRecordsTitle");
    const recordsList = document.getElementById("calendarRecordsList");
    if (
      !periodToggle ||
      !periodLabel ||
      !periodPopover ||
      !periodGrid ||
      !yearSwitch ||
      !grid ||
      !window.SonaryActivity
    )
      return;

    const today = new Date();
    const minMonth = new Date(
      window.SonaryActivity.accountCreatedAt.getFullYear(),
      window.SonaryActivity.accountCreatedAt.getMonth(),
      1,
    );
    const maxMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let shownYear = today.getFullYear();
    let shownMonth = today.getMonth();
    let periodView = "months";
    let formatDate = new Intl.DateTimeFormat(locale(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const previousButtons = [
      ...document.querySelectorAll("#calendarPrevious, #calendarGridPrevious"),
    ];
    const nextButtons = [
      ...document.querySelectorAll("#calendarNext, #calendarGridNext"),
    ];
    const isAvailableMonth = (year, month) => {
      const candidate = new Date(year, month, 1);
      return candidate >= minMonth && candidate <= maxMonth;
    };
    const clampShownMonth = () => {
      const candidate = new Date(shownYear, shownMonth, 1);
      if (candidate < minMonth) {
        shownYear = minMonth.getFullYear();
        shownMonth = minMonth.getMonth();
      }
      if (candidate > maxMonth) {
        shownYear = maxMonth.getFullYear();
        shownMonth = maxMonth.getMonth();
      }
    };

    const openRecords = (date) => {
      const entries = window.SonaryActivity.getEntries(date);
      const shortDate = date.toLocaleDateString(locale());
      if (!recordsModal || !recordsTitle || !recordsList) return;
      recordsTitle.textContent = `${window.SonaryI18n?.t("diary.records_for_date") || "Записи за"} ${formatDate.format(date)}`;
      recordsList.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "calendar-empty";
        empty.textContent =
          window.SonaryI18n?.translate("В этот день записей нет.") ||
          "В этот день записей нет.";
        recordsList.append(empty);
      } else {
        entries.forEach((entry) => {
          const source = document
            .getElementById("calendarCardTemplates")
            ?.content.querySelector(`[data-track-id="${entry.id}"]`);
          if (!source) return;
          const card = source.cloneNode(true);
          card.classList.add("calendar-record-card");
          recordsList.append(card);
        });
      }
      window.SonaryModal?.open(recordsModal);
    };

    const render = () => {
      clampShownMonth();
      const months = monthNames();
      periodLabel.textContent = `${months[shownMonth].toLowerCase()} ${shownYear}`;
      summary.textContent = `${months[shownMonth]} ${shownYear}`;
      previousButtons.forEach((button) => {
        button.disabled = !isAvailableMonth(shownYear, shownMonth - 1);
      });
      nextButtons.forEach((button) => {
        button.disabled = !isAvailableMonth(shownYear, shownMonth + 1);
      });
      grid.replaceChildren();
      weekdays().forEach((day) => {
        const header = document.createElement("div");
        header.className = "calendar-weekday";
        header.textContent = day;
        grid.append(header);
      });
      const firstWeekday =
        (new Date(shownYear, shownMonth, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(shownYear, shownMonth + 1, 0).getDate();
      for (let index = 0; index < firstWeekday; index += 1) {
        const filler = document.createElement("div");
        filler.className = "calendar-day calendar-day-empty";
        filler.setAttribute("aria-hidden", "true");
        grid.append(filler);
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(shownYear, shownMonth, day);
        const count = window.SonaryActivity.getCount(date);
        const button = document.createElement("button");
        const isToday = date.toDateString() === today.toDateString();
        button.type = "button";
        button.className = `calendar-day activity-${Math.min(count, 4)}${isToday ? " is-today" : ""}`;
        const entryWord =
          locale() === "en-US"
            ? count === 1
              ? "entry"
              : "entries"
            : count === 1
              ? "запись"
              : "записи";
        const noEntry =
          window.SonaryI18n?.translate("записей нет") || "записей нет";
        const noEntries =
          window.SonaryI18n?.translate("Нет записей") || "Нет записей";
        button.setAttribute(
          "aria-label",
          `${formatDate.format(date)}: ${count ? `${count} ${entryWord}` : noEntry}`,
        );
        button.innerHTML = `<span class="calendar-day-number">${day}</span>${count ? `<span class="calendar-day-count">${count} ${entryWord}</span>` : `<span class="calendar-day-empty-text">${noEntries}</span>`}`;
        button.addEventListener("click", () => {
          grid.querySelector(".is-selected")?.classList.remove("is-selected");
          button.classList.add("is-selected");
          openRecords(date);
        });
        grid.append(button);
      }
      const trailingDays = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
      for (let index = 0; index < trailingDays; index += 1) {
        const filler = document.createElement("div");
        filler.className = "calendar-day calendar-day-empty";
        filler.setAttribute("aria-hidden", "true");
        grid.append(filler);
      }
      grid.style.setProperty(
        "--calendar-week-rows",
        String((firstWeekday + daysInMonth + trailingDays) / 7),
      );
    };

    const renderPeriodPicker = () => {
      periodGrid.replaceChildren();
      if (periodView === "months") {
        yearSwitch.textContent = String(shownYear);
        monthNames().forEach((name, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `calendar-period-option${index === shownMonth ? " is-selected" : ""}`;
          button.disabled = !isAvailableMonth(shownYear, index);
          button.textContent = name.slice(0, 3).toLowerCase();
          button.addEventListener("click", () => {
            shownMonth = index;
            periodPopover.hidden = true;
            periodToggle.setAttribute("aria-expanded", "false");
            render();
          });
          periodGrid.append(button);
        });
        return;
      }
      const firstYear = minMonth.getFullYear();
      const lastYear = maxMonth.getFullYear();
      yearSwitch.textContent = `${firstYear} – ${lastYear}`;
      for (let year = firstYear; year <= lastYear; year += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `calendar-period-option${year === shownYear ? " is-selected" : ""}`;
        button.textContent = String(year);
        button.addEventListener("click", () => {
          shownYear = year;
          clampShownMonth();
          periodView = "months";
          renderPeriodPicker();
        });
        periodGrid.append(button);
      }
    };

    const changeMonth = (delta) => {
      const date = new Date(shownYear, shownMonth + delta, 1);
      if (!isAvailableMonth(date.getFullYear(), date.getMonth())) return;
      shownYear = date.getFullYear();
      shownMonth = date.getMonth();
      render();
    };
    const closeRecords = () => {
      grid.querySelector(".is-selected")?.classList.remove("is-selected");
      window.SonaryModal?.close(recordsModal);
    };
    periodToggle.addEventListener("click", () => {
      const willOpen = periodPopover.hidden;
      periodPopover.hidden = !willOpen;
      periodToggle.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        periodView = "months";
        renderPeriodPicker();
      }
    });
    yearSwitch.addEventListener("click", () => {
      periodView = periodView === "months" ? "years" : "months";
      renderPeriodPicker();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".calendar-period-control")) {
        periodPopover.hidden = true;
        periodToggle.setAttribute("aria-expanded", "false");
      }
    });
    previousButtons.forEach((button) =>
      button.addEventListener("click", () => changeMonth(-1)),
    );
    nextButtons.forEach((button) =>
      button.addEventListener("click", () => changeMonth(1)),
    );
    document
      .getElementById("calendarRecordsClose")
      ?.addEventListener("click", closeRecords);
    recordsModal?.addEventListener("click", (event) => {
      if (event.target === recordsModal) closeRecords();
    });
    render();
    document.addEventListener("sonary:language", () => {
      formatDate = new Intl.DateTimeFormat(locale(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      render();
      if (!periodPopover.hidden) renderPeriodPicker();
    });
  });
})();
