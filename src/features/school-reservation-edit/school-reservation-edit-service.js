import { getSchoolHomeReservations, saveSchoolHomeReservation } from "../../shared/storage/school-home-storage.js";
import { getStoredMembers, updateTicketHistoryCounters } from "../../shared/storage/member-storage.js";

export function getTicketReservableCount(ticket) {
  return Math.max(Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0, 0);
}

export function getTicketChangePreview(reservation, tickets, currentTicketId, nextTicketId) {
  const projectedCount = (ticket, selectedId) => {
    const changes = selectedId !== reservation.ticketHistoryId;
    return getTicketReservableCount(ticket)
      + (changes && ticket.id === reservation.ticketHistoryId ? 1 : 0)
      - (changes && ticket.id === selectedId ? 1 : 0);
  };
  return tickets.map((ticket) => ({
    ticketHistoryId: ticket.id,
    ticketName: ticket.ticketName,
    before: projectedCount(ticket, currentTicketId),
    after: projectedCount(ticket, nextTicketId),
  })).filter((item) => item.before !== item.after);
}

export function saveReservationEdit(reservationId, { date, ticketHistoryId }) {
  const reservations = getSchoolHomeReservations();
  const reservation = reservations.find((item) => item.id === reservationId);
  if (!reservation || reservation.status === "취소") return { reservation: null };
  if (!date) return { message: "예약 날짜를 선택해 주세요." };
  const duplicate = reservations.some((item) => item.id !== reservationId
    && item.memberId === reservation.memberId && item.petId === reservation.petId
    && item.status !== "취소" && item.date === date);
  if (duplicate) return { message: "이미 예약된 날짜가 포함되어 있습니다." };
  const member = getStoredMembers().find((item) => item.id === reservation.memberId);
  const pet = member?.pets?.find((item) => item.id === reservation.petId);
  const ticket = pet?.ticketHistories?.find((item) => item.id === ticketHistoryId);
  const changed = ticketHistoryId !== reservation.ticketHistoryId;
  if (changed && (!ticket || getTicketReservableCount(ticket) < 1)) return { message: "사용 가능한 이용권이 없습니다." };
  if (changed) {
    const context = { memberId: reservation.memberId, petId: reservation.petId };
    if (reservation.ticketHistoryId) updateTicketHistoryCounters({ ...context, ticketHistoryId: reservation.ticketHistoryId, reservableDelta: 1 });
    updateTicketHistoryCounters({ ...context, ticketHistoryId: ticket.id, reservableDelta: -1 });
  }
  return { reservation: saveSchoolHomeReservation({
    ...reservation,
    date,
    ...(changed ? { ticketHistoryId: ticket.id, ticketId: ticket.ticketId || ticket.id, ticketName: ticket.ticketName, isOverbooked: false } : {}),
  }) };
}
