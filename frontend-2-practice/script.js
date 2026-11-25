"use strict";

// Демонстрационное расписание
const SLOT_TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const BUSY_TIMES_EVEN = ["11:00", "13:00", "18:00"];
const BUSY_TIMES_ODD = ["10:00", "12:00", "17:00"];
const MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const DAY_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });

// Даты и расписание без зависимости от разметки
function calendarDate(year, month, day) {
  return new Date(year, month, day, 12);
}

function compareDates(first, second) {
  const firstDay = calendarDate(first.getFullYear(), first.getMonth(), first.getDate());
  const secondDay = calendarDate(second.getFullYear(), second.getMonth(), second.getDate());
  return Math.sign(firstDay - secondDay);
}

function isDateSelectable(date, today) {
  return compareDates(date, today) >= 0;
}

function buildCalendarGrid(year, month) {
  const firstDay = calendarDate(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7; // Неделя начинается с понедельника.
  const daysInMonth = calendarDate(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = calendarDate(year, month, index - leadingDays + 1);
    return { date, otherMonth: date.getMonth() !== month };
  });
}

function isFullyBooked(date) {
  return date.getDay() === 5; // По пятницам показываем сценарий «всё занято».
}

function getSlotsForDay(date) {
  if (isFullyBooked(date)) return [];

  const busyTimes = date.getDate() % 2 === 0 ? BUSY_TIMES_EVEN : BUSY_TIMES_ODD;
  return SLOT_TIMES.map(time => ({ time, available: !busyTimes.includes(time) }));
}

function firstAvailableDay(date) {
  let next = date;
  while (isFullyBooked(next)) {
    next = calendarDate(next.getFullYear(), next.getMonth(), next.getDate() + 1);
  }
  return next;
}

function capitalize(text) {
  return text[0].toUpperCase() + text.slice(1);
}

function formatDate(date, includeYear = false) {
  const label = `${capitalize(WEEKDAY_FORMAT.format(date))}, ${DAY_FORMAT.format(date)}`;
  return includeYear ? `${label} ${date.getFullYear()}` : label;
}

function init() {
  const today = new Date();
  const initialDate = firstAvailableDay(calendarDate(today.getFullYear(), today.getMonth(), today.getDate()));
  const state = {
    currentYear: initialDate.getFullYear(),
    currentMonth: initialDate.getMonth(),
    selectedDay: initialDate,
    selectedTime: null,
    slots: getSlotsForDay(initialDate),
  };

  const monthTitle = document.querySelector("#month-title");
  const calendar = document.querySelector(".calendar__days");
  const slotGrid = document.querySelector(".slots");
  const availabilityDate = document.querySelector(".availability__date");
  const emptyDay = document.querySelector(".empty-day");
  const emptyHint = document.querySelector(".empty-day__hint");
  const emptyAction = document.querySelector(".empty-day__action-text");
  const suggestedDayButton = document.querySelector(".empty-day .action");
  const summary = document.querySelector(".visit-summary__text");
  const summaryCheckmark = document.querySelector(".visit-summary .icon");
  const nextButton = document.querySelector(".action--next");
  const backButton = document.querySelector(".action--back");
  const message = document.querySelector(".booking-message");

  // Рендер календаря и свободного времени
  function renderCalendar() {
    const { currentYear, currentMonth, selectedDay } = state;
    const monthStart = calendarDate(currentYear, currentMonth, 1);
    monthTitle.textContent = `${capitalize(MONTH_FORMAT.format(monthStart))} ${currentYear}`;

    calendar.innerHTML = buildCalendarGrid(currentYear, currentMonth).map(({ date, otherMonth }) => {
      const day = date.getDate();
      if (otherMonth) return `<span class="day day--muted" aria-hidden="true">${day}</span>`;

      const disabled = !isDateSelectable(date, today);
      const isSelected = compareDates(date, selectedDay) === 0;
      const isToday = compareDates(date, today) === 0;
      const isFull = !disabled && isFullyBooked(date);
      const label = `${formatDate(date, true)}${isFull ? ", нет свободных слотов" : ""}`;

      return `<button class="day${isFull ? " day--full" : ""}" type="button"
        data-day="${day}" aria-label="${label}" aria-pressed="${isSelected}"
        ${isToday ? 'aria-current="date"' : ""} ${disabled ? "disabled" : ""}>${day}</button>`;
    }).join("");

    calendar.querySelectorAll(".day:not(:disabled)[data-day]").forEach(button => {
      button.addEventListener("click", onDayClick);
    });
  }

  function renderTimeSlots() {
    const hasSlots = state.slots.length > 0;
    availabilityDate.textContent = formatDate(state.selectedDay);
    slotGrid.hidden = !hasSlots;
    emptyDay.hidden = hasSlots;

    if (!hasSlots) {
      const suggestedDate = firstAvailableDay(state.selectedDay);
      emptyHint.textContent = `Следующий день со свободными слотами — ${formatDate(suggestedDate).toLowerCase()}.`;
      emptyAction.textContent = `Выбрать ${DAY_FORMAT.format(suggestedDate)}`;
    }

    slotGrid.innerHTML = state.slots.map(({ time, available }) => {
      if (!available) {
        return `<button class="slot slot--busy" type="button" disabled>
          <span class="slot__time">${time}</span><span class="slot__status">занято</span>
        </button>`;
      }

      return `<button class="slot" type="button" data-time="${time}" aria-pressed="${time === state.selectedTime}">
        <span class="slot__time">${time}</span>
      </button>`;
    }).join("");

    slotGrid.querySelectorAll("[data-time]").forEach(button => {
      button.addEventListener("click", onTimeSlotClick);
    });
  }

  function updateBottomBar() {
    const { selectedDay, selectedTime, slots } = state;
    const timeLabel = selectedTime ?? (slots.length ? "время не выбрано" : "нет свободных слотов");
    summary.textContent = `${formatDate(selectedDay, true)} • ${timeLabel}`;
    summaryCheckmark.toggleAttribute("hidden", !selectedTime);
    nextButton.disabled = !selectedTime;
  }

  // Обработчики. После замены кнопок восстанавливаем фокус на выборе.
  function selectDay(date) {
    if (!isDateSelectable(date, today) || compareDates(date, state.selectedDay) === 0) return;

    state.selectedDay = date;
    state.currentMonth = date.getMonth();
    state.currentYear = date.getFullYear();
    state.selectedTime = null;
    state.slots = getSlotsForDay(date);
    message.textContent = "";
    renderCalendar();
    renderTimeSlots();
    updateBottomBar();
    calendar.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }

  function onDayClick(event) {
    const day = Number(event.currentTarget.dataset.day);
    selectDay(calendarDate(state.currentYear, state.currentMonth, day));
  }

  function onTimeSlotClick(event) {
    const { time } = event.currentTarget.dataset;
    if (!state.slots.some(slot => slot.available && slot.time === time)) return;

    state.selectedTime = time;
    message.textContent = "";
    renderTimeSlots();
    updateBottomBar();
    slotGrid.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }

  function setupMonthNavigation() {
    document.querySelectorAll("[data-month-offset]").forEach(button => {
      button.addEventListener("click", event => {
        const offset = Number(event.currentTarget.dataset.monthOffset);
        const month = calendarDate(state.currentYear, state.currentMonth + offset, 1);
        state.currentYear = month.getFullYear();
        state.currentMonth = month.getMonth();
        // Перелистывание меняет только календарь. Выбор меняется по клику на день.
        renderCalendar();
      });
    });
  }

  setupMonthNavigation();
  suggestedDayButton.addEventListener("click", () => selectDay(firstAvailableDay(state.selectedDay)));
  nextButton.addEventListener("click", () => {
    if (!state.selectedTime) return;
    message.textContent = "Дата и время выбраны. Следующий шаг — контактные данные.";
  });
  backButton.addEventListener("click", () => {
    message.textContent = "Предыдущий шаг — выбор услуги.";
  });

  renderCalendar();
  renderTimeSlots();
  updateBottomBar();
}

document.addEventListener("DOMContentLoaded", init);
