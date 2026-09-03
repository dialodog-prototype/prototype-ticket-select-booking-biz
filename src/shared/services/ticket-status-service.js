const TICKET_STATUS_USING = "이용 중";
const TICKET_STATUS_READY = "사용 전";
const TICKET_STATUS_DEPLETED = "횟수 소진";
const TICKET_STATUS_EXPIRED = "만료";

export function getTicketStatus(ticket, reservations = [], { memberId = "", petId = "", ticketHistories = [] } = {}) {
  const reservableCount = Number(ticket?.reservableCount ?? ticket?.remainingCount ?? ticket?.totalCount) || 0;
  const todayKey = getDateKey(new Date());
  const startedAt = getTicketStartDate(ticket, reservations, { memberId, petId, ticketHistories });
  const expiresAt = getTicketExpiryDate(ticket, reservations, { memberId, petId, ticketHistories });
  const expiresAtKey = expiresAt ? getDateKey(expiresAt) : "";
  const depletedAtKey = ticket?.depletedAt ? getDateKey(ticket.depletedAt) : "";
  const isDepleted = reservableCount <= 0;
  const isExpired = Boolean(expiresAtKey && todayKey > expiresAtKey);

  if (isDepleted && (!isExpired || isDepletedBeforeExpiry(depletedAtKey, expiresAtKey))) {
    return TICKET_STATUS_DEPLETED;
  }

  if (isExpired) {
    return TICKET_STATUS_EXPIRED;
  }

  return startedAt ? TICKET_STATUS_USING : TICKET_STATUS_READY;
}

function isDepletedBeforeExpiry(depletedAtKey, expiresAtKey) {
  if (!expiresAtKey) return true;
  if (!depletedAtKey) return false;
  return depletedAtKey <= expiresAtKey;
}

export function getTicketUsageHistory(ticket, reservations = [], { memberId = "", petId = "", ticketHistories = [] } = {}) {
  const relevantReservations = (reservations || []).filter((reservation) => {
    return reservation?.memberId === memberId && reservation?.petId === petId;
  });
  const hasReservationTicketLink = relevantReservations.some((reservation) => {
    return reservation?.ticketHistoryId || reservation?.ticketId;
  });
  const explicitMatches = relevantReservations.filter((reservation) => isReservationForTicket(reservation, ticket));

  if (explicitMatches.length || hasReservationTicketLink || ticketHistories.length > 1) {
    return sortTicketUsageByVisitDate(explicitMatches);
  }

  return sortTicketUsageByVisitDate(relevantReservations);
}

function sortTicketUsageByVisitDate(reservations) {
  return [...reservations].sort((left, right) => {
    const visitDateOrder = String(right?.date || "").localeCompare(String(left?.date || ""));
    if (visitDateOrder !== 0) return visitDateOrder;
    return getReservationCreatedTime(right).localeCompare(getReservationCreatedTime(left));
  });
}

export function getTicketUsageItem(reservation, today = new Date()) {
  const todayKey = getDateKey(today);
  const reservationStatus = String(reservation?.status || "").trim();
  const status = reservationStatus === "취소"
    ? "취소"
    : reservation?.date && reservation.date < todayKey
      ? "이용 완료"
      : "예약";

  return {
    id: reservation?.id || "",
    status,
    service: "유치원",
    visitDate: reservation?.date || "",
    createdAt: reservation?.createdAt || reservation?.reservedAt || reservation?.date || "",
    cancelledAt: reservation?.cancelledAt || "",
  };
}

export function getOverbookedReservationCount(reservations = [], { memberId = "", petId = "" } = {}) {
  return (reservations || []).filter((reservation) => {
    return reservation?.memberId === memberId
      && reservation?.petId === petId
      && reservation?.isOverbooked === true
      && String(reservation?.status || "예약").trim() !== "취소";
  }).length;
}

export function getActiveTicketReservableCount(ticketHistories = []) {
  return (ticketHistories || []).reduce((total, ticket) => {
    const status = String(ticket?.status || "").trim().toLowerCase();
    const isUnavailable = ["만료", "expired", "소진", "횟수 소진", "depleted"].includes(status);
    return isUnavailable ? total : total + (Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0);
  }, 0);
}

export function getTicketStartDate(ticket, reservations = [], { memberId = "", petId = "", ticketHistories = [] } = {}) {
  if (ticket?.startedAt) return parseDate(ticket.startedAt);

  const policy = normalizeStartDatePolicy(ticket?.startDatePolicy);
  if (policy === "issued-date") {
    return parseDate(ticket?.issuedAt || ticket?.createdAt);
  }

  const usageHistory = getTicketUsageHistory(ticket, reservations, { memberId, petId, ticketHistories });
  if (policy === "first-attendance") {
    const firstAttendance = usageHistory
      .filter((reservation) => isAttendanceReservation(reservation))
      .sort((left, right) => String(left.date || "").localeCompare(String(right.date || "")))[0];
    return parseDate(firstAttendance?.date);
  }

  if (policy === "first-reservation") {
    return parseDate(ticket?.issuedAt || ticket?.createdAt);
  }

  return null;
}

export function getTicketExpiryDate(ticket, reservations = [], { memberId = "", petId = "", ticketHistories = [] } = {}) {
  const startDate = getTicketStartDate(ticket, reservations, { memberId, petId, ticketHistories });
  if (!startDate) return null;
  if (ticket?.expiresAt) return parseDate(ticket.expiresAt);
  if (ticket?.unlimitedValidity) return null;

  const validDays = Number(ticket.validDays) || getValidDays(ticket);
  if (validDays <= 0) return null;
  startDate.setDate(startDate.getDate() + validDays);
  return startDate;
}

function isReservationForTicket(reservation, ticket) {
  if (!reservation || !ticket) return false;
  if (reservation.ticketHistoryId) return reservation.ticketHistoryId === ticket.id;
  if (reservation.ticketId) return reservation.ticketId === ticket.ticketId || reservation.ticketId === ticket.id;
  return false;
}

function normalizeStartDatePolicy(policy) {
  const normalizedPolicy = String(policy || "").trim().toLowerCase();
  if (["issued-date", "issued", "지급일"].includes(normalizedPolicy)) return "issued-date";
  if (["first-attendance", "first attendance", "첫 등원일"].includes(normalizedPolicy)) return "first-attendance";
  if (["first-reservation", "first reservation", "첫 예약일"].includes(normalizedPolicy)) return "first-reservation";
  return "";
}

function isAttendanceReservation(reservation) {
  if (reservation?.attendedAt) return true;
  if (String(reservation?.status || "").trim() === "이용 완료") return true;
  return Boolean(reservation?.date && reservation.date < getDateKey(new Date()));
}

function getReservationCreatedTime(reservation) {
  return reservation?.createdAt || reservation?.reservedAt || reservation?.date || "";
}

export function getLatestUsedTicketId(reservations = [], { memberId = "", petId = "", ticketHistories = [] } = {}) {
  const ticketHistoryById = new Map((ticketHistories || []).map((ticket) => [ticket.id, ticket]));
  const latestReservation = getLatestTicketReservation(reservations, { memberId, petId });

  if (!latestReservation) return "";
  const ticketHistory = ticketHistoryById.get(latestReservation.ticketHistoryId);
  return ticketHistory?.ticketId || latestReservation.ticketId || "";
}

export function getLatestUsedTicketHistoryId(reservations = [], { memberId = "", petId = "" } = {}) {
  return getLatestTicketReservation(reservations, { memberId, petId })?.ticketHistoryId || "";
}

function getLatestTicketReservation(reservations, { memberId, petId }) {
  return (reservations || [])
    .filter((reservation) => {
      return reservation?.memberId === memberId
        && reservation?.petId === petId
        && String(reservation?.status || "예약").trim() !== "취소"
        && (reservation?.ticketHistoryId || reservation?.ticketId);
    })
    .sort((left, right) => getReservationCreatedTime(right).localeCompare(getReservationCreatedTime(left)))[0] || null;
}

function getValidDays(ticket) {
  const validity = Math.max(Number(ticket?.validity) || 0, 0);
  const unit = String(ticket?.unit || "").trim();
  if (unit === "주") return validity * 7;
  if (unit === "개월" || unit === "달") return validity * 30;
  return validity;
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateKey(date) {
  const normalizedDate = date instanceof Date ? date : parseDate(date);
  if (!normalizedDate) return "";
  return `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, "0")}-${String(normalizedDate.getDate()).padStart(2, "0")}`;
}
