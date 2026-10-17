import { prepareModalOverlay } from "../../shared/components/modal.js";
import { createWebHeader, createSchoolNavigation } from "../school-home/school-home-renderer.js";
import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers } from "../../shared/storage/member-storage.js";
import { formatMemberWeight } from "../../shared/utils/member-date.js";
import { formatReservationDate } from "../../shared/components/school-reservation-info.js";
import { getTicketUsageRound } from "../../shared/services/school-reservation-ticket-service.js";
import { getTicketUsageItem } from "../../shared/services/ticket-status-service.js";
import { createSchoolReservationCancelAlert } from "../../shared/components/school-reservation-cancel-alert.js";
import { cancelSchoolReservation } from "../../shared/services/school-reservation-cancellation-service.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { saveReservationEdit } from "../school-reservation-edit/school-reservation-edit-service.js";
import { getReservationTicketOptions, NO_RESERVATION_TICKET_CHANGE_MESSAGE, saveReservationMemo } from "./school-reservation-detail-service.js";
import { openReservationTicketEdit } from "./school-reservation-ticket-edit.js";

export function createWebReservationDetail(reservation) {
  const page = document.querySelector('[data-template="webReservationDetail"]').content.firstElementChild.cloneNode(true);
  page.querySelector('[data-area="webHeader"]').replaceWith(createWebHeader());
  page.querySelector('[data-area="webNavigation"]').append(createSchoolNavigation("web"));
  const member = getStoredMembers().find((item) => item.id === reservation.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation.petId);
  const field = (name) => page.querySelector(`[data-field="${name}"]`);
  field("pet").textContent = `${pet?.petName || pet?.dogName || reservation.petName || "-"} (${pet?.breed || reservation.breed || "-"} / ${formatMemberWeight(pet?.weight || reservation.weight)})`;
  field("guardian").textContent = member?.guardianName || reservation.guardianName || "-";
  field("phone").textContent = member?.phoneNumber || reservation.phoneNumber || "-";
  const updateDate = () => {
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (!current) return;
    const currentPet = getStoredMembers().find((item) => item.id === current.memberId)?.pets?.find((item) => item.id === current.petId);
    const ticket = currentPet?.ticketHistories?.find((item) => item.id === current.ticketHistoryId);
    const status = getTicketUsageItem(current).status;
    field("status").textContent = status;
    field("status").dataset.state = status === "이용 완료" ? "completed" : "idle";
    field("ticketName").textContent = current.isOverbooked ? "선택 안함" : current.ticketName || ticket?.ticketName || "-";
    field("reservationDate").textContent = formatReservationDate(current.date);
    field("ticketRound").textContent = getTicketUsageRound(current, ticket, getSchoolHomeReservations());
  };
  updateDate();
  const memo = field("reservationMemo");
  memo.value = reservation.memo || "";
  memo.disabled = reservation.status === "취소";
  memo.addEventListener("input", () => saveReservationMemo(reservation.id, memo.value));
  const cancelButton = page.querySelector('[data-action="cancelReservation"]');
  cancelButton.disabled = reservation.status === "취소";
  cancelButton.addEventListener("click", () => {
    document.body.append(createSchoolReservationCancelAlert({
      onConfirm: () => {
        const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
        const result = cancelSchoolReservation(current, { remove: true });
        if (result.reservation) window.location.href = "./index.html?toast=reservationCancelled";
      },
    }));
  });
  const editButton = page.querySelector('[data-action="editReservationDate"]');
  editButton.disabled = reservation.status === "취소";
  editButton.addEventListener("click", () => {
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (!current) { window.location.replace("./index.html"); return; }
    openDateEdit(page, current, editButton, () => {
      updateDate();
      showSavedToast(page);
    });
  });
  const ticketEditButton = page.querySelector('[data-action="editReservationTicket"]');
  ticketEditButton.disabled = reservation.status === "취소";
  ticketEditButton.addEventListener("click", () => {
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (!current) { window.location.replace("./index.html"); return; }
    if (!getReservationTicketOptions(current).availableTickets.length) {
      showSavedToast(page, NO_RESERVATION_TICKET_CHANGE_MESSAGE);
      return;
    }
    openReservationTicketEdit(page, current, ticketEditButton, () => {
      updateDate();
      showSavedToast(page, "이용권을 변경했습니다");
    });
  });
  return page;
}

function showSavedToast(page, message = "수정되었습니다.") {
  page.querySelector('[data-role="toast"]')?.remove();
  const toast = createToast(message);
  page.append(toast);
  window.setTimeout(() => toast.remove(), TOAST_AUTO_DISMISS_MS);
}

function openDateEdit(page, reservation, trigger, onSave) {
  const overlay = document.querySelector('[data-template="reservationDateEdit"]').content.firstElementChild.cloneNode(true);
  const form = overlay.querySelector("form");
  const date = overlay.querySelector('[data-field="reservationDate"]');
  const saveButton = overlay.querySelector('[data-action="saveReservationDate"]');
  const error = overlay.querySelector('[data-field="dateError"]');
  date.value = reservation.date;
  const close = () => overlay.remove();
  prepareModalOverlay(overlay, { onEscape: close, returnFocusTo: trigger });
  date.addEventListener("input", () => {
    saveButton.disabled = !date.validity.valid || date.value === reservation.date;
    error.textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saveButton.disabled || !form.reportValidity()) return;
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (!current) { window.location.replace("./index.html"); return; }
    const result = saveReservationEdit(current.id, { date: date.value, ticketHistoryId: current.ticketHistoryId });
    if (result.message) { error.textContent = result.message; return; }
    if (!result.reservation) { window.location.replace("./index.html"); return; }
    close();
    onSave();
  });
  overlay.querySelector('[data-action="closeDateEdit"]').addEventListener("click", close);
  page.append(overlay);
  date.focus();
}
