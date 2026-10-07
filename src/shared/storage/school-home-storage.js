import { readJsonStorage, writeJsonStorage } from "./storage-utils.js";

export const SCHOOL_HOME_RESERVATIONS_STORAGE_KEY = "schoolHomeReservations";

const LEGACY_SCHOOL_DUMMY_RESERVATION_IDS = new Set(
  Array.from({ length: 12 }, (_, index) => `school-reservation-${index + 1}`)
);

export function getSchoolHomeReservations() {
  const storedReservations = readJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, []);
  const additions = Array.isArray(storedReservations) ? storedReservations : [];
  const filteredAdditions = additions.filter((reservation) => !LEGACY_SCHOOL_DUMMY_RESERVATION_IDS.has(reservation?.id));

  if (filteredAdditions.length !== additions.length) {
    writeJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, filteredAdditions);
  }

  const reservationsById = new Map(SCHOOL_HOME_RESERVATIONS.map((reservation) => [reservation.id, reservation]));
  filteredAdditions.forEach((reservation) => reservationsById.set(reservation.id, reservation));
  return Array.from(reservationsById.values()).map((reservation) => ({ ...reservation }));
}

export function saveSchoolHomeReservation(reservation) {
  const storedReservations = readJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, []);
  const additions = Array.isArray(storedReservations) ? storedReservations : [];
  const createdAt = reservation?.createdAt || reservation?.reservedAt || new Date().toISOString();
  const nextReservation = { status: "예약", ...reservation, createdAt, reservedAt: reservation?.reservedAt || createdAt };
  writeJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, [
    ...additions.filter((item) => item.id !== nextReservation.id),
    nextReservation,
  ]);
  return { ...nextReservation };
}

export function removeSchoolHomeReservation(reservationId) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation) return null;
  writeJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY,
    getSchoolHomeReservations().filter((item) => item.id !== reservationId));
  return reservation;
}

export function updateSchoolHomeReservationStatus(reservationId, status = "취소") {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation) return null;

  const storedReservations = readJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, []);
  const additions = Array.isArray(storedReservations) ? storedReservations : [];
  const nextReservation = {
    ...reservation,
    status,
    cancelledAt: status === "취소" ? reservation.cancelledAt || new Date().toISOString() : "",
  };
  writeJsonStorage(SCHOOL_HOME_RESERVATIONS_STORAGE_KEY, [
    ...additions.filter((item) => item.id !== reservationId),
    nextReservation,
  ]);
  return { ...nextReservation };
}

export function updateSchoolHomeReservationTicketHistory(reservationId, ticketHistory) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation || !ticketHistory?.id) return null;

  return saveSchoolHomeReservation({
    ...reservation,
    isOverbooked: false,
    ticketHistoryId: ticketHistory.id,
    ticketId: ticketHistory.ticketId || ticketHistory.id,
    ticketName: ticketHistory.ticketName || reservation.ticketName || "",
  });
}

export function clearSchoolHomeReservationTicketHistory(reservationId) {
  const reservation = getSchoolHomeReservations().find((item) => item.id === reservationId);
  if (!reservation) return null;

  return saveSchoolHomeReservation({
    ...reservation,
    isOverbooked: true,
    ticketHistoryId: "",
    ticketId: "",
    ticketName: "",
  });
}

export function getSchoolHomeReservationMembers() {
  return SCHOOL_HOME_MEMBER_FIXTURES.map((member) => ({
    ...member,
    pets: member.pets.map((pet) => ({
      ...pet,
      remainingCountByType: { ...pet.remainingCountByType },
      totalReservedCountByType: { ...pet.totalReservedCountByType },
      ticketHistories: pet.ticketHistories.map((ticket) => ({ ...ticket })),
      ...(pet.totalReservableCountByType
        ? { totalReservableCountByType: { ...pet.totalReservableCountByType } }
        : {}),
    })),
  }));
}

export function getSchoolHomeCapacityClosedDates() {
  return [...SCHOOL_HOME_CAPACITY_CLOSED_DATES];
}

const SCHOOL_HOME_RESERVATIONS = [];

const SCHOOL_HOME_CAPACITY_CLOSED_DATES = [];

const SCHOOL_HOME_MEMBER_FIXTURES = [
  createSchoolMemberFixture({
    memberId: "member-kim-minji",
    guardianName: "김민지",
    phoneNumber: "010-2345-1001",
    address: "서울시 마포구 월드컵북로 12",
    addressDetail: "302호",
    petId: "pet-byeoli",
    petName: "별이",
    breed: "캐벌리어 킹 찰스 스패니얼",
    birthDate: "2021-03-12",
    animalRegistrationNumber: "410000000001001",
    coatColor: "브라운 화이트",
    weight: "6.2",
    gender: "여아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-lee-seojun",
    guardianName: "이서준",
    phoneNumber: "010-2345-1002",
    address: "서울시 용산구 이태원로 18",
    addressDetail: "101동 1204호",
    petId: "pet-coco",
    petName: "코코",
    breed: "토이 푸들",
    birthDate: "2020-11-02",
    animalRegistrationNumber: "410000000001002",
    coatColor: "크림",
    weight: "4.1",
    gender: "남아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-park-hana",
    guardianName: "박하나",
    phoneNumber: "010-2345-1003",
    address: "서울시 성동구 왕십리로 66",
    addressDetail: "8층",
    petId: "pet-cherry",
    petName: "체리",
    breed: "말티푸",
    birthDate: "2022-05-20",
    animalRegistrationNumber: "410000000001003",
    coatColor: "화이트",
    weight: "3.8",
    gender: "여아",
    neuteredStatus: "미완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-choi-yuna",
    guardianName: "최유나",
    phoneNumber: "010-2345-1004",
    address: "서울시 강남구 논현로 33",
    addressDetail: "B동 504호",
    petId: "pet-yuli",
    petName: "율이",
    breed: "이탈리안 그레이하운드",
    birthDate: "2019-09-14",
    animalRegistrationNumber: "410000000001004",
    coatColor: "그레이",
    weight: "5.0",
    gender: "남아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-jung-doyoon",
    guardianName: "정도윤",
    phoneNumber: "010-2345-1005",
    address: "서울시 서초구 반포대로 25",
    addressDetail: "2층",
    petId: "pet-kongi",
    petName: "콩이",
    breed: "말티즈",
    birthDate: "2014-01-08",
    animalRegistrationNumber: "410000000001005",
    coatColor: "화이트",
    weight: "3.2",
    gender: "남아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-han-jisoo",
    guardianName: "한지수",
    phoneNumber: "010-2345-1006",
    address: "서울시 송파구 올림픽로 120",
    addressDetail: "1501호",
    petId: "pet-choco",
    petName: "초코",
    breed: "토이 푸들",
    birthDate: "2021-07-17",
    animalRegistrationNumber: "410000000001006",
    coatColor: "초코",
    weight: "4.6",
    gender: "남아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-oh-seoyeon",
    guardianName: "오서연",
    phoneNumber: "010-2345-1007",
    address: "서울시 은평구 통일로 77",
    addressDetail: "403호",
    petId: "pet-dubu",
    petName: "두부",
    breed: "포메라니안",
    birthDate: "2023-02-11",
    animalRegistrationNumber: "410000000001007",
    coatColor: "오렌지",
    weight: "2.9",
    gender: "여아",
    neuteredStatus: "미완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-seo-minho",
    guardianName: "서민호",
    phoneNumber: "010-2345-1008",
    address: "서울시 중구 다산로 90",
    addressDetail: "1층",
    petId: "pet-maru",
    petName: "마루",
    breed: "믹스견",
    birthDate: "2018-12-24",
    animalRegistrationNumber: "410000000001008",
    coatColor: "블랙 브라운",
    weight: "9.4",
    gender: "남아",
    neuteredStatus: "완료",
  }),
  createSchoolMemberFixture({
    memberId: "member-nam-sora",
    guardianName: "남소라",
    phoneNumber: "010-2345-1009",
    address: "서울시 광진구 아차산로 40",
    addressDetail: "702호",
    petId: "pet-momo",
    petName: "모모",
    breed: "비숑 프리제",
    birthDate: "2020-04-03",
    animalRegistrationNumber: "410000000001009",
    coatColor: "화이트",
    weight: "5.8",
    gender: "여아",
    neuteredStatus: "완료",
  }),
];

function createSchoolMemberFixture({ memberId, guardianName, phoneNumber, address, addressDetail, petId, petName, ...petDetails }) {
  const pet = {
    id: petId,
    petName,
    dogName: petName,
    ...petDetails,
    memo: "",
    remainingCountByType: { school: 0, daycare: 0, oneway: 0, roundtrip: 0 },
    totalReservedCountByType: { school: 0, daycare: 0, oneway: 0, roundtrip: 0 },
    ticketHistories: [],
    petTags: [],
  };

  return {
    id: memberId,
    guardianName,
    phoneNumber,
    address,
    addressDetail,
    isRegistered: true,
    ownerTags: [],
    pets: [pet],
  };
}
