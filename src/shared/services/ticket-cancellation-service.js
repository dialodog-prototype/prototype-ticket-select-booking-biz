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
import { getTicketStatus } from "./ticket-status-service.js";
import { compareTicketsByExpiry } from "./school-reservation-ticket-service.js";

export function cancelTicketIssue({ memberId, petId, ticketHistoryId, today = new Date(), excludedTicketHistoryIds = [] } = {}) {
  const reassignmentResult = reassignDisconnectedReservations({ memberId, petId, ticketHistoryId, today, excludedTicketHistoryIds });
  const ticketResult = removeTicketHistory({ memberId, petId, ticketHistoryId });
  return {
    members: ticketResult.members,
    reservations: getSchoolHomeReservations(),
    reassignedReservationIds: reassignmentResult.reassignedReservationIds,
    unassignedReservationIds: reassignmentResult.unassignedReservationIds,
  };
}

export function cancelTicketIssues({ memberId, petId, ticketHistoryIds = [], today = new Date() } = {}) {
  const ids = [...new Set(ticketHistoryIds)].filter(Boolean);
  let members = getStoredMembers();
  const reassignedReservationIds = [];
  const unassignedReservationIds = [];
  ids.forEach((ticketHistoryId) => {
    const result = cancelTicketIssue({
      memberId, petId, ticketHistoryId, today, excludedTicketHistoryIds: ids,
    });
    members = result.members;
    reassignedReservationIds.push(...result.reassignedReservationIds);
    unassignedReservationIds.push(...result.unassignedReservationIds);
  });
  return { members, reservations: getSchoolHomeReservations(), reassignedReservationIds, unassignedReservationIds };
}

function reassignDisconnectedReservations({ memberId, petId, ticketHistoryId, today, excludedTicketHistoryIds = [] }) {
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
    .filter((ticket) => !excludedTicketHistoryIds.includes(ticket.id))
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
  return getTicketReservableCount(ticket) > 0 && (status === "사용 전" || status === "사용 중");
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
