import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers } from "../../shared/storage/member-storage.js";
import { createReservationInfo, formatReservationDate } from "../../shared/components/school-reservation-info.js";
import { createSchoolReservationTicketSheet } from "../../shared/components/school-reservation-ticket-sheet.js";
import { createSchoolReservationCancelAlert } from "../../shared/components/school-reservation-cancel-alert.js";
import { createAlertDialog, createConfirmAlert } from "../../shared/components/alert.js";
import { cancelSchoolReservation } from "../../shared/services/school-reservation-cancellation-service.js";
import { getTicketUsageRound } from "../../shared/services/school-reservation-ticket-service.js";
import { createElement } from "../../shared/utils/dom.js";
import { getReservedDatesForEdit, getTicketChangePreview, getTicketReservableCount, saveReservationEdit } from "./school-reservation-edit-service.js";
import { createReservationDatePicker } from "./school-reservation-edit-datepicker.js";

export function renderSchoolReservationEdit(page, reservationId) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation || reservation.status === "취소") { window.location.replace("./index.html"); return; }
  const member = getStoredMembers().find((item) => item.id === reservation.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation.petId);
  const draft = { ...reservation };
  const detailUrl = `./school-reservation-detail.html?reservationId=${encodeURIComponent(reservation.id)}`;
  page.querySelector('[data-action="closeReservationEdit"]').addEventListener("click", () => { window.location.href = detailUrl; });
  page.querySelector('[data-action="cancelReservation"]').addEventListener("click", () => {
    document.body.append(createSchoolReservationCancelAlert({
      onConfirm: () => {
        const result = cancelSchoolReservation(reservation, { remove: true });
        if (result.reservation) window.location.href = "./index.html?toast=reservationCancelled";
      },
    }));
  });
  page.querySelector('[data-area="reservationInfo"]').append(createReservationInfo(reservation, member, pet));
  const dateLabel = page.querySelector('[data-field="reservationDateLabel"]');
  dateLabel.textContent = formatReservationDate(draft.date);
  const dateButton = page.querySelector('[data-action="editReservationDate"]');
  dateButton.addEventListener("click", () => {
    const picker = createReservationDatePicker({
      selectedDate: draft.date,
      getDisabledDates: () => getReservedDatesForEdit(reservation, getSchoolHomeReservations()),
      onSelect: (date) => {
        draft.date = date;
        dateLabel.textContent = formatReservationDate(date);
        updateTicket();
      },
      onClose: () => dateButton.focus(),
    });
    page.append(picker);
    picker.querySelector('[data-action="previousMonth"]').focus();
  });
  page.querySelector('[data-action="saveReservationEdit"]').addEventListener("click", () => {
    const result = saveReservationEdit(reservation.id, draft);
    if (result.message) {
      const alert = createConfirmAlert({ message: result.message, onConfirm: () => alert.remove() });
      document.body.append(alert);
      return;
    }
    if (!result.reservation) { window.location.replace("./index.html"); return; }
    window.location.href = detailUrl;
  });
  const ticketLabel = page.querySelector('[data-field="reservationTicketName"]');
  const ticketRound = page.querySelector('[data-field="reservationTicketRound"]');
  const updateTicket = () => {
    ticketLabel.textContent = draft.isOverbooked ? "선택 안함" : draft.ticketName || "-";
    const ticket = pet?.ticketHistories?.find((item) => item.id === draft.ticketHistoryId);
    ticketRound.textContent = getTicketUsageRound(draft, ticket, getSchoolHomeReservations());
  };
  updateTicket();
  const openTicketSheet = (event) => {
    const trigger = event.currentTarget;
    const tickets = pet?.ticketHistories || [];
    const sheet = createSchoolReservationTicketSheet({
      tickets: tickets.filter((ticket) => ticket.id === reservation.ticketHistoryId || getTicketReservableCount(ticket) > 0),
      selectedId: draft.ticketHistoryId,
      getLabel: (ticket) => `${ticket.ticketName || "이용권"} · ${getTicketReservableCount(ticket)}회 예약 가능`,
      onClose: () => trigger.focus(),
      onSelect: (ticket) => {
        if (ticket.id === draft.ticketHistoryId) { trigger.focus(); return; }
        const changes = getTicketChangePreview(reservation, tickets, draft.ticketHistoryId, ticket.id);
        const change = changes.find((item) => item.ticketHistoryId === ticket.id);
        const content = createElement("div", { className: "ticket-change-summary" });
        const count = createElement("p", { className: "ticket-change-summary__count" });
        count.append(
          `예약 가능 횟수 ${change.before}회 → `,
          createElement("strong", {
            className: "ticket-change-summary__after",
            textContent: `${change.after}회`,
            dataset: { state: change.after <= 2 ? "warning" : "normal" },
          }),
        );
        content.append(
          createElement("p", { className: "alert-dialog-message", textContent: ticket.ticketName }),
          count,
        );
        const alert = createAlertDialog({
          title: "이용권 변경",
          contentNode: content,
          actions: [
            { label: "취소", variant: "secondary", action: "cancelTicketChange", onClick: () => { alert.remove(); trigger.focus(); } },
            { label: "변경", action: "confirmTicketChange", onClick: () => {
              Object.assign(draft, { ticketHistoryId: ticket.id, ticketId: ticket.ticketId || ticket.id, ticketName: ticket.ticketName, isOverbooked: false });
              updateTicket();
              alert.remove();
              trigger.focus();
            } },
          ],
        });
        document.body.append(alert);
      },
    });
    page.append(sheet);
    sheet.querySelector('[data-action="closeTicketSheet"]').focus();
  };
  page.querySelector('[data-action="editReservationTicket"]').addEventListener("click", openTicketSheet);
  page.querySelector('[data-action="selectReservationTicket"]').addEventListener("click", openTicketSheet);
}
