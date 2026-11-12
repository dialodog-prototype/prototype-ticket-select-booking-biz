import { createConfirmAlert } from "../../shared/components/alert.js";
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
import { getReservedDatesForEdit, saveReservationEdit } from "../school-reservation-edit/school-reservation-edit-service.js";
import { createReservationDatePicker } from "../school-reservation-edit/school-reservation-edit-datepicker.js";
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
    field("reservationDate").value = formatReservationDate(current.date);
    field("ticketRound").textContent = getTicketUsageRound(current, ticket, getSchoolHomeReservations());
  };
  updateDate();
  const memo = field("reservationMemo");
  memo.value = reservation.memo || "";
  memo.disabled = reservation.status === "취소";
  let memoBeforeFocus = memo.value;
  memo.addEventListener("focus", () => { memoBeforeFocus = memo.value; });
  memo.addEventListener("input", () => saveReservationMemo(reservation.id, memo.value));
  memo.addEventListener("blur", () => {
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (memo.value !== memoBeforeFocus && current?.memo === memo.value) showSavedToast(page, "수정되었습니다");
    memoBeforeFocus = memo.value;
  });
  const cancelButton = page.querySelector('[data-action="cancelReservation"]');
  cancelButton.disabled = reservation.status === "취소";
  cancelButton.addEventListener("click", () => {
    document.body.append(createSchoolReservationCancelAlert({
      onConfirm: () => {
        const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
        const result = cancelSchoolReservation(current);
        if (result.reservation) window.location.href = "./index.html?toast=reservationCancelled";
      },
    }));
  });
  const editButton = page.querySelector('[data-action="editReservationDate"]');
  editButton.disabled = reservation.status === "취소";
  editButton.addEventListener("click", () => {
    if (editButton.getAttribute("aria-expanded") === "true") return;
    const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
    if (!current) { window.location.replace("./index.html"); return; }
    openDateEdit(page, current, editButton, () => {
      updateDate();
      showSavedToast(page);
    });
  });
  editButton.addEventListener("keydown", (event) => {
    if (!["Enter", " ", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    editButton.click();
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
  const showFailure = () => {
    const alert = createConfirmAlert({
      title: "예약 실패",
      message: "예약 또는 이용권에 변동이 있습니다.\n다시 시도해 주세요.",
      area: "reservationDateConflictAlert",
      modal: "reservationDateConflictAlert",
      onConfirm: () => alert.remove(),
    });
    document.body.append(alert);
  };
  const picker = createReservationDatePicker({
    selectedDate: reservation.date,
    presentation: "popover",
    trigger,
    getDisabledDates: () => getReservedDatesForEdit(reservation, getSchoolHomeReservations()),
    onUnavailable: showFailure,
    onSelect: (date) => {
      const current = getSchoolHomeReservations().find((item) => item.id === reservation.id);
      if (!current) { window.location.replace("./index.html"); return; }
      if (date === current.date) return;
      const result = saveReservationEdit(current.id, { date, ticketHistoryId: current.ticketHistoryId });
      if (result.message) { showFailure(); return false; }
      if (!result.reservation) { window.location.replace("./index.html"); return; }
      onSave();
    },
    onClose: () => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    },
  });
  trigger.setAttribute("aria-expanded", "true");
  page.querySelector('[data-area="reservationDateControl"]').append(picker);
  picker.querySelector('[data-action="previousMonth"]').focus();
}
