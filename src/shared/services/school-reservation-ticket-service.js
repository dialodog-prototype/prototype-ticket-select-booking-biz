export function getTicketUsageRound(reservation, ticketHistory, reservations) {
  const totalCount = Math.max(Number(ticketHistory?.totalCount ?? ticketHistory?.quantity) || 0, 0);
  if (!reservation?.ticketHistoryId || reservation?.isOverbooked || totalCount <= 0) return "-";

  const ticketReservations = (reservations || [])
    .map((item) => item.id === reservation.id ? reservation : item)
    .filter((item) => item.ticketHistoryId === reservation.ticketHistoryId && item.status !== "취소")
    .sort((left, right) => {
      const dateOrder = String(left.date || "").localeCompare(String(right.date || ""));
      if (dateOrder) return dateOrder;
      return String(left.createdAt || left.reservedAt || left.id || "").localeCompare(String(right.createdAt || right.reservedAt || right.id || ""));
    });
  const usageRound = ticketReservations.findIndex((item) => item.id === reservation.id) + 1;
  return usageRound > 0 ? `${usageRound}/${totalCount}회차` : "-";
}
