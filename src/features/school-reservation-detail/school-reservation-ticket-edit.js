import { prepareModalOverlay } from "../../shared/components/modal.js";
import { createConfirmAlert } from "../../shared/components/alert.js";
import { getTicketChangePreview, getTicketReservableCount } from "../school-reservation-edit/school-reservation-edit-service.js";
import { getReservationTicketChangeSnapshot, getReservationTicketOptions, saveReservationTicketChange } from "./school-reservation-detail-service.js";
import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { createElement } from "../../shared/utils/dom.js";

export function openReservationTicketEdit(page, reservation, trigger, onSave) {
  const overlay = document.querySelector('[data-template="reservationTicketEdit"]').content.firstElementChild.cloneNode(true);
  const form = overlay.querySelector("form");
  const saveButton = overlay.querySelector('[data-action="saveReservationTicket"]');
  let options = getReservationTicketOptions(reservation);
  let expectedSnapshot = getReservationTicketChangeSnapshot(reservation.id);
  let selectedId = "";
  const rows = new Map();
  const close = () => overlay.remove();
  prepareModalOverlay(overlay, { onEscape: close, returnFocusTo: trigger });
  const updatePreview = () => {
    const changes = getTicketChangePreview(reservation, options.tickets, reservation.ticketHistoryId, selectedId);
    rows.forEach(({ row, ticket }) => {
      row.dataset.state = ticket.id === selectedId ? "selected" : "idle";
      row.classList.toggle("is-selected", ticket.id === selectedId);
      row.setAttribute("aria-pressed", String(ticket.id === selectedId));
    });
    const selectedTicket = options.availableTickets.find((ticket) => ticket.id === selectedId);
    overlay.querySelector('[data-area="ticketChangePreview"]').hidden = !selectedTicket;
    saveButton.disabled = !selectedTicket;
    if (!selectedTicket) return;
    for (const [area, ticket] of [["currentTicket", options.currentTicket], ["selectedTicket", selectedTicket]]) {
      const item = overlay.querySelector(`[data-area="${area}"]`);
      item.querySelector('[data-field="ticketName"]').textContent = ticket?.ticketName || (reservation.isOverbooked ? "선택 안함" : reservation.ticketName || "-");
      const validity = ticket?.unlimitedValidity ? "무제한" : ticket?.validity && ticket?.unit ? `${ticket.validity}${ticket.unit}` : ticket?.validDays ? `${ticket.validDays}일` : "-";
      item.querySelector('[data-field="ticketSummary"]').textContent = ticket
        ? `(${ticket.totalCount ?? ticket.quantity ?? 0}회 / ${validity} / ${Number(ticket.amount ?? ticket.price ?? 0).toLocaleString("ko-KR")}원)` : "";
      const change = changes.find((entry) => entry.ticketHistoryId === ticket?.id);
      renderTicketCount(item.querySelector('[data-field="ticketCount"]'), ticket ? change?.before ?? getTicketReservableCount(ticket) : null, change?.after);
    }
  };
  const renderOptions = () => {
    const list = overlay.querySelector('[data-area="availableTickets"]');
    list.replaceChildren();
    rows.clear();
    options.availableTickets.forEach((ticket) => {
      const row = document.querySelector('[data-template="reservationTicketRow"]').content.firstElementChild.cloneNode(true);
      row.dataset.entityId = ticket.id;
      row.dataset.action = "selectReservationTicket";
      row.setAttribute("aria-label", `${ticket.ticketName} 선택`);
      row.querySelector('[data-field="ticketName"]').textContent = ticket.ticketName;
      row.querySelector('[data-field="ticketRemaining"]').textContent = `잔여 : ${ticket.remainingCount ?? 0}회`;
      const expiry = options.getExpiryText(ticket);
      const validity = ticket.validity && ticket.unit ? `${ticket.validity}${ticket.unit}` : ticket.validDays ? `${ticket.validDays}일` : "-";
      row.querySelector('[data-field="ticketExpiry"]').textContent = `유효기간 : ${expiry === "-" ? validity : expiry}`;
      row.addEventListener("click", () => { selectedId = ticket.id; updatePreview(); });
      rows.set(ticket.id, { row, ticket });
      list.append(row);
    });
    overlay.querySelector('[data-field="ticketEmpty"]').hidden = options.availableTickets.length > 0;
    updatePreview();
  };
  const showFailure = () => {
    const alert = createConfirmAlert({
      title: "예약 실패",
      message: "예약 또는 이용권에 변동이 있습니다.\n다시 시도해 주세요.",
      area: "reservationTicketConflictAlert",
      modal: "reservationTicketConflictAlert",
      onConfirm: () => {
        alert.remove();
        const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
        if (!current || current.status === "취소") { close(); window.location.replace("./index.html"); return; }
        reservation = current;
        options = getReservationTicketOptions(reservation);
        expectedSnapshot = getReservationTicketChangeSnapshot(reservation.id);
        if (!options.availableTickets.some((ticket) => ticket.id === selectedId)) selectedId = "";
        renderOptions();
      },
    });
    document.body.append(alert);
  };
  renderOptions();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    const result = saveReservationTicketChange(reservation.id, selectedId, { expectedSnapshot });
    if (result.conflict || result.message || !result.reservation) { showFailure(); return; }
    close();
    onSave();
  });
  overlay.querySelector('[data-action="cancelTicketEdit"]').addEventListener("click", close);
  page.append(overlay);
  (overlay.querySelector('[data-field="ticketSelection"]') || overlay.querySelector('[data-action="cancelTicketEdit"]')).focus();
}

function renderTicketCount(container, before, after) {
  container.replaceChildren();
  container.dataset.state = after === undefined ? "idle" : "changed";
  const count = (value, field) => createElement("span", {
    className: "reservation-ticket-count__value",
    textContent: value === null ? "-" : `${value}회`,
    dataset: { field },
  });
  container.append(count(before, "ticketCountBefore"));
  if (after !== undefined) {
    container.append(" → ", count(after, "ticketCountAfter"));
  }
}
