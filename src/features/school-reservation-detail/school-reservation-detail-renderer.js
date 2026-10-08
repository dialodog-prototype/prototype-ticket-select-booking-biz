import { getTicketUsageRound } from "../../shared/services/school-reservation-ticket-service.js";
import { createReservationInfo, formatReservationDate } from "../../shared/components/school-reservation-info.js";
import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers } from "../../shared/storage/member-storage.js";
import { createSchoolReservationCancelAlert } from "../../shared/components/school-reservation-cancel-alert.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { cancelSchoolReservation } from "../../shared/services/school-reservation-cancellation-service.js";
import { createElement } from "../../shared/utils/dom.js";

const CHEVRON_LEFT_ICON_PATH = "../assets/iconChevronLeft.svg";
let reservationDetailToastDismissTimer = null;

export function renderSchoolReservationDetail(rootElement, reservationId, toastMessage = "") {
  const reservations = getSchoolHomeReservations();
  const reservation = reservations.find((item) => item.id === reservationId) || reservations[0];
  rootElement.innerHTML = "";
  rootElement.append(createDetailPage(reservation, () => { window.location.href = `./school-reservation-edit.html?reservationId=${encodeURIComponent(reservation.id)}`; }, () => {
    if (isAppViewport()) {
      window.location.href = "./index.html?toast=reservationCancelled";
      return;
    }

    renderSchoolReservationDetail(rootElement, reservation.id, "예약이 취소되었습니다.");
  }, toastMessage));
  scheduleReservationDetailToastDismiss(rootElement, reservation, toastMessage);
}

function scheduleReservationDetailToastDismiss(rootElement, reservation, toastMessage) {
  window.clearTimeout(reservationDetailToastDismissTimer);
  if (!toastMessage) return;

  reservationDetailToastDismissTimer = window.setTimeout(() => {
    renderSchoolReservationDetail(rootElement, reservation.id);
  }, TOAST_AUTO_DISMISS_MS);
}

function isAppViewport() {
  return window.matchMedia
    ? window.matchMedia("(max-width: 430px)").matches
    : window.innerWidth <= 430;
}

function createDetailPage(reservation, onEdit, onCancel, toastMessage) {
  const member = getStoredMembers().find((item) => item.id === reservation?.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation?.petId);
  const page = createElement("main", { className: "school-reservation-detail-page", dataset: { screen: "schoolReservationDetail" } });
  const header = createElement("header", { className: "school-reservation-detail-header" });
  const backButton = createElement("button", { className: "school-reservation-detail-back", type: "button", ariaLabel: "유치원 예약 목록으로" });
  backButton.append(createElement("img", { src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => { window.location.href = "./index.html"; });
  header.append(backButton, createElement("h1", { className: "school-reservation-detail-title", textContent: "유치원 예약" }));
  const cancelButton = createElement("button", {
    className: `school-reservation-detail-cancel${isAppViewport() ? " school-reservation-detail-edit" : ""}`,
    type: "button",
    textContent: reservation?.status === "취소" ? "취소됨" : isAppViewport() ? "수정" : "예약 취소",
    dataset: { action: isAppViewport() ? "editReservation" : "cancelReservation" },
  });
  cancelButton.disabled = !reservation || reservation.status === "취소";
  cancelButton.addEventListener("click", () => {
    if (isAppViewport()) { onEdit(); return; }
    const alert = createSchoolReservationCancelAlert({
      onConfirm: () => {
        const result = cancelSchoolReservation(reservation);
        if (result.reservation) onCancel();
      },
    });
    document.body.append(alert);
  });
  header.append(cancelButton);
  page.append(header);

  const content = createElement("div", { className: "school-reservation-detail-content" });
  content.append(createReservationInfo(reservation, member, pet));
  content.append(createReservationDate(reservation?.date));
  content.append(createReservationTicket(reservation, pet));
  page.append(content);
  if (toastMessage) page.append(createToast(toastMessage));
  return page;
}

function createReservationDate(dateText) {
  const section = createElement("section", { className: "school-reservation-detail-section school-reservation-detail-date-section" });
  section.append(createElement("h2", { textContent: "예약 날짜" }));
  section.append(createElement("div", { className: "school-reservation-detail-date", textContent: formatReservationDate(dateText) }));
  return section;
}

function createReservationTicket(reservation, pet) {
  const section = createElement("section", { className: "school-reservation-detail-section school-reservation-detail-ticket-section" });
  const ticketHistory = pet?.ticketHistories?.find((ticket) => ticket.id === reservation?.ticketHistoryId);
  const ticketName = reservation?.isOverbooked
    ? "선택 안함"
    : reservation?.ticketName || ticketHistory?.ticketName || "-";
  section.append(createElement("h2", { textContent: "이용권" }));
  const ticketUsageRound = getTicketUsageRound(reservation, ticketHistory, getSchoolHomeReservations());
  const ticket = createElement("div", { className: "school-reservation-detail-ticket", dataset: { area: "reservationTicketDisplay" } });
  ticket.append(createElement("div", { className: "school-reservation-detail-ticket-name", textContent: ticketName }));
  ticket.append(createElement("div", { className: "school-reservation-detail-ticket-round", textContent: ticketUsageRound }));
  section.append(ticket);
  return section;
}
