import { createModalOverlay } from "./modal.js";
import { createElement } from "../utils/dom.js";
import { getTicketReservableCount } from "../services/school-reservation-ticket-service.js";

export function createSchoolReservationTicketSheet({ tickets, selectedId, getLabel, getValidityLabel, showReservableCount = true, formatReservableCount = (count) => `예약 가능 : ${count}회`, showValidity = true, isDisabled = () => false, onSelect, onClose }) {
  let pendingId = selectedId || "";
  const close = () => { overlay.remove(); onClose?.(); };
  const overlay = createModalOverlay({ className: "school-app-ticket-sheet-overlay", dataset: { area: "reservationTicketSheet" } }, { onEscape: close });
  const sheet = createElement("div", { className: "school-app-ticket-sheet" });
  sheet.setAttribute("aria-label", "이용권 선택");
  const header = createElement("header", { className: "school-app-ticket-sheet-header" });
  const closeButton = createElement("button", { className: "button button--icon", type: "button", ariaLabel: "이용권 선택 닫기", dataset: { action: "closeTicketSheet" } });
  closeButton.append(createElement("img", { className: "button__icon", src: "../assets/iconClose.svg", alt: "" }));
  closeButton.addEventListener("click", close);
  header.append(createElement("h2", { textContent: "이용권 선택" }), closeButton);
  const list = createElement("div", { className: "school-app-ticket-sheet-list" });
  const content = createElement("div", { className: "school-app-ticket-sheet-content" });
  const controls = new Map();
  const updateSelection = () => {
    controls.forEach(({ option, radio, ticket }) => {
      radio.checked = ticket.id === pendingId;
      radio.disabled = isDisabled(ticket);
      option.classList.toggle("is-selected", radio.checked);
      option.dataset.state = radio.disabled ? "disabled" : radio.checked ? "selected" : "idle";
    });
  };
  if (!tickets.length) list.append(createElement("p", { className: "school-registration-ticket-empty", textContent: "사용 가능한 이용권이 없습니다." }));
  tickets.forEach((ticket) => {
    const option = createElement("label", { className: "school-registration-ticket-option school-app-ticket-sheet-option" });
    const radio = createElement("input", {
      type: "radio", value: ticket.id, ariaLabel: `${getLabel(ticket)} 선택`,
      dataset: { action: "selectReservationTicket", entityId: ticket.id },
    });
    radio.name = "ticketSheetSelection";
    radio.addEventListener("click", () => {
      if (isDisabled(ticket)) { updateSelection(); return; }
      if (ticket.id === selectedId) { close(); return; }
      pendingId = ticket.id;
      updateSelection();
      overlay.remove();
      onSelect(ticket);
    });
    const text = createElement("span", { className: "school-app-ticket-sheet-text" });
    const details = createElement("span", { className: "school-app-ticket-sheet-details" });
    if (showReservableCount) {
      details.append(createElement("span", { textContent: formatReservableCount(getTicketReservableCount(ticket)) }));
    }
    if (showValidity) {
      details.append(createElement("span", { className: "school-app-ticket-sheet-validity", textContent: `기간 : ${getValidityLabel(ticket)}` }));
    }
    text.append(createElement("strong", { textContent: getLabel(ticket) }), details);
    option.append(radio, text);
    controls.set(ticket.id, { option, radio, ticket });
    list.append(option);
  });
  updateSelection();
  content.append(list);
  sheet.append(header, content);
  overlay.append(sheet);
  return overlay;
}
