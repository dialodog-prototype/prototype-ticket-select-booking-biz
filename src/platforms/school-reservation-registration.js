import { renderSchoolHome } from "../features/school-home/school-home-renderer.js";
import { createSchoolHomeState, getTodayDateKey } from "../features/school-home/school-home-state.js";

const registrationState = createSchoolHomeState();

registrationState.isStandaloneAppReservationRegistration = true;
registrationState.isAppReservationRegisterOpen = true;
registrationState.reservationRegisterDraft = {
  memberId: "",
  petId: "",
  query: "",
  currentMonth: getTodayDateKey().slice(0, 7),
  selectedDates: [],
  ticketInitialCounts: {},
  allowOverLimit: false,
};

renderSchoolHome(document.querySelector("#app"), registrationState);
