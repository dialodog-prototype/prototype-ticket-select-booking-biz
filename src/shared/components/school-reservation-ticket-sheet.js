import { createModalOverlay } from "./modal.js";
import { createElement } from "../utils/dom.js";

export function createSchoolReservationTicketSheet({ tickets, selectedId, getLabel, getValidityLabel, isDisabled = () => false, onSelect, onClose }) {
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
  const confirm = createElement("button", {
    className: "button button--primary school-app-ticket-sheet-confirm", type: "button", textContent: "변경",
    dataset: { action: "confirmTicketSelection" },
  });
  const controls = new Map();
  const updateSelection = () => {
    const selected = tickets.find((ticket) => ticket.id === pendingId);
    confirm.disabled = !selected || pendingId === selectedId || isDisabled(selected);
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
    radio.addEventListener("change", () => { pendingId = ticket.id; updateSelection(); });
    const text = createElement("span", { className: "school-app-ticket-sheet-text" });
    const details = createElement("span", { className: "school-app-ticket-sheet-details" });
    details.append(
      createElement("span", { textContent: `예약 가능 : ${ticket.remainingCount ?? 0}회` }),
      createElement("span", { className: "school-app-ticket-sheet-validity", textContent: `기간 : ${getValidityLabel(ticket)}` }),
    );
    text.append(createElement("strong", { textContent: getLabel(ticket) }), details);
    option.append(radio, text);
    controls.set(ticket.id, { option, radio, ticket });
    list.append(option);
  });
  confirm.addEventListener("click", () => {
    const selected = tickets.find((ticket) => ticket.id === pendingId);
    if (!selected || pendingId === selectedId || isDisabled(selected)) { updateSelection(); return; }
    overlay.remove();
    onSelect(selected);
  });
  updateSelection();
  content.append(list, confirm);
  sheet.append(header, content);
  overlay.append(sheet);
  return overlay;
}
