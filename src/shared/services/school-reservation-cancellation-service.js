import { removeSchoolHomeReservation, updateSchoolHomeReservationStatus } from "../storage/school-home-storage.js";
import { getStoredMembers, updateTicketHistoryCounters } from "../storage/member-storage.js";

export function cancelSchoolReservation(reservation, { remove = false } = {}) {
  if (!reservation || reservation.status === "취소") {
    return { reservation: reservation || null, members: null };
  }

  // Persist a derived start date before removing its reservation evidence.
  getStoredMembers();
  const cancelledReservation = remove
    ? removeSchoolHomeReservation(reservation.id)
    : updateSchoolHomeReservationStatus(reservation.id, "취소");
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
