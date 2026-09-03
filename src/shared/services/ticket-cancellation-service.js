import { cancelSchoolReservation } from "./school-reservation-cancellation-service.js";
import {
  clearSchoolHomeReservationTicketHistory,
  getSchoolHomeReservations,
  updateSchoolHomeReservationTicketHistory,
} from "../storage/school-home-storage.js";
import {
  getStoredMembers,
  isSchoolTicketAttendanceProcessed,
  removeTicketHistory,
  updateTicketHistoryCounters,
} from "../storage/member-storage.js";
import { getTicketExpiryDate, getTicketStatus } from "./ticket-status-service.js";

export function cancelTicketIssue({ memberId, petId, ticketHistoryId, cancelFutureReservations = false, today = new Date() } = {}) {
  const todayKey = getDateKey(today);
  const reservationsToCancel = cancelFutureReservations
    ? getSchoolHomeReservations().filter((reservation) => {
      return reservation.memberId === memberId
        && reservation.petId === petId
        && reservation.ticketHistoryId === ticketHistoryId
        && reservation.status !== "취소"
        && reservation.date >= todayKey;
  })
    : [];

  reservationsToCancel.forEach((reservation) => cancelSchoolReservation(reservation));
  const reassignmentResult = reassignDisconnectedReservations({ memberId, petId, ticketHistoryId, today });
  const ticketResult = removeTicketHistory({ memberId, petId, ticketHistoryId });
  return {
    members: ticketResult.members,
    reservations: getSchoolHomeReservations(),
    cancelledReservationIds: reservationsToCancel.map((reservation) => reservation.id),
    reassignedReservationIds: reassignmentResult.reassignedReservationIds,
    unassignedReservationIds: reassignmentResult.unassignedReservationIds,
  };
}

function reassignDisconnectedReservations({ memberId, petId, ticketHistoryId, today }) {
  const todayKey = getDateKey(today);
  const reservations = getSchoolHomeReservations();
  const member = getStoredMembers().find((item) => item.id === memberId);
  const pet = member?.pets?.find((item) => item.id === petId);
  const cancelledTicket = pet?.ticketHistories?.find((ticket) => ticket.id === ticketHistoryId);
  const ticketHistories = pet?.ticketHistories || [];
  const candidates = reservations
    .filter((reservation) => {
      return reservation.memberId === memberId
        && reservation.petId === petId
        && reservation.ticketHistoryId === ticketHistoryId
        && reservation.status !== "취소";
    })
    .sort(compareReservations);
  const availableTickets = ticketHistories
    .filter((ticket) => ticket.id !== ticketHistoryId)
    .filter((ticket) => isCompatibleTicket(ticket, cancelledTicket))
    .filter((ticket) => isAvailableTicket(ticket, reservations, { memberId, petId, ticketHistories }))
    .sort((left, right) => compareTicketsByExpiry(left, right, reservations, { memberId, petId, ticketHistories }));
  const remainingByTicketId = new Map(availableTickets.map((ticket) => [
    ticket.id,
    getTicketReservableCount(ticket),
  ]));
  const reassignedReservationIds = [];
  const unassignedReservationIds = [];

  candidates.forEach((reservation) => {
    const ticket = availableTickets.find((item) => (remainingByTicketId.get(item.id) || 0) > 0);
    if (!ticket) {
      clearSchoolHomeReservationTicketHistory(reservation.id);
      unassignedReservationIds.push(reservation.id);
      return;
    }

    updateSchoolHomeReservationTicketHistory(reservation.id, ticket);
    remainingByTicketId.set(ticket.id, (remainingByTicketId.get(ticket.id) || 0) - 1);
    updateTicketHistoryCounters({
      memberId,
      petId,
      ticketHistoryId: ticket.id,
      reservableDelta: -1,
      reservedDelta: isPastAttendance(reservation, todayKey) ? 1 : 0,
      remainingDelta: isPastAttendance(reservation, todayKey) ? -1 : 0,
    });
    reassignedReservationIds.push(reservation.id);
  });

  return { reassignedReservationIds, unassignedReservationIds };
}

function isCompatibleTicket(ticket, cancelledTicket) {
  if (!cancelledTicket?.type) return true;
  return ticket?.type === cancelledTicket.type;
}

function isAvailableTicket(ticket, reservations, context) {
  const status = getTicketStatus(ticket, reservations, context);
  return getTicketReservableCount(ticket) > 0 && (status === "사용 전" || status === "이용 중");
}

function compareTicketsByExpiry(left, right, reservations, context) {
  const leftExpiry = getTicketExpiryDate(left, reservations, context)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightExpiry = getTicketExpiryDate(right, reservations, context)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
  return String(left.issuedAt || left.id).localeCompare(String(right.issuedAt || right.id));
}

function compareReservations(left, right) {
  const dateOrder = String(left.date || "").localeCompare(String(right.date || ""));
  if (dateOrder !== 0) return dateOrder;
  return String(left.createdAt || left.reservedAt || left.id).localeCompare(String(right.createdAt || right.reservedAt || right.id));
}

function getTicketReservableCount(ticket) {
  return Math.max(Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0, 0);
}

function isPastAttendance(reservation, todayKey) {
  return isSchoolTicketAttendanceProcessed(reservation.id)
    || Boolean(reservation.attendedAt)
    || reservation.status === "이용 완료"
    || Boolean(reservation.date && reservation.date < todayKey);
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
