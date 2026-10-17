import { createModalOverlay } from "./modal.js";
import { createElement } from "../utils/dom.js";

export function createSchoolReservationTicketSheet({ tickets, selectedId, getLabel, isDisabled = () => false, onSelect, onClose }) {
  const close = () => { overlay.remove(); onClose?.(); };
  const overlay = createModalOverlay({ className: "school-app-ticket-sheet-overlay", dataset: { area: "reservationTicketSheet" } }, { onEscape: close });
  const sheet = createElement("div", { className: "school-app-ticket-sheet" });
  sheet.setAttribute("aria-label", "이용권 선택");
  const header = createElement("header", { className: "school-app-ticket-sheet-header" });
  const closeButton = createElement("button", { className: "button button--icon", type: "button", textContent: "×", ariaLabel: "이용권 선택 닫기", dataset: { action: "closeTicketSheet" } });
  closeButton.addEventListener("click", close);
  header.append(createElement("h2", { textContent: "이용권 선택" }), closeButton);
  const list = createElement("div", { className: "school-app-ticket-sheet-list" });
  if (!tickets.length) list.append(createElement("p", { className: "school-registration-ticket-empty", textContent: "사용 가능한 이용권이 없습니다." }));
  tickets.forEach((ticket) => {
    const option = createElement("button", { className: `school-registration-ticket-option${ticket.id === selectedId ? " is-selected" : ""}`, type: "button", textContent: getLabel(ticket), dataset: { action: "selectReservationTicket", entityId: ticket.id } });
    option.setAttribute("aria-pressed", String(ticket.id === selectedId));
    option.disabled = isDisabled(ticket);
    option.addEventListener("click", () => { overlay.remove(); onSelect(ticket); });
    list.append(option);
  });
  sheet.append(header, list);
  overlay.append(sheet);
  return overlay;
}
