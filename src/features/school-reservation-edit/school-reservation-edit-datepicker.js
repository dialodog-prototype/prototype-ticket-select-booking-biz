import { prepareModalOverlay } from "../../shared/components/modal.js";
import { getCalendarMatrix, getMonthLabel, shiftMonth } from "../school-home/school-home-state.js";
import { createElement } from "../../shared/utils/dom.js";

export function createReservationDatePicker({ selectedDate, originalDate = selectedDate, getDisabledDates, onSelect, onClose, presentation = "modal", trigger, onUnavailable }) {
  const overlay = document.querySelector('[data-template="reservationDatePicker"]').content.firstElementChild.cloneNode(true);
  const isPopover = presentation === "popover";
  const isBottomSheet = !isPopover && window.matchMedia("(max-width: 430px)").matches;
  let pendingDate = selectedDate;
  const confirmButton = overlay.querySelector('[data-action="confirmReservationDate"]');
  if (isBottomSheet) {
    overlay.className = "app-bottom-sheet-overlay";
    overlay.querySelector('[role="dialog"]').className = "app-bottom-sheet";
    overlay.querySelector('[data-area="datePickerContent"]').className = "reservation-datepicker__body";
    const header = overlay.querySelector('[data-area="datePickerHeader"]');
    const closeButton = overlay.querySelector('[data-action="closeDatePicker"]');
    header.className = "reservation-datepicker__header";
    closeButton.className = "button button--secondary";
    header.prepend(closeButton);
    overlay.querySelector('[data-area="datePickerActions"]').className = "reservation-datepicker__actions modal-footer-actions";
    confirmButton.hidden = false;
  }
  let month = selectedDate.slice(0, 7);
  const close = () => {
    document.removeEventListener("pointerdown", handleOutside);
    document.removeEventListener("keydown", handleKeydown);
    overlay.remove();
    onClose();
  };
  const handleOutside = (event) => {
    if (!overlay.contains(event.target) && !trigger?.contains(event.target)) close();
  };
  const handleKeydown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };
  if (isPopover) {
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeydown);
  } else {
    prepareModalOverlay(overlay, { onEscape: close });
  }
  const renderDates = () => {
    overlay.querySelector('[data-field="calendarMonth"]').textContent = getMonthLabel(month);
    const dates = overlay.querySelector('[data-area="calendarDates"]');
    dates.replaceChildren();
    const disabledDates = getDisabledDates();
    if (isBottomSheet) confirmButton.disabled = pendingDate === originalDate || disabledDates.has(pendingDate);
    getCalendarMatrix(month).forEach((week) => {
      if (isPopover && !week.some((cell) => cell.isCurrentMonth)) return;
      const row = createElement("div", { className: "reservation-datepicker__week" });
      week.forEach((cell) => {
        const button = createElement("button", {
          className: "reservation-datepicker__date",
          type: "button",
          textContent: String(cell.dayNumber),
          ariaLabel: `${cell.dateKey}${disabledDates.has(cell.dateKey) ? " 이미 예약됨" : ""}`,
          dataset: { action: "selectReservationDate", date: cell.dateKey, state: cell.dateKey === pendingDate ? "selected" : cell.isCurrentMonth ? "normal" : "muted" },
        });
        button.disabled = disabledDates.has(cell.dateKey) || (isPopover && !cell.isCurrentMonth);
        if (isPopover && !cell.isCurrentMonth) button.dataset.state = "muted";
        button.setAttribute("aria-pressed", String(cell.dateKey === pendingDate));
        button.addEventListener("click", () => {
          if (getDisabledDates().has(cell.dateKey)) {
            renderDates();
            onUnavailable?.(cell.dateKey);
            return;
          }
          if (isBottomSheet) {
            pendingDate = cell.dateKey;
            renderDates();
            return;
          }
          if (onSelect(cell.dateKey) === false) return;
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
  if (isBottomSheet) confirmButton.addEventListener("click", () => {
    if (pendingDate === originalDate || getDisabledDates().has(pendingDate)) {
      renderDates();
      return;
    }
    if (onSelect(pendingDate) === false) return;
    close();
  });
  overlay.querySelector('[data-action="closeDatePicker"]')?.addEventListener("click", close);
  renderDates();
  return overlay;
}
