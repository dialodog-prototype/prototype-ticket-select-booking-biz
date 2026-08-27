import { readJsonStorage, writeJsonStorage } from "../storage/storage-utils.js";

export const TICKET_LIST_STORAGE_KEY = "ticketList";

// 정책 필드는 목업 데이터로만 보관하며, 비즈 프로토타입의 예약 가능 여부를 제한하지 않는다.
export const TICKET_LIST = [
  {
    id: "1771987105132",
    name: "ㄷㅈㄹ",
    type: "school",
    pickdropType: null,
    quantity: 12,
    validity: 4,
    unit: "주",
    price: 360000,
    startDatePolicy: "first-attendance",
    reservationDateRule: "expiry",
    unlimitedValidity: false,
    weekdays: null,
    classIds: null,
  },
  {
    id: "ticket-school-event-1-7-days",
    name: "이벤트 이용권 (1회, 7일)",
    type: "school",
    pickdropType: null,
    quantity: 1,
    validity: 7,
    unit: "일",
    price: 0,
    startDatePolicy: "issued-date",
    reservationDateRule: "expiry",
    unlimitedValidity: false,
    weekdays: null,
    classIds: null,
  },
  {
    id: "ticket-school-5-small",
    name: "유치원 5회 이용권 (소형)",
    type: "school",
    pickdropType: null,
    quantity: 5,
    validity: 4,
    unit: "주",
    price: 150000,
    startDatePolicy: "first-attendance",
    reservationDateRule: "expiry",
    unlimitedValidity: false,
    weekdays: null,
    classIds: null,
  },
  {
    id: "ticket-school-10-small",
    name: "유치원 10회 이용권 (소형)",
    type: "school",
    pickdropType: null,
    quantity: 10,
    validity: 8,
    unit: "주",
    price: 300000,
    startDatePolicy: "first-reservation",
    reservationDateRule: "expiry",
    unlimitedValidity: false,
    weekdays: null,
    classIds: null,
  },
  {
    id: "ticket-school-5-large",
    name: "유치원 5회 이용권 (대형)",
    type: "school",
    pickdropType: null,
    quantity: 5,
    validity: 4,
    unit: "주",
    price: 180000,
    startDatePolicy: "issued-date",
    reservationDateRule: "no-limit",
    unlimitedValidity: false,
    weekdays: null,
    classIds: null,
  },
  {
    id: "ticket-school-unlimited",
    name: "유치원 무제한 이용권",
    type: "school",
    pickdropType: null,
    quantity: 30,
    validity: 0,
    unit: "주",
    price: 420000,
    startDatePolicy: "first-attendance",
    reservationDateRule: "no-limit",
    unlimitedValidity: true,
    weekdays: null,
    classIds: null,
  },
];

export function getTicketList(type = "school") {
  return getAllTicketList()
    .filter((ticket) => ticket.type === type)
    .map((ticket) => ({ ...ticket }));
}

export function getTicketById(ticketId) {
  const normalizedTicketId = String(ticketId || "").trim();
  if (!normalizedTicketId) {
    return null;
  }

  return getAllTicketList().find((ticket) => ticket.id === normalizedTicketId) || null;
}

export function ensureTicketList() {
  return getAllTicketList().map((ticket) => ({ ...ticket }));
}

function getAllTicketList() {
  const storedTicketList = readJsonStorage(TICKET_LIST_STORAGE_KEY, null);
  if (!Array.isArray(storedTicketList)) {
    writeJsonStorage(TICKET_LIST_STORAGE_KEY, TICKET_LIST);
    return TICKET_LIST;
  }

  const storedIds = new Set(storedTicketList.map((ticket) => ticket?.id));
  const mergedTicketList = [
    ...storedTicketList,
    ...TICKET_LIST.filter((ticket) => !storedIds.has(ticket.id)),
  ];
  if (mergedTicketList.length !== storedTicketList.length) {
    writeJsonStorage(TICKET_LIST_STORAGE_KEY, mergedTicketList);
  }
  return mergedTicketList;
}
