import { createElement } from "../utils/dom.js";
import { formatMemberWeight } from "../utils/member-date.js";

const DEFAULT_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";

export function createReservationInfo(reservation, member, pet) {
  const section = createElement("section", { className: "school-reservation-detail-section" });
  section.append(createElement("h2", { textContent: "예약 정보" }));
  const info = createElement("div", { className: "school-reservation-detail-pet" });
  info.append(createElement("img", { className: "school-reservation-detail-pet-image", src: pet?.profileImage || DEFAULT_PROFILE_IMAGE, alt: "" }));
  const text = createElement("div", { className: "school-reservation-detail-pet-text" });
  const petName = pet?.petName || pet?.dogName || reservation?.petName || "-";
  const breed = pet?.breed || reservation?.breed || "-";
  const weight = formatMemberWeight(pet?.weight || reservation?.weight);
  text.append(createElement("strong", { textContent: petName }));
  text.append(createElement("p", { textContent: `${breed} / ${weight === "-" ? "-" : weight}` }));
  text.append(createElement("p", { className: "school-reservation-detail-guardian", textContent: `${member?.guardianName || reservation?.guardianName || "-"} 보호자 (${member?.phoneNumber || reservation?.phoneNumber || "-"})` }));
  info.append(text);
  section.append(info);
  return section;
}

export function formatReservationDate(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}
