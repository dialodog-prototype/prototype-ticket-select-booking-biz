import { getAvailableReservationTickets, getTicketReservableCount } from "../../shared/services/school-reservation-ticket-service.js";

export function getReservationPet(member, petId) {
  return (member?.pets || []).find((pet) => pet.id === petId) || null;
}

export function getPetReservationCount(reservations, memberId, petId) {
  return (reservations || []).filter((reservation) => {
    return reservation.memberId === memberId && reservation.petId === petId;
  }).length;
}

export function getPetReservationLimit(pet) {
  return Number(pet?.totalReservableCountByType?.school) || 0;
}

export function getPetReservableCount(pet, reservations = [], memberId = "") {
  return getAvailableReservationTickets(pet, reservations, memberId)
    .reduce((total, ticket) => total + getTicketReservableCount(ticket), 0);
}

export function getReservationRegistrationSnapshot(member, reservations = []) {
  const byId = (left, right) => String(left.id).localeCompare(String(right.id));
  const snapshot = {
    memberId: member?.id || "",
    pets: (member?.pets || []).map((pet) => ({
      id: pet.id,
      tickets: [...(pet.ticketHistories || [])].sort(byId),
      availableTicketIds: getAvailableReservationTickets(pet, reservations, member.id)
        .map((ticket) => ticket.id).sort(),
    })).sort(byId),
    reservations: reservations.filter((reservation) => reservation.memberId === member?.id).sort(byId),
  };
  return JSON.stringify(snapshot, (key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
  });
}

export function reconcileReservationRegistrationSelection(draft, member, reservations, capacityClosedDates = []) {
  const pet = getReservationPet(member, draft.petId);
  const tickets = getAvailableReservationTickets(pet, reservations, draft.memberId);
  const selectedTicket = tickets.find((ticket) => ticket.id === draft.ticketId);
  const reservedDates = new Set(reservations.filter((reservation) => {
    return reservation.memberId === draft.memberId && reservation.petId === draft.petId && reservation.status !== "취소";
  }).map((reservation) => reservation.date));
  const selectedDates = draft.selectedDates.filter((date) => !reservedDates.has(date) && !capacityClosedDates.includes(date));
  return {
    ticketId: selectedTicket?.id || "",
    selectedDates: selectedTicket && tickets.length > 1
      ? selectedDates.slice(0, getTicketReservableCount(selectedTicket))
      : selectedDates,
  };
}

export function shouldRequireTicketChange({ selectedDateCount = 0, selectedTicket, availableTickets = [] } = {}) {
  const ticketCapacity = Number(selectedTicket?.reservableCount ?? selectedTicket?.remainingCount) || 0;
  return availableTickets.length > 1 && selectedDateCount >= ticketCapacity;
}

export function getRegistrationValidation({ member, pet, ticketSelected = true, selectedDates, reservations, capacityClosedDates, allowOverLimit = false }) {
  const dates = selectedDates || [];
  if (!member || !pet) return { isValid: false, message: "회원을 선택해 주세요." };
  if (!ticketSelected) return { isValid: false, message: "이용권을 선택해 주세요." };
  if (!dates.length) return { isValid: false, message: "예약 날짜를 선택해 주세요." };
  if (dates.some((date) => (capacityClosedDates || []).includes(date))) return { isValid: false, message: "마감된 날짜는 등록할 수 없습니다." };

  const existingDates = new Set((reservations || [])
    .filter((reservation) => reservation.status !== "취소" && reservation.memberId === member.id && reservation.petId === pet.id)
    .map((reservation) => reservation.date));
  if (dates.some((date) => existingDates.has(date))) return { isValid: false, message: "이미 예약된 날짜가 있습니다." };

  const total = getPetReservableCount(pet, reservations, member.id);
  if (dates.length > total && !allowOverLimit) return { isValid: false, message: "예약 가능한 횟수를 초과했습니다." };
  return { isValid: true, message: "" };
}

export function createSchoolReservation({ member, pet, date, ticket, memo, isOverbooked = false }) {
  return {
    id: `school-reservation-${Date.now()}-${date}`,
    date,
    memberId: member.id,
    petId: pet.id,
    petName: pet.petName || pet.dogName || "",
    breed: pet.breed || "",
    guardianName: member.guardianName || "",
    phoneNumber: member.phoneNumber || "",
    address: member.address || "",
    addressDetail: member.addressDetail || "",
    ownerTags: member.ownerTags || [],
    petTags: pet.petTags || [],
    birthDate: pet.birthDate || "",
    animalRegistrationNumber: pet.animalRegistrationNumber || "",
    coatColor: pet.coatColor || "",
    weight: pet.weight || "",
    gender: pet.gender || "",
    neuteredStatus: pet.neuteredStatus || "",
    memo: memo ?? pet.memo ?? "",
    totalReservableCount: getPetReservationLimit(pet),
    isOverbooked: Boolean(isOverbooked || !ticket?.id),
    ticketHistoryId: ticket?.id || "",
    ticketId: ticket?.ticketId || ticket?.id || "",
    ticketName: ticket?.ticketName || "",
  };
}

export function createPickdropReservation({ member, pet, daycareReservationId, date, type }) {
  return {
    id: `pickdrop-reservation-${Date.now()}-${type}-${date}`,
    daycareReservationId,
    date,
    type,
    memberId: member.id,
    petId: pet.id,
    petName: pet.petName || pet.dogName || "",
    breed: pet.breed || "",
    guardianName: member.guardianName || "",
  };
}
