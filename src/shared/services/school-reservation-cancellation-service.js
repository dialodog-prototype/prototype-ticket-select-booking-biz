import { updateSchoolHomeReservationStatus } from "../storage/school-home-storage.js";
import { updateTicketHistoryCounters } from "../storage/member-storage.js";

export function cancelSchoolReservation(reservation) {
  if (!reservation || reservation.status === "취소") {
    return { reservation: reservation || null, members: null };
  }

  const cancelledReservation = updateSchoolHomeReservationStatus(reservation.id, "취소");
  if (!cancelledReservation) {
    return { reservation: null, members: null };
  }

  if (reservation.status === "예약" && reservation.ticketHistoryId) {
    const counterResult = updateTicketHistoryCounters({
      memberId: reservation.memberId,
      petId: reservation.petId,
      ticketHistoryId: reservation.ticketHistoryId,
      reservableDelta: 1,
    });
    return { reservation: cancelledReservation, members: counterResult.members };
  }

  return { reservation: cancelledReservation, members: null };
}
