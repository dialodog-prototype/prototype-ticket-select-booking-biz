import { compareTicketsByExpiry, getTicketReservableCount } from "./school-reservation-ticket-service.js";
import { getDateKey, getTicketStatus } from "./ticket-status-service.js";

export function reconcileOverbookedReservations(members, reservations, processedIds = [], today = new Date()) {
  const nextMembers = members.map((member) => ({
    ...member,
    pets: (member.pets || []).map((pet) => ({
      ...pet,
      ticketHistories: (pet.ticketHistories || []).map((ticket) => ({ ...ticket })),
    })),
  }));
  const nextReservations = reservations.map((reservation) => ({ ...reservation }));
  const attendanceIds = new Set(processedIds);
  const todayKey = getDateKey(today);
  const reassignedReservations = [];
  const candidates = nextReservations
    .filter((reservation) => reservation.isOverbooked === true && String(reservation.status || "예약").trim() !== "취소")
    .sort((left, right) => String(left.date || "").localeCompare(String(right.date || ""))
      || String(left.createdAt || left.reservedAt || left.id).localeCompare(String(right.createdAt || right.reservedAt || right.id)));

  candidates.forEach((reservation) => {
    const member = nextMembers.find((item) => item.id === reservation.memberId);
    const pet = member?.pets?.find((item) => item.id === reservation.petId);
    const ticketHistories = pet?.ticketHistories || [];
    const context = { memberId: reservation.memberId, petId: reservation.petId, ticketHistories };
    const ticket = ticketHistories
      .filter((item) => item.type === "school" && getTicketReservableCount(item) > 0)
      .filter((item) => ["사용 전", "사용 중"].includes(getTicketStatus(item, nextReservations, context)))
      .sort((left, right) => compareTicketsByExpiry(left, right, nextReservations, context))[0];
    if (!ticket) return;

    ticket.reservableCount = getTicketReservableCount(ticket) - 1;
    const isPastAttendance = attendanceIds.has(reservation.id) || Boolean(reservation.attendedAt)
      || reservation.status === "이용 완료" || Boolean(reservation.date && reservation.date < todayKey);
    if (isPastAttendance) {
      ticket.remainingCount = Math.max((Number(ticket.remainingCount) || 0) - 1, 0);
      ticket.reservedCount = (Number(ticket.reservedCount) || 0) + 1;
      attendanceIds.add(reservation.id);
    }
    if (ticket.reservableCount <= 0) ticket.depletedAt ||= today.toISOString();
    Object.assign(reservation, {
      isOverbooked: false,
      ticketHistoryId: ticket.id,
      ticketId: ticket.ticketId || ticket.id,
      ticketName: ticket.ticketName || "",
    });
    reassignedReservations.push(reservation);
  });

  return { members: nextMembers, reservations: nextReservations, processedIds: [...attendanceIds], reassignedReservations };
}
