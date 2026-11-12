import { getDateKey, getLatestUsedTicketHistoryId, getTicketExpiryDate, getTicketStartDate, getValidDays } from "./ticket-status-service.js";

export function compareTicketsByExpiry(left, right, reservations, context) {
  const leftExpiry = getTicketExpiryDate(left, reservations, context)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightExpiry = getTicketExpiryDate(right, reservations, context)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
  return String(left.issuedAt || left.id).localeCompare(String(right.issuedAt || right.id));
}

export function getTicketReservableCount(ticket) {
  return Math.max(Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0, 0);
}

export function getTicketValidityLabel(ticket, reservations = [], context = {}, today = new Date()) {
  if (ticket?.unlimitedValidity) return "무제한";
  const expiry = getTicketExpiryDate(ticket, reservations, context);
  if (expiry && !Number.isNaN(expiry.getTime())) {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const days = Math.max(Math.ceil((expiryStart - todayStart) / (24 * 60 * 60 * 1000)), 0);
    return `${days}일 남음`;
  }
  if (ticket?.validity && ticket?.unit) return `${ticket.validity}${ticket.unit}`;
  if (ticket?.validDays) return `${ticket.validDays}일`;
  return "유효기간 미정";
}

export function isReservationTicketAvailable(ticket, reservations = [], context = {}) {
  if (!ticket || getTicketReservableCount(ticket) < 1) return false;
  const expiry = ticket.expiresAt || getTicketExpiryDate(ticket, reservations, context);
  const expiryKey = getDateKey(expiry);
  return !expiryKey || expiryKey >= getDateKey(new Date());
}

export function getAvailableReservationTickets(pet, reservations = [], memberId = "") {
  const ticketHistories = pet?.ticketHistories || [];
  const context = { memberId, petId: pet?.id || "", ticketHistories };
  return ticketHistories.filter((ticket) => isReservationTicketAvailable(ticket, reservations, context));
}

export function getDefaultReservationTicket(pet, reservations = [], memberId = "", petId = pet?.id || "") {
  const tickets = getAvailableReservationTickets(pet, reservations, memberId);
  const context = { memberId, petId, ticketHistories: pet?.ticketHistories || [] };
  const latestTicketHistoryId = getLatestUsedTicketHistoryId(reservations, context);
  const latestTicket = tickets.find((ticket) => ticket.id === latestTicketHistoryId);
  if (latestTicket) return latestTicket;

  return tickets.map((ticket) => ({
    ticket,
    priority: getReservationTicketPriority(ticket, reservations, context),
  })).sort((left, right) => {
    for (let index = 0; index < left.priority.length; index += 1) {
      const difference = left.priority[index] - right.priority[index];
      if (difference) return difference;
    }
    return 0;
  })[0]?.ticket || null;
}

function getReservationTicketPriority(ticket, reservations, context) {
  const issuedTime = Date.parse(ticket.issuedAt || ticket.createdAt || "");
  const issuedPriority = Number.isFinite(issuedTime) ? issuedTime : Number.MAX_SAFE_INTEGER;
  if (ticket.unlimitedValidity) return [3, 0, issuedPriority];

  const startDate = getTicketStartDate(ticket, reservations, context);
  const expiry = getTicketExpiryDate(ticket, reservations, context);
  if (startDate && expiry) return [0, expiry.getTime(), issuedPriority];

  const validDays = Number(ticket.validDays) || getValidDays(ticket);
  if (!startDate && validDays > 0) return [1, validDays, issuedPriority];
  return [2, 0, issuedPriority];
}

export function getTicketUsageRound(reservation, ticketHistory, reservations, { includeTotal = true } = {}) {
  const totalCount = Math.max(Number(ticketHistory?.usageTotalCount ?? ticketHistory?.totalCount ?? ticketHistory?.quantity) || 0, 0);
  if (!reservation?.ticketHistoryId || reservation?.isOverbooked || (includeTotal && totalCount <= 0)) return "-";

  const ticketReservations = (reservations || [])
    .map((item) => item.id === reservation.id ? reservation : item)
    .filter((item) => item.ticketHistoryId === reservation.ticketHistoryId && item.status !== "취소")
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || left.reservedAt || left.date || "");
      const rightTime = Date.parse(right.createdAt || right.reservedAt || right.date || "");
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      return String(left.id || "").localeCompare(String(right.id || ""));
    });
  const usageRound = ticketReservations.findIndex((item) => item.id === reservation.id) + 1;
  return usageRound > 0 ? includeTotal ? `${usageRound}/${totalCount}회차` : `${usageRound}회차` : "-";
}
