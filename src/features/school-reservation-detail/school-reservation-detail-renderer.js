import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers } from "../../shared/storage/member-storage.js";
import { createSchoolReservationCancelAlert } from "../../shared/components/school-reservation-cancel-alert.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { cancelSchoolReservation } from "../../shared/services/school-reservation-cancellation-service.js";
import { createElement } from "../../shared/utils/dom.js";
import { formatMemberWeight } from "../../shared/utils/member-date.js";

const DEFAULT_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";
const CHEVRON_LEFT_ICON_PATH = "../assets/iconChevronLeft.svg";
let reservationDetailToastDismissTimer = null;

export function renderSchoolReservationDetail(rootElement, reservationId, toastMessage = "") {
  const reservations = getSchoolHomeReservations();
  const reservation = reservations.find((item) => item.id === reservationId) || reservations[0];
  rootElement.innerHTML = "";
  rootElement.append(createDetailPage(reservation, () => {
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

function createDetailPage(reservation, onCancel, toastMessage) {
  const member = getStoredMembers().find((item) => item.id === reservation?.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation?.petId);
  const page = createElement("main", { className: "school-reservation-detail-page", dataset: { screen: "schoolReservationDetail" } });
  const header = createElement("header", { className: "school-reservation-detail-header" });
  const backButton = createElement("button", { className: "school-reservation-detail-back", type: "button", ariaLabel: "유치원 예약 목록으로" });
  backButton.append(createElement("img", { src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => { window.location.href = "./index.html"; });
  header.append(backButton, createElement("h1", { textContent: "유치원 예약" }));
  const cancelButton = createElement("button", {
    className: "school-reservation-detail-cancel",
    type: "button",
    textContent: reservation?.status === "취소" ? "취소됨" : "예약 취소",
  });
  cancelButton.disabled = !reservation || reservation.status === "취소";
  cancelButton.addEventListener("click", () => {
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

function createReservationInfo(reservation, member, pet) {
  const section = createElement("section", { className: "school-reservation-detail-section" });
  section.append(createElement("h2", { textContent: "예약 정보" }));
  const info = createElement("div", { className: "school-reservation-detail-pet" });
  info.append(createElement("img", { className: "school-reservation-detail-pet-image", src: pet?.profileImage || DEFAULT_PROFILE_IMAGE, alt: "" }));
  const text = createElement("div", { className: "school-reservation-detail-pet-text" });
  const petName = pet?.petName || pet?.dogName || reservation?.petName || "-";
  const breed = pet?.breed || reservation?.breed || "-";
  const weight = formatMemberWeight(pet?.weight || reservation?.weight);
  text.append(createElement("strong", { textContent: petName }));
  text.append(createElement("p", { textContent: `${breed} / ${weight === "-" ? "-" : weight}` }));
  text.append(createElement("p", { className: "school-reservation-detail-guardian", textContent: `${member?.guardianName || reservation?.guardianName || "-"} 보호자 (${member?.phoneNumber || reservation?.phoneNumber || "-"})` }));
  info.append(text);
  section.append(info);
  return section;
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
  const ticketUsageRound = getTicketUsageRound(reservation, ticketHistory);
  const ticket = createElement("div", { className: "school-reservation-detail-ticket" });
  ticket.append(createElement("div", { className: "school-reservation-detail-ticket-name", textContent: ticketName }));
  ticket.append(createElement("div", { className: "school-reservation-detail-ticket-round", textContent: ticketUsageRound }));
  section.append(ticket);
  return section;
}

function getTicketUsageRound(reservation, ticketHistory) {
  const totalCount = Math.max(Number(ticketHistory?.totalCount ?? ticketHistory?.quantity) || 0, 0);
  if (!reservation?.ticketHistoryId || reservation?.isOverbooked || totalCount <= 0) return "-";

  const ticketReservations = getSchoolHomeReservations()
    .filter((item) => item.ticketHistoryId === reservation.ticketHistoryId && item.status !== "취소")
    .sort((left, right) => {
      const dateOrder = String(left.date || "").localeCompare(String(right.date || ""));
      if (dateOrder) return dateOrder;
      return String(left.createdAt || left.reservedAt || left.id || "").localeCompare(String(right.createdAt || right.reservedAt || right.id || ""));
    });
  const usageRound = ticketReservations.findIndex((item) => item.id === reservation.id) + 1;
  return usageRound > 0 ? `${usageRound}/${totalCount}회차` : "-";
}

function formatReservationDate(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}
