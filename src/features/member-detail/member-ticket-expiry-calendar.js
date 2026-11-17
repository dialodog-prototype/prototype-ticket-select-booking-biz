import { createElement } from "../../shared/utils/dom.js";
import { getCalendarMatrix, getMonthLabel, getTodayDateKey, shiftMonth } from "../school-home/school-home-state.js";

export function createTicketExpiryCalendar({ selectedDate, minDate, disabled = false, onSelect }) {
  let month = (selectedDate || minDate || getTodayDateKey()).slice(0, 7);
  const calendar = createElement("div", {
    className: "reservation-datepicker__body member-ticket-expiry-calendar",
    ariaLabel: "만료일 달력",
    dataset: { area: "ticketExpiryCalendar" },
  });
  const controls = createElement("div", { className: "reservation-datepicker__controls" });
  const previous = createElement("button", { className: "button button--month", type: "button", textContent: "‹", ariaLabel: "이전 달" });
  const title = createElement("strong", { className: "member-ticket-expiry-calendar__month", dataset: { field: "calendarMonth" } });
  title.setAttribute("aria-live", "polite");
  const next = createElement("button", { className: "button button--month", type: "button", textContent: "›", ariaLabel: "다음 달" });
  controls.append(previous, title, next);
  const weekdays = createElement("div", { className: "reservation-datepicker__week" });
  ["일", "월", "화", "수", "목", "금", "토"].forEach((day) => weekdays.append(createElement("span", { textContent: day })));
  const dates = createElement("div");
  const render = () => {
    title.textContent = getMonthLabel(month);
    previous.disabled = disabled || Boolean(minDate && shiftMonth(month, -1) < minDate.slice(0, 7));
    next.disabled = disabled;
    dates.replaceChildren();
    getCalendarMatrix(month).forEach((week) => {
      const row = createElement("div", { className: "reservation-datepicker__week" });
      week.forEach((cell) => {
        const isSelected = cell.dateKey === selectedDate;
        const button = createElement("button", {
          className: "reservation-datepicker__date",
          type: "button",
          textContent: String(cell.dayNumber),
          ariaLabel: `${cell.dateKey} 만료일 선택`,
          dataset: { action: "selectTicketExpiryDate", date: cell.dateKey, state: isSelected ? "selected" : cell.isCurrentMonth ? "normal" : "muted" },
        });
        button.disabled = disabled || !cell.isCurrentMonth || Boolean(minDate && cell.dateKey < minDate);
        button.setAttribute("aria-pressed", String(isSelected));
        button.addEventListener("click", () => {
          if (disabled || !cell.isCurrentMonth || (minDate && cell.dateKey < minDate)) return;
          onSelect(cell.dateKey);
        });
        row.append(button);
      });
      dates.append(row);
    });
  };
  previous.addEventListener("click", () => {
    if (previous.disabled) return;
    month = shiftMonth(month, -1);
    render();
  });
  next.addEventListener("click", () => {
    if (next.disabled) return;
    month = shiftMonth(month, 1);
    render();
  });
  calendar.append(controls, weekdays, dates);
  render();
  return calendar;
}
