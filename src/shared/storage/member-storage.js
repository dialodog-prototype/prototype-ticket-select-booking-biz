import { readJsonStorage, writeJsonStorage } from "./storage-utils.js";
import {
  getSchoolHomeReservationMembers,
  getSchoolHomeReservations,
} from "./school-home-storage.js";
import {
  applyCatalogDrafts,
  MAX_MEMBER_TAG_CATALOG_SIZE,
  mergeTagCatalog,
  normalizeMemberTagName,
  sanitizeTagList,
  sortMemberTagNames,
  syncTagListWithCatalogEdits,
} from "../services/member-tag-service.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { getTicketById } from "../data/ticket-list.js";
import { getTicketStatus } from "../services/ticket-status-service.js";

export const MEMBER_LIST_STORAGE_KEY = "memberList";
export const LEGACY_MEMBER_LIST_STORAGE_KEY = "prototype.memberTags.memberList";
export const DELETED_MEMBER_IDS_STORAGE_KEY = "prototype.memberTags.deletedMemberIds";
export const LEGACY_MEMBER_TAG_CATALOG_STORAGE_KEY = "prototype.memberTags.memberTagCatalog";
export const MEMBER_TAG_CATALOG_STORAGE_KEY = "memberTagCatalog";
export const SCHOOL_TICKET_ATTENDANCE_STORAGE_KEY = "schoolTicketAttendanceProcessed";

export function getStoredMembers() {
  const deletedMemberIds = loadDeletedMemberIds();
  const normalizedMembers = syncTicketStatuses(normalizeStoredMembers([
    ...getDefaultReservationMembers(),
    ...readMemberListStorage(LEGACY_MEMBER_LIST_STORAGE_KEY),
    ...readMemberListStorage(MEMBER_LIST_STORAGE_KEY),
  ].filter((member) => !deletedMemberIds.includes(member.id))), getSchoolHomeReservations());

  writeJsonStorage(MEMBER_LIST_STORAGE_KEY, normalizedMembers);
  return normalizedMembers;
}

export function getStoredMemberTagCatalog() {
  return loadMemberTagCatalog();
}

export function loadMemberTagCatalog() {
  const storedMemberTagCatalog = readJsonStorage(MEMBER_TAG_CATALOG_STORAGE_KEY, null);
  const legacyMemberTagCatalog = readJsonStorage(LEGACY_MEMBER_TAG_CATALOG_STORAGE_KEY, []);
  const catalogSource = Array.isArray(storedMemberTagCatalog)
    ? storedMemberTagCatalog
    : Array.isArray(legacyMemberTagCatalog) && legacyMemberTagCatalog.length
      ? legacyMemberTagCatalog
      : getDefaultMemberTagCatalog();

  if (!Array.isArray(catalogSource)) {
    return [];
  }

  const normalizedCatalog = sortMemberTagNames(catalogSource);
  writeJsonStorage(MEMBER_TAG_CATALOG_STORAGE_KEY, normalizedCatalog);
  return normalizedCatalog;
}

export function saveMemberTagCatalog(tags) {
  const nextCatalog = sortMemberTagNames(tags).slice(0, MAX_MEMBER_TAG_CATALOG_SIZE);
  writeJsonStorage(MEMBER_TAG_CATALOG_STORAGE_KEY, nextCatalog);
  return nextCatalog;
}

export function mergeMemberTagCatalog(tags) {
  const nextCatalog = mergeTagCatalog(loadMemberTagCatalog(), tags);
  writeJsonStorage(MEMBER_TAG_CATALOG_STORAGE_KEY, nextCatalog);
  return nextCatalog;
}

export function applyMemberTagCatalogEdits(drafts) {
  const nextCatalog = applyCatalogDrafts(loadMemberTagCatalog(), drafts);
  const nextMembers = getStoredMembers().map((member) => {
    return normalizeStoredMember({
      ...member,
      ownerTags: [],
      pets: member.pets.map((pet) => ({
        ...pet,
        petTags: syncTagListWithCatalogEdits(pet.petTags, drafts),
      })),
    });
  });

  writeJsonStorage(MEMBER_LIST_STORAGE_KEY, nextMembers);
  writeJsonStorage(MEMBER_TAG_CATALOG_STORAGE_KEY, nextCatalog);

  return {
    members: nextMembers,
    memberTagCatalog: nextCatalog,
  };
}

export function createMemberTag(memberTagName) {
  const nextTag = normalizeMemberTagInput(memberTagName);
  const memberTagCatalog = loadMemberTagCatalog();

  if (!nextTag) {
    return createMemberTagMutationResult(false, "empty", memberTagCatalog);
  }

  if (hasMemberTag(memberTagCatalog, nextTag)) {
    return createMemberTagMutationResult(false, "duplicate", memberTagCatalog);
  }

  if (memberTagCatalog.length >= MAX_MEMBER_TAG_CATALOG_SIZE) {
    return createMemberTagMutationResult(false, "maxCatalog", memberTagCatalog);
  }

  return {
    ok: true,
    reason: "",
    ...applyMemberTagCatalogEdits([{
      sourceTag: nextTag,
      nextTag,
      isDeleted: false,
    }]),
  };
}

export function renameMemberTag(sourceTag, nextTagName) {
  const sourceTagName = normalizeMemberTagInput(sourceTag);
  const nextTag = normalizeMemberTagInput(nextTagName);
  const memberTagCatalog = loadMemberTagCatalog();

  if (!sourceTagName || !nextTag) {
    return createMemberTagMutationResult(false, "empty", memberTagCatalog);
  }

  if (normalizeMemberTagName(sourceTagName) === normalizeMemberTagName(nextTag)) {
    return createMemberTagMutationResult(true, "", memberTagCatalog);
  }

  const isDuplicate = memberTagCatalog.some((memberTagName) => {
    return normalizeMemberTagName(memberTagName) !== normalizeMemberTagName(sourceTagName)
      && normalizeMemberTagName(memberTagName) === normalizeMemberTagName(nextTag);
  });

  if (isDuplicate) {
    return createMemberTagMutationResult(false, "duplicate", memberTagCatalog);
  }

  return {
    ok: true,
    reason: "",
    ...applyMemberTagCatalogEdits([{
      sourceTag: sourceTagName,
      nextTag,
      isDeleted: false,
    }]),
  };
}

export function deleteMemberTag(memberTagName) {
  const sourceTagName = normalizeMemberTagInput(memberTagName);
  const memberTagCatalog = loadMemberTagCatalog();

  if (!sourceTagName) {
    return createMemberTagMutationResult(false, "empty", memberTagCatalog);
  }

  if (!hasMemberTag(memberTagCatalog, sourceTagName)) {
    return createMemberTagMutationResult(true, "", memberTagCatalog);
  }

  return {
    ok: true,
    reason: "",
    ...applyMemberTagCatalogEdits([{
      sourceTag: sourceTagName,
      nextTag: "",
      isDeleted: true,
    }]),
  };
}

function createMemberTagMutationResult(ok, reason, memberTagCatalog) {
  return {
    ok,
    reason,
    members: getStoredMembers(),
    memberTagCatalog,
  };
}

function normalizeMemberTagInput(memberTagName) {
  return String(memberTagName || "").trim().replace(/\s+/g, " ");
}

function hasMemberTag(memberTagCatalog, memberTagName) {
  const normalizedTagName = normalizeMemberTagName(memberTagName);
  return (memberTagCatalog || []).some((currentTagName) => {
    return normalizeMemberTagName(currentTagName) === normalizedTagName;
  });
}

export function saveRegisteredMembers(membersToRegister) {
  const currentMembers = getStoredMembers();
  const nextMembers = [...currentMembers];
  const registeredMemberIds = [];

  membersToRegister.forEach((member) => {
    const normalizedMember = normalizeStoredMember({ ...member, isRegistered: true });
    registeredMemberIds.push(normalizedMember.id);
    const existingIndex = normalizedMember.id
      ? nextMembers.findIndex((currentMember) => currentMember.id === normalizedMember.id)
      : -1;
    const phoneIndex = normalizedMember.phoneNumber
      ? nextMembers.findIndex((currentMember) => normalizePhoneNumber(currentMember.phoneNumber) === normalizePhoneNumber(normalizedMember.phoneNumber))
      : -1;

    if (existingIndex >= 0) {
      nextMembers[existingIndex] = mergeMemberRecords(nextMembers[existingIndex], normalizedMember);
      return;
    }

    if (phoneIndex >= 0) {
      nextMembers[phoneIndex] = mergeMemberRecords(nextMembers[phoneIndex], normalizedMember);
      return;
    }

    nextMembers.push(normalizedMember);
  });

  writeJsonStorage(
    DELETED_MEMBER_IDS_STORAGE_KEY,
    loadDeletedMemberIds().filter((memberId) => !registeredMemberIds.includes(memberId))
  );
  writeJsonStorage(MEMBER_LIST_STORAGE_KEY, nextMembers);
  return nextMembers;
}

export function getMemberPetRows(members = getStoredMembers()) {
  return (members || []).flatMap((member) => {
    return getMemberPets(member).map((pet) => createMemberPetRow(member, pet));
  });
}

export function findMemberPet(member, petId) {
  const pets = Array.isArray(member?.pets) ? member.pets : getMemberPets(member);

  if (!petId) {
    return pets[0] || createEmptyPet();
  }

  return pets.find((pet) => pet.id === petId) || pets[0] || createEmptyPet();
}

export function saveStoredMembers(members) {
  const normalizedMembers = syncTicketStatuses(
    normalizeStoredMembers(Array.isArray(members) ? members : []),
    getSchoolHomeReservations()
  );
  const defaultMemberIds = getDefaultMemberIds();
  const savedMemberIds = normalizedMembers.map((member) => member.id);
  const nextDeletedMemberIds = mergeUniqueValues([
    ...loadDeletedMemberIds().filter((memberId) => !savedMemberIds.includes(memberId)),
    ...defaultMemberIds.filter((memberId) => !savedMemberIds.includes(memberId)),
  ]);

  writeJsonStorage(DELETED_MEMBER_IDS_STORAGE_KEY, nextDeletedMemberIds);
  writeJsonStorage(MEMBER_LIST_STORAGE_KEY, normalizedMembers);
  return normalizedMembers;
}

export function updateTicketHistoryCounters({ memberId, petId, ticketHistoryId, reservableDelta = 0, reservedDelta = 0, remainingDelta = 0 } = {}) {
  const currentMembers = getStoredMembers();
  let didUpdate = false;
  const nextMembers = currentMembers.map((member) => {
    if (member.id !== memberId) return member;
    return {
      ...member,
      pets: (member.pets || []).map((pet) => {
        if (pet.id !== petId) return pet;
        return {
          ...pet,
          ticketHistories: (pet.ticketHistories || []).map((ticket) => {
            if (ticket.id !== ticketHistoryId) return ticket;
            didUpdate = true;
            const nextReservableCount = Math.max((Number(ticket.reservableCount) || 0) + Number(reservableDelta || 0), 0);
            const nextRemainingCount = Math.max((Number(ticket.remainingCount) || 0) + Number(remainingDelta || 0), 0);
            return {
              ...ticket,
              reservableCount: nextReservableCount,
              reservedCount: Math.max((Number(ticket.reservedCount) || 0) + Number(reservedDelta || 0), 0),
              remainingCount: nextRemainingCount,
              depletedAt: nextReservableCount > 0 ? "" : ticket.depletedAt || new Date().toISOString(),
            };
          }),
        };
      }),
    };
  });

  return {
    didUpdate,
    members: didUpdate ? saveStoredMembers(nextMembers) : currentMembers,
  };
}

export function updateTicketHistory({ memberId, petId, ticketHistoryId, reservableCount, expiresAt } = {}) {
  if (!memberId || !petId || !ticketHistoryId) return { members: getStoredMembers(), didUpdate: false };

  const currentMembers = getStoredMembers();
  let didUpdate = false;
  const nextMembers = currentMembers.map((member) => {
    if (member.id !== memberId) return member;
    return {
      ...member,
      pets: (member.pets || []).map((pet) => {
        if (pet.id !== petId) return pet;
        return {
          ...pet,
          ticketHistories: (pet.ticketHistories || []).map((ticket) => {
            if (ticket.id !== ticketHistoryId) return ticket;
            didUpdate = true;
            const nextReservableCount = Math.max(Number(reservableCount) || 0, 0);
            return {
              ...ticket,
              reservableCount: nextReservableCount,
              expiresAt: expiresAt || "",
              depletedAt: nextReservableCount > 0 ? "" : ticket.depletedAt || new Date().toISOString(),
            };
          }),
        };
      }),
    };
  });

  return {
    didUpdate,
    members: didUpdate ? saveStoredMembers(nextMembers) : currentMembers,
  };
}

export function removeTicketHistory({ memberId, petId, ticketHistoryId } = {}) {
  if (!memberId || !petId || !ticketHistoryId) return { members: getStoredMembers(), didUpdate: false };

  const currentMembers = getStoredMembers();
  let didUpdate = false;
  const nextMembers = currentMembers.map((member) => {
    if (member.id !== memberId) return member;
    return {
      ...member,
      pets: (member.pets || []).map((pet) => {
        if (pet.id !== petId) return pet;
        const ticketHistories = (pet.ticketHistories || []).filter((ticket) => {
          const shouldRemove = ticket.id === ticketHistoryId;
          if (shouldRemove) didUpdate = true;
          return !shouldRemove;
        });
        return { ...pet, ticketHistories };
      }),
    };
  });

  return {
    didUpdate,
    members: didUpdate ? saveStoredMembers(nextMembers) : currentMembers,
  };
}

export function isSchoolTicketAttendanceProcessed(reservationId) {
  if (!reservationId) return false;
  const processedIds = readJsonStorage(SCHOOL_TICKET_ATTENDANCE_STORAGE_KEY, []);
  return Array.isArray(processedIds) && processedIds.includes(reservationId);
}

export function processSchoolTicketAttendance(reservations, today = new Date()) {
  const processedIds = new Set(readJsonStorage(SCHOOL_TICKET_ATTENDANCE_STORAGE_KEY, []));
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const pendingReservations = (reservations || []).filter((reservation) => {
    return reservation?.id
      && reservation.ticketHistoryId
      && reservation.date < todayKey
      && String(reservation.status || "예약").trim() !== "취소"
      && !processedIds.has(reservation.id);
  });
  if (!pendingReservations.length) return getStoredMembers();

  let nextMembers = getStoredMembers();
  const completedIds = [];
  pendingReservations.forEach((reservation) => {
    let didUpdate = false;
    nextMembers = nextMembers.map((member) => {
      if (member.id !== reservation.memberId) return member;
      return {
        ...member,
        pets: (member.pets || []).map((pet) => {
          if (pet.id !== reservation.petId) return pet;
          return {
            ...pet,
            ticketHistories: (pet.ticketHistories || []).map((ticket) => {
              if (ticket.id !== reservation.ticketHistoryId) return ticket;
              didUpdate = true;
              const remainingCount = Math.max((Number(ticket.remainingCount) || 0) - 1, 0);
              return {
                ...ticket,
                reservedCount: (Number(ticket.reservedCount) || 0) + 1,
                remainingCount,
                depletedAt: remainingCount <= 0 ? ticket.depletedAt || new Date(`${reservation.date}T12:00:00`).toISOString() : ticket.depletedAt || "",
              };
            }),
          };
        }),
      };
    });
    if (didUpdate) completedIds.push(reservation.id);
  });

  if (!completedIds.length) return getStoredMembers();
  const savedMembers = saveStoredMembers(nextMembers);
  writeJsonStorage(SCHOOL_TICKET_ATTENDANCE_STORAGE_KEY, [...processedIds, ...completedIds]);
  return savedMembers;
}

export function issueTicketToMemberPet({ memberId, petId, ticket, quantity = 1, deductedCount = 0 } = {}) {
  const currentMembers = getStoredMembers();
  const issueQuantity = Math.max(Math.floor(Number(quantity) || 0), 1);
  const ticketQuantity = Math.max(Math.floor(Number(ticket?.quantity) || 0), 0);
  const totalIssuedCount = ticketQuantity * issueQuantity;
  const deduction = Math.min(Math.max(Math.floor(Number(deductedCount) || 0), 0), totalIssuedCount);

  if (!memberId || !petId || !ticket?.id || totalIssuedCount <= 0) {
    return { members: currentMembers, issuedTicket: null, issuedTickets: [] };
  }

  const issuedAt = new Date().toISOString();
  const ticketHistoryPrefix = `ticket-history-${ticket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let remainingDeduction = deduction;
  const issuedTickets = Array.from({ length: issueQuantity }, (_, index) => {
    const ticketDeduction = Math.min(remainingDeduction, ticketQuantity);
    remainingDeduction -= ticketDeduction;
    return {
      id: `${ticketHistoryPrefix}-${index + 1}`,
      ticketId: ticket.id,
      type: ticket.type || "school",
      pickdropType: ticket.pickdropType ?? null,
      status: ticketDeduction > 0 ? "이용 중" : "사용 전",
      ticketName: ticket.name || "이용권",
      remainingCount: ticketQuantity - ticketDeduction,
      reservableCount: ticketQuantity - ticketDeduction,
      reservedCount: 0,
      totalCount: ticketQuantity,
      quantity: ticketQuantity,
      validity: Number(ticket.validity) || 0,
      unit: ticket.unit || "",
      validDays: ticket.unlimitedValidity ? 0 : getTicketValidDays(ticket),
      expiresAt: "",
      amount: Number(ticket.price) || 0,
      price: Number(ticket.price) || 0,
      startDatePolicy: ticket.startDatePolicy || "",
      reservationDateRule: ticket.reservationDateRule || "",
      unlimitedValidity: Boolean(ticket.unlimitedValidity),
      weekdays: ticket.weekdays ?? null,
      classIds: ticket.classIds ?? null,
      deductedCount: ticketDeduction,
      depletedAt: ticketDeduction >= ticketQuantity ? issuedAt : "",
      startedAt: "",
      issuedAt,
    };
  });

  const nextMembers = currentMembers.map((member) => {
    if (member.id !== memberId) {
      return member;
    }

    return {
      ...member,
      pets: (member.pets || []).map((pet) => {
        if (pet.id !== petId) {
          return pet;
        }

        const totalReservableCountByType = {
          ...(pet.totalReservableCountByType || {}),
          school: (Number(pet.totalReservableCountByType?.school) || 0) + totalIssuedCount,
        };
        const totalReservedCountByType = {
          ...(pet.totalReservedCountByType || {}),
          school: Number(pet.totalReservedCountByType?.school) || 0,
        };

        return {
          ...pet,
          totalReservableCountByType,
          totalReservedCountByType,
          remainingCountByType: {
            ...(pet.remainingCountByType || {}),
            school: Math.max(totalReservableCountByType.school - totalReservedCountByType.school, 0),
          },
          ticketHistories: [...(pet.ticketHistories || []), ...issuedTickets],
        };
      }),
    };
  });

  return {
    members: saveStoredMembers(nextMembers),
    issuedTicket: issuedTickets[0] || null,
    issuedTickets,
  };
}

export function deleteStoredMember(memberId) {
  const nextMembers = getStoredMembers().filter((member) => member.id !== memberId);
  const nextDeletedMemberIds = mergeUniqueValues([...loadDeletedMemberIds(), memberId]);

  writeJsonStorage(DELETED_MEMBER_IDS_STORAGE_KEY, nextDeletedMemberIds);
  writeJsonStorage(MEMBER_LIST_STORAGE_KEY, nextMembers);
  return nextMembers;
}

export function createMemberId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPetId() {
  return `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStoredMembers(storedMembers) {
  const groupedMembers = [];
  const groupIndexByKey = new Map();

  storedMembers.forEach((member) => {
    const normalizedMember = normalizeStoredMember(member);
    const groupKey = getMemberGroupKey(normalizedMember);
    const existingIndex = groupIndexByKey.get(groupKey);

    if (existingIndex === undefined) {
      groupIndexByKey.set(groupKey, groupedMembers.length);
      groupedMembers.push(normalizedMember);
      return;
    }

    groupedMembers[existingIndex] = mergeMemberRecords(groupedMembers[existingIndex], normalizedMember);
  });

  return groupedMembers;
}

function syncTicketStatuses(members, reservations) {
  return members.map((member) => ({
    ...member,
    pets: (member.pets || []).map((pet) => ({
      ...pet,
      ticketHistories: (pet.ticketHistories || []).map((ticket) => ({
        ...ticket,
        status: getTicketStatus(ticket, reservations, {
          memberId: member.id,
          petId: pet.id,
          ticketHistories: pet.ticketHistories || [],
        }),
      })),
    })),
  }));
}

function readMemberListStorage(storageKey) {
  const storedMembers = readJsonStorage(storageKey, []);
  return Array.isArray(storedMembers) ? storedMembers : [];
}

function loadDeletedMemberIds() {
  const deletedMemberIds = readJsonStorage(DELETED_MEMBER_IDS_STORAGE_KEY, []);
  return Array.isArray(deletedMemberIds) ? mergeUniqueValues(deletedMemberIds) : [];
}

function getDefaultMemberIds() {
  return normalizeStoredMembers(getDefaultReservationMembers()).map((member) => member.id);
}

function getDefaultReservationMembers() {
  return getSchoolHomeReservationMembers();
}

function mergeUniqueValues(values) {
  const uniqueValues = [];

  values.forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (normalizedValue && !uniqueValues.includes(normalizedValue)) {
      uniqueValues.push(normalizedValue);
    }
  });

  return uniqueValues;
}

function normalizeStoredMember(member) {
  const normalizedMember = {
    id: member?.id || createMemberId(),
    guardianName: member?.guardianName || member?.owner || "",
    phoneNumber: member?.phoneNumber || member?.phone || "",
    address: member?.address || "",
    addressDetail: member?.addressDetail || "",
    isRegistered: Boolean(member?.isRegistered || member?.registered || member?.registeredAt || member?.memberRegistrationStatus === "registered"),
    ownerTags: [],
    pets: normalizePets(member),
  };

  if (normalizedMember.pets.length === 0) {
    normalizedMember.pets = [createEmptyPet()];
  }

  return normalizedMember;
}

function normalizePets(member) {
  if (Array.isArray(member?.pets)) {
    return member.pets.map(normalizePet).filter(hasMeaningfulPetData);
  }

  const legacyPet = normalizePet(member);
  return hasMeaningfulPetData(legacyPet) ? [legacyPet] : [];
}

function normalizePet(pet) {
  return {
    id: pet?.id || createPetId(),
    petName: pet?.petName || pet?.dogName || "",
    dogName: pet?.dogName || pet?.petName || "",
    breed: pet?.breed || "",
    memo: pet?.memo || "",
    birthDate: pet?.birthDate || pet?.birthday || "",
    animalRegistrationNumber: pet?.animalRegistrationNumber || pet?.registrationNumber || "",
    coatColor: pet?.coatColor || "",
    weight: pet?.weight || "",
    gender: pet?.gender || "",
    neuteredStatus: pet?.neuteredStatus || "",
    remainingCountByType: normalizeCountMap(pet?.remainingCountByType),
    totalReservableCountByType: normalizeCountMap(pet?.totalReservableCountByType),
    totalReservedCountByType: normalizeCountMap(pet?.totalReservedCountByType),
    ticketHistories: normalizeTicketHistories(pet?.ticketHistories || pet?.tickets),
    petTags: normalizeMemberTags(pet?.petTags),
  };
}

function createEmptyPet() {
  return normalizePet({});
}

function hasMeaningfulPetData(pet) {
  return Boolean(
    pet?.petName ||
    pet?.dogName ||
    pet?.breed ||
    pet?.memo ||
    pet?.birthDate ||
    pet?.animalRegistrationNumber ||
    pet?.coatColor ||
    pet?.weight ||
    pet?.gender ||
    pet?.neuteredStatus ||
    pet?.petTags?.length ||
    pet?.ticketHistories?.length
  );
}

function mergeMemberRecords(currentMember, nextMember) {
  const mergedPets = [...getMemberPets(currentMember)];

  getMemberPets(nextMember).forEach((nextPet) => {
    const existingPetIndex = nextPet.id ? mergedPets.findIndex((pet) => pet.id === nextPet.id) : -1;

    if (existingPetIndex >= 0) {
      mergedPets[existingPetIndex] = normalizePet(nextPet);
      return;
    }

    mergedPets.push(normalizePet(nextPet));
  });

  return normalizeStoredMember({
    ...currentMember,
    ...nextMember,
    id: currentMember.id || nextMember.id || createMemberId(),
    guardianName: nextMember.guardianName || currentMember.guardianName,
    phoneNumber: nextMember.phoneNumber || currentMember.phoneNumber,
    address: nextMember.address || currentMember.address,
    addressDetail: nextMember.addressDetail || currentMember.addressDetail,
    ownerTags: [],
    isRegistered: Boolean(currentMember.isRegistered || nextMember.isRegistered),
    pets: mergedPets,
  });
}

function getMemberPets(member) {
  return Array.isArray(member?.pets) ? member.pets.map(normalizePet) : normalizePets(member);
}

function createMemberPetRow(member, pet) {
  return {
    ...pet,
    id: member.id,
    memberId: member.id,
    petId: pet.id,
    guardianName: member.guardianName,
    phoneNumber: member.phoneNumber,
    address: member.address,
    addressDetail: member.addressDetail,
    ownerTags: [],
    isRegistered: member.isRegistered,
    pets: member.pets,
  };
}

function getMemberGroupKey(member) {
  const phoneNumber = normalizePhoneNumber(member?.phoneNumber);
  return phoneNumber ? `phone:${phoneNumber}` : `id:${member?.id || createMemberId()}`;
}


function normalizeCountMap(countMap) {
  const source = countMap && typeof countMap === "object" ? countMap : {};

  return {
    school: normalizeCount(source.school),
    daycare: normalizeCount(source.daycare),
    oneway: normalizeCount(source.oneway),
    roundtrip: normalizeCount(source.roundtrip),
  };
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function getTicketValidDays(ticket) {
  const validity = Math.max(Number(ticket?.validity) || 0, 0);
  const unit = String(ticket?.unit || "").trim();

  if (unit === "주") {
    return validity * 7;
  }

  if (unit === "개월" || unit === "달") {
    return validity * 30;
  }

  return validity;
}

function normalizeMemberTags(memberTags) {
  return sanitizeTagList(memberTags);
}

function getDefaultMemberTagCatalog() {
  return getDefaultReservationMembers().flatMap((member) => {
    return [
      ...(member.pets || []).flatMap((pet) => pet.petTags || []),
    ];
  });
}

function normalizeTicketHistories(ticketHistories) {
  if (!Array.isArray(ticketHistories)) {
    return [];
  }

  return ticketHistories
    .map((ticketHistory) => {
      const catalogTicket = getTicketById(ticketHistory?.ticketId);
      const remainingCount = normalizeCount(ticketHistory?.remainingCount);
      return {
        id: ticketHistory?.id || "",
        ticketId: ticketHistory?.ticketId || "",
        type: ticketHistory?.type || catalogTicket?.type || "",
        pickdropType: ticketHistory?.pickdropType ?? catalogTicket?.pickdropType ?? null,
        status: ticketHistory?.status || "",
        ticketName: ticketHistory?.ticketName || ticketHistory?.name || catalogTicket?.name || "",
        remainingCount,
        reservableCount: normalizeCount(ticketHistory?.reservableCount ?? remainingCount),
        reservedCount: normalizeCount(ticketHistory?.reservedCount),
        totalCount: normalizeCount(ticketHistory?.totalCount),
        quantity: normalizeCount(ticketHistory?.quantity || catalogTicket?.quantity),
        validity: normalizeCount(ticketHistory?.validity || catalogTicket?.validity),
        unit: ticketHistory?.unit || catalogTicket?.unit || "",
        validDays: normalizeCount(ticketHistory?.validDays),
        expiresAt: ticketHistory?.expiresAt || "",
        amount: normalizeCount(ticketHistory?.amount ?? ticketHistory?.price ?? catalogTicket?.price),
        price: normalizeCount(ticketHistory?.price ?? ticketHistory?.amount ?? catalogTicket?.price),
        startDatePolicy: ticketHistory?.startDatePolicy || catalogTicket?.startDatePolicy || "",
        reservationDateRule: ticketHistory?.reservationDateRule || catalogTicket?.reservationDateRule || "",
        unlimitedValidity: Boolean(ticketHistory?.unlimitedValidity ?? catalogTicket?.unlimitedValidity),
        weekdays: ticketHistory?.weekdays ?? catalogTicket?.weekdays ?? null,
        classIds: ticketHistory?.classIds ?? catalogTicket?.classIds ?? null,
        deductedCount: normalizeCount(ticketHistory?.deductedCount),
        depletedAt: ticketHistory?.depletedAt || "",
        startedAt: ticketHistory?.startedAt || "",
        usageHistory: Array.isArray(ticketHistory?.usageHistory) ? ticketHistory.usageHistory.map((item) => ({ ...item })) : [],
        issuedAt: ticketHistory?.issuedAt || "",
      };
    })
    .filter((ticketHistory) => {
      return ticketHistory.ticketName;
    });
}
