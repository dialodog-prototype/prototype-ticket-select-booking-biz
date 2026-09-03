import { findMemberPet, loadMemberTagCatalog, getStoredMembers, processSchoolTicketAttendance } from "../../shared/storage/member-storage.js";
import { getSchoolHomeReservations } from "../../shared/storage/school-home-storage.js";
import { readJsonStorage } from "../../shared/storage/storage-utils.js";
import { createOwnerDetailDraft, createPetDetailDraft } from "./member-detail-draft.js";

export const TICKET_CANCEL_FUTURE_RESERVATIONS_STORAGE_KEY = "ticketCancelFutureReservations";

export function createMemberDetailState() {
  const queryParams = new URLSearchParams(window.location.search);
  const memberId = queryParams.get("memberId") || "";
  const petId = queryParams.get("petId") || "";
  const reservations = getSchoolHomeReservations();
  processSchoolTicketAttendance(reservations);
  const members = getStoredMembers();
  const selectedMember = members.find((member) => member.id === memberId) || createEmptyMember();
  const selectedPet = findMemberPet(selectedMember, petId);

  return {
    members,
    memberTagCatalog: loadMemberTagCatalog(),
    activeScreen: "memberDetail",
    selectedMember,
    selectedPet,
    activeMemberDetailTab: "memberInfo",
    isTicketDetailModalOpen: false,
    selectedTicketHistory: null,
    isTicketCancelAlertOpen: false,
    shouldCancelFutureTicketReservations: readJsonStorage(TICKET_CANCEL_FUTURE_RESERVATIONS_STORAGE_KEY, false) === true,
    isAppTicketDetailOpen: false,
    appTicketDetailTab: "usage",
    isAppTicketStatusEditSheetOpen: false,
    isAppTicketStatusEditBlockedAlertOpen: false,
    appTicketStatusDraft: null,
    reservations,
    isTicketIssueBottomSheetOpen: false,
    ticketIssueSelectedId: "",
    ticketIssueQuantity: 1,
    isDetailInfoExpanded: false,
    isDetailMemoExpanded: false,
    isPetDetailModalOpen: false,
    isPetDetailBottomSheetOpen: false,
    isOwnerDetailModalOpen: false,
    ownerDetailDraft: createOwnerDetailDraft(selectedMember),
    petDetailDraft: createPetDetailDraft(selectedPet),
    toastMessage: queryParams.get("toast") === "existingMember"
      ? "이미 등록된 회원입니다.\n반려견 정보를 확인해 주세요."
      : "",
    isMemberRegistrationPageOpen: false,
    isGuardianLookupModalOpen: false,
    guardianLookup: {
      guardianName: "",
      phoneNumber: "",
      error: "",
    },
  };
}

function createEmptyMember() {
  return {
    id: "",
    guardianName: "",
    phoneNumber: "",
    address: "",
    addressDetail: "",
    ownerTags: [],
    pets: [],
  };
}
