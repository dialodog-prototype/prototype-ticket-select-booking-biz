import { renderSchoolReservationEdit } from "../features/school-reservation-edit/school-reservation-edit-renderer.js";

const reservationId = new URLSearchParams(window.location.search).get("reservationId");
renderSchoolReservationEdit(document.querySelector("#app"), reservationId);
