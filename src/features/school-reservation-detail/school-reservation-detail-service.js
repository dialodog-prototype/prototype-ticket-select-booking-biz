import { getSchoolHomeReservations, saveSchoolHomeReservation } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers } from "../../shared/storage/member-storage.js";
import { getDateKey, getTicketExpiryDate } from "../../shared/services/ticket-status-service.js";
import { isReservationTicketAvailable } from "../../shared/services/school-reservation-ticket-service.js";
import { saveReservationEdit } from "../school-reservation-edit/school-reservation-edit-service.js";

export const NO_RESERVATION_TICKET_CHANGE_MESSAGE = "변경할 수 있는 이용권이 없습니다.\n이용권을 먼저 지급하세요.";

export function saveReservationMemo(reservationId, memo) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation || reservation.status === "취소") return null;
  return saveSchoolHomeReservation({ ...reservation, memo });
}

export function getReservationTicketOptions(reservation) {
  const reservations = getSchoolHomeReservations();
  const member = getStoredMembers().find((item) => item.id === reservation.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation.petId);
  const tickets = pet?.ticketHistories || [];
  const context = { memberId: reservation.memberId, petId: reservation.petId, ticketHistories: tickets };
  const availableTickets = tickets.filter((ticket) => ticket.id !== reservation.ticketHistoryId
    && isReservationTicketAvailable(ticket, reservations, context));
  return {
    currentTicket: tickets.find((ticket) => ticket.id === reservation.ticketHistoryId),
    availableTickets,
    tickets,
    getExpiryText: (ticket) => ticket?.unlimitedValidity ? "무제한" : ticket ? getDateKey(getTicketExpiryDate(ticket, reservations, context)) || "-" : "-",
  };
}

export function saveReservationTicketChange(reservationId, ticketHistoryId) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation || reservation.status === "취소") return { reservation: null };
  if (!getReservationTicketOptions(reservation).availableTickets.some((ticket) => ticket.id === ticketHistoryId)) {
    return { message: "사용 가능한 이용권이 없습니다." };
  }
  return saveReservationEdit(reservationId, { date: reservation.date, ticketHistoryId });
}
