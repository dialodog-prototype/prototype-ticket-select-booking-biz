import { prepareModalOverlay } from "../../shared/components/modal.js";
import { getCalendarMatrix, getMonthLabel, shiftMonth } from "../school-home/school-home-state.js";
import { createElement } from "../../shared/utils/dom.js";

export function createReservationDatePicker({ selectedDate, getDisabledDates, onSelect, onClose }) {
  const overlay = document.querySelector('[data-template="reservationDatePicker"]').content.firstElementChild.cloneNode(true);
  let month = selectedDate.slice(0, 7);
  const close = () => { overlay.remove(); onClose(); };
  prepareModalOverlay(overlay, { onEscape: close });
  const renderDates = () => {
    overlay.querySelector('[data-field="calendarMonth"]').textContent = getMonthLabel(month);
    const dates = overlay.querySelector('[data-area="calendarDates"]');
    dates.replaceChildren();
    const disabledDates = getDisabledDates();
    getCalendarMatrix(month).forEach((week) => {
      const row = createElement("div", { className: "reservation-datepicker__week" });
      week.forEach((cell) => {
        const button = createElement("button", {
          className: "reservation-datepicker__date",
          type: "button",
          textContent: String(cell.dayNumber),
          ariaLabel: `${cell.dateKey}${disabledDates.has(cell.dateKey) ? " 이미 예약됨" : ""}`,
          dataset: { action: "selectReservationDate", date: cell.dateKey, state: cell.dateKey === selectedDate ? "selected" : cell.isCurrentMonth ? "normal" : "muted" },
        });
        button.disabled = disabledDates.has(cell.dateKey);
        button.setAttribute("aria-pressed", String(cell.dateKey === selectedDate));
        button.addEventListener("click", () => {
          if (getDisabledDates().has(cell.dateKey)) { renderDates(); return; }
          onSelect(cell.dateKey);
          close();
        });
        row.append(button);
      });
      dates.append(row);
    });
  };
  for (const [action, offset] of [["previousMonth", -1], ["nextMonth", 1]]) {
    overlay.querySelector(`[data-action="${action}"]`).addEventListener("click", () => { month = shiftMonth(month, offset); renderDates(); });
  }
  overlay.querySelector('[data-action="closeDatePicker"]').addEventListener("click", close);
  renderDates();
  return overlay;
}
