import { prepareModalOverlay } from "../../shared/components/modal.js";
import { getTicketChangePreview, getTicketReservableCount } from "../school-reservation-edit/school-reservation-edit-service.js";
import { getReservationTicketOptions, saveReservationTicketChange } from "./school-reservation-detail-service.js";
import { createElement } from "../../shared/utils/dom.js";

export function openReservationTicketEdit(page, reservation, trigger, onSave) {
  const overlay = document.querySelector('[data-template="reservationTicketEdit"]').content.firstElementChild.cloneNode(true);
  const form = overlay.querySelector("form");
  const saveButton = overlay.querySelector('[data-action="saveReservationTicket"]');
  const error = overlay.querySelector('[data-field="ticketError"]');
  const options = getReservationTicketOptions(reservation);
  let selectedId = reservation.ticketHistoryId || "";
  const rows = new Map();
  const close = () => overlay.remove();
  prepareModalOverlay(overlay, { onEscape: close, returnFocusTo: trigger });
  const updatePreview = () => {
    const changes = getTicketChangePreview(reservation, options.tickets, reservation.ticketHistoryId, selectedId);
    rows.forEach(({ row, ticket }) => {
      const change = changes.find((item) => item.ticketHistoryId === ticket.id);
      const cell = row.querySelector('[data-field="ticketCount"]');
      renderTicketCount(cell, change?.before ?? getTicketReservableCount(ticket), change?.after);
      row.dataset.state = ticket.id === selectedId ? "selected" : "idle";
    });
    saveButton.disabled = !options.availableTickets.some((ticket) => ticket.id === selectedId);
    error.textContent = "";
  };
  const appendTicket = (ticket, selectable) => {
    const row = selectable
      ? document.querySelector('[data-template="reservationTicketRow"]').content.firstElementChild.cloneNode(true)
      : overlay.querySelector('[data-area="currentTicket"]');
    row.dataset.entityId = ticket?.id || "";
    const field = (name) => row.querySelector(`[data-field="${name}"]`);
    field("ticketName").textContent = ticket?.ticketName || (reservation.isOverbooked ? "선택 안함" : reservation.ticketName || "-");
    field("ticketTotal").textContent = ticket ? `${ticket.totalCount ?? ticket.quantity ?? 0}회` : "-";
    renderTicketCount(field("ticketCount"), ticket ? getTicketReservableCount(ticket) : null);
    field("ticketExpiry").textContent = options.getExpiryText(ticket);
    const radio = field("ticketSelection");
    if (selectable) {
      radio.value = ticket.id;
      radio.setAttribute("aria-label", `${ticket.ticketName} 선택`);
      radio.addEventListener("change", () => { selectedId = ticket.id; updatePreview(); });
    }
    if (ticket) rows.set(ticket.id, { row, ticket });
    if (selectable) overlay.querySelector('[data-area="availableTickets"]').append(row);
  };
  appendTicket(options.currentTicket, false);
  options.availableTickets.forEach((ticket) => appendTicket(ticket, true));
  overlay.querySelector('[data-field="ticketEmpty"]').hidden = options.availableTickets.length > 0;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    const result = saveReservationTicketChange(reservation.id, selectedId);
    if (result.message) { error.textContent = result.message; return; }
    if (!result.reservation) { window.location.replace("./index.html"); return; }
    close();
    onSave();
  });
  overlay.querySelector('[data-action="cancelTicketEdit"]').addEventListener("click", close);
  page.append(overlay);
  (overlay.querySelector('input[type="radio"]') || overlay.querySelector('[data-action="cancelTicketEdit"]')).focus();
}

function renderTicketCount(container, before, after) {
  container.replaceChildren();
  container.dataset.state = after === undefined ? "idle" : "changed";
  const count = (value, field) => createElement("span", {
    className: "reservation-ticket-count__value",
    textContent: value === null ? "-" : `${value}회`,
    dataset: { field, state: value !== null && value <= 2 ? "warning" : "normal" },
  });
  container.append(count(before, "ticketCountBefore"));
  if (after !== undefined) {
    container.append(" → ", count(after, "ticketCountAfter"));
  }
}
