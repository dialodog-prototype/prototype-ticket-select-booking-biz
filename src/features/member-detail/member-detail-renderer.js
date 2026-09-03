import { ACTION_BUTTON_STATE } from "../../shared/constants/ui-state.js";
import { createHeaderIconButton } from "../../shared/components/header-icon-button.js";
import { createConfirmAlert } from "../../shared/components/alert.js";
import { renderMemberTagChips } from "../../shared/components/member-tag-chips.js";
import { initTagInput } from "../../shared/components/member-tag-input.js";
import { createBusinessNavigation } from "../../shared/components/navigation.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { sanitizeTagList } from "../../shared/services/member-tag-service.js";
import {
  deleteStoredMember,
  issueTicketToMemberPet,
  mergeMemberTagCatalog,
  saveRegisteredMembers,
  saveStoredMembers,
  updateTicketHistory,
} from "../../shared/storage/member-storage.js";
import { writeJsonStorage } from "../../shared/storage/storage-utils.js";
import {
  getSchoolHomeReservations,
  updateSchoolHomeReservationTicketHistory,
} from "../../shared/storage/school-home-storage.js";
import { getTicketList } from "../../shared/data/ticket-list.js";
import { getActiveTicketReservableCount, getLatestUsedTicketId, getOverbookedReservationCount, getTicketExpiryDate, getTicketStartDate, getTicketStatus, getTicketUsageHistory, getTicketUsageItem } from "../../shared/services/ticket-status-service.js";
import { cancelTicketIssue } from "../../shared/services/ticket-cancellation-service.js";
import { createElement } from "../../shared/utils/dom.js";
import { formatText } from "../../shared/utils/format.js";
import { formatMemberBirthDate, formatMemberGender, formatMemberWeight, getAgeOutputText, normalizeBirthDateParts } from "../../shared/utils/member-date.js";
import { formatPhoneNumber } from "../../shared/utils/phone.js";
import { createOwnerDetailDraft, createPetDetailDraft } from "./member-detail-draft.js";
import { TICKET_CANCEL_FUTURE_RESERVATIONS_STORAGE_KEY } from "./member-detail-state.js";

const DEFAULT_DOG_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";
const CAMERA_ICON_PATH = "../assets/iconCamera.svg";
const CLOSE_ICON_PATH = "../assets/iconClose.svg";
const ERROR_ICON_PATH = "../assets/errorTxtIcon.svg";
let toastDismissTimer = null;

export function renderMemberDetail(rootElement, memberDetailState) {
  rootElement.innerHTML = "";
  rootElement.append(createMemberDetailScreen(memberDetailState));

  scheduleToastDismiss(memberDetailState);
}

function rerender(memberDetailState) {
  renderMemberDetail(document.querySelector("#app"), memberDetailState);
}

function scheduleToastDismiss(memberDetailState) {
  window.clearTimeout(toastDismissTimer);

  if (!memberDetailState.toastMessage) {
    return;
  }

  toastDismissTimer = window.setTimeout(() => {
    memberDetailState.toastMessage = "";
    rerender(memberDetailState);
  }, TOAST_AUTO_DISMISS_MS);
}

function createMemberDetailScreen(memberDetailState) {
  const screen = createElement("div", {
    className: "member-detail-screen",
    dataset: { screen: "memberDetail" },
  });
  screen.append(createWebMemberDetailScreen(memberDetailState));
  screen.append(createAppMemberDetailScreen(memberDetailState));

  if (memberDetailState.toastMessage) {
    screen.append(createToast(memberDetailState.toastMessage));
  }
  return screen;
}

function createWebMemberDetailScreen(memberDetailState) {
  const screen = createElement("section", {
    className: "member-home-shell member-detail-shell",
    dataset: { area: "memberDetailDesktop" },
  });
  screen.append(createHeader());
  screen.append(createNavigation());
  screen.append(createWebMemberDetailContent(memberDetailState));
  return screen;
}

function createHeader() {
  const header = createElement("header", {
    className: "header",
    dataset: { area: "header" },
  });

  header.append(createElement("strong", { className: "brand-name", textContent: "다이얼독 비즈" }));
  header.append(createElement("h1", { textContent: "회원" }));
  header.append(createHeaderUtility());

  return header;
}

function createHeaderUtility() {
  const utility = createElement("span", { className: "header-utility" });
  const settingsButton = createElement("button", {
    className: "header-utility-button",
    type: "button",
    textContent: "설정",
    dataset: { action: "openSettings" },
  });
  settingsButton.addEventListener("click", () => {
    return;
  });
  utility.append(settingsButton);
  utility.append(createElement("span", { textContent: "알림" }));
  utility.append(createElement("span", { textContent: "계정" }));
  return utility;
}

function createNavigation() {
  const sharedNavigation = createBusinessNavigation({
    className: "business-navigation member-navigation",
    dataset: { area: "navigation" },
    profile: {
      imageSrc: DEFAULT_DOG_PROFILE_IMAGE,
      title: "다이얼독",
      subtitle: "애견유치원",
    },
    footerText: "개인정보 처리방침  이용약관  문의",
    items: ["대시보드", "유치원", "호텔링", "알림장", "회원", "이용권"].map((label) => ({
      label,
      selected: label === "회원",
      href: label === "대시보드" || label === "유치원"
        ? "./index.html"
        : label === "회원"
            ? "./member-home.html"
            : ""
    }))
  });

  return sharedNavigation;
}
function createWebMemberDetailContent(memberDetailState) {
  const member = getSelectedMemberView(memberDetailState);
  const content = createElement("section", {
    className: "content member-detail-content",
    dataset: { area: "content", feature: "memberDetail", screen: "memberDetail" },
  });
  const titleBar = createElement("div", {
    className: "member-detail-title-bar",
    dataset: { area: "detailTitle" },
  });
  titleBar.append(createBackNavigationButton());
  titleBar.append(createElement("h1", { textContent: "회원 상세" }));

  const summaryCard = createElement("section", {
    className: "card member-detail-summary-card",
    dataset: { area: "memberSummary" },
  });
  const profile = createElement("div", { className: "member-detail-profile" });
  profile.append(createMemberProfileImage("member-detail-avatar"));
  const profileText = createElement("div", { className: "member-detail-profile-text" });
  profileText.append(createElement("strong", { textContent: getMemberPetName(member) }));
  profileText.append(createElement("p", { textContent: formatText(member.breed) }));
  profile.append(profileText);
  summaryCard.append(profile);
  summaryCard.append(createReservationHighlightCard(memberDetailState, member));

  const panel = createElement("section", {
    className: "member-detail-panel",
    dataset: { area: "detailPanel", state: "memberInfo" },
  });
  if (memberDetailState.activeMemberDetailTab === "ticketHistory") {
    panel.dataset.state = "ticketHistory";
    panel.append(createWebTicketHistorySection(memberDetailState, member));
  } else {
    panel.append(createWebMemoSection(memberDetailState, member));
    panel.append(createWebGuardianInfoSection(memberDetailState, member));
    panel.append(createWebPetDetailSection(memberDetailState, member));
    panel.append(createWebSiblingPetsSection(memberDetailState, member));
  }

  const detailPanelGroup = createElement("div", {
    className: "member-detail-tab-panel-group",
    dataset: { area: "detailPanelGroup" },
  });
  detailPanelGroup.append(createWebMemberDetailTabs(memberDetailState));
  detailPanelGroup.append(panel);

  content.append(titleBar);
  content.append(summaryCard);
  content.append(detailPanelGroup);

  if (memberDetailState.isPetDetailModalOpen) {
    content.append(createPetDetailModal(memberDetailState));
  }

  if (memberDetailState.isOwnerDetailModalOpen) {
    content.append(createOwnerDetailModal(memberDetailState));
  }

  if (memberDetailState.isTicketDetailModalOpen) {
    content.append(createTicketDetailModal(memberDetailState));
  }

  if (memberDetailState.isTicketCancelAlertOpen) {
    content.append(createTicketCancelAlert(memberDetailState));
  }

  return content;
}

function createWebMemberDetailTabs(memberDetailState) {
  const tabs = createElement("div", {
    className: "member-detail-tabs",
    dataset: { area: "memberDetailTabs" },
  });
  tabs.setAttribute("role", "tablist");

  const memberInfoTab = createElement("button", {
    className: `member-detail-tab${memberDetailState.activeMemberDetailTab === "memberInfo" ? " is-selected" : ""}`,
    type: "button",
    textContent: "회원 정보",
    dataset: { action: "selectMemberDetailTab", target: "memberInfo", state: memberDetailState.activeMemberDetailTab === "memberInfo" ? "selected" : "idle" },
  });
  memberInfoTab.setAttribute("role", "tab");
  memberInfoTab.setAttribute("aria-selected", String(memberDetailState.activeMemberDetailTab === "memberInfo"));
  memberInfoTab.addEventListener("click", () => { memberDetailState.activeMemberDetailTab = "memberInfo"; rerender(memberDetailState); });
  tabs.append(memberInfoTab);

  const ticketTab = createElement("button", {
    className: `member-detail-tab${memberDetailState.activeMemberDetailTab === "ticketHistory" ? " is-selected" : ""}`,
    type: "button",
    textContent: "이용권 내역",
    dataset: { action: "selectMemberDetailTab", target: "ticketHistory", state: memberDetailState.activeMemberDetailTab === "ticketHistory" ? "selected" : "idle" },
  });
  ticketTab.setAttribute("role", "tab");
  ticketTab.setAttribute("aria-selected", String(memberDetailState.activeMemberDetailTab === "ticketHistory"));
  ticketTab.addEventListener("click", () => { memberDetailState.activeMemberDetailTab = "ticketHistory"; rerender(memberDetailState); });
  tabs.append(ticketTab);

  return tabs;
}

function createAppMemberDetailScreen(memberDetailState) {
  if (memberDetailState.isAppTicketDetailOpen) {
    return createAppTicketDetailScreen(memberDetailState);
  }

  const member = getSelectedMemberView(memberDetailState);
  const screen = createElement("section", {
    className: "member-detail-app-screen",
    dataset: { area: "memberDetailMobile" },
  });

  screen.append(createAppMemberDetailHeader(memberDetailState));

  const content = createElement("section", {
    className: "member-detail-app-content",
    dataset: { area: "detailContent" },
  });
  content.append(createAppMemberProfileSection(member));
  content.append(createAppAccordionSection(memberDetailState, "detailInfo", "상세 정보", createAppDetailInfoBody(member)));
  content.append(createAppAccordionSection(memberDetailState, "memo", "메모", createAppMemoBody(memberDetailState, member)));
  content.append(createAppTicketSection(memberDetailState, member));

  screen.append(content);

  if (memberDetailState.isPetDetailBottomSheetOpen) {
    screen.append(createPetDetailBottomSheet(memberDetailState));
  }

  if (memberDetailState.isTicketIssueBottomSheetOpen) {
    screen.append(createTicketIssueBottomSheet(memberDetailState, member));
  }

  return screen;
}

function createAppMemberDetailHeader(memberDetailState) {
  const header = createElement("header", {
    className: "member-detail-app-header",
    dataset: { area: "header" },
  });
  header.append(createBackNavigationButton());
  header.append(createElement("h1", { textContent: "회원 상세" }));

  const editButton = createElement("button", {
    className: "member-detail-edit-button",
    type: "button",
    textContent: "수정",
    dataset: { action: "openMemberEdit" },
  });
  editButton.addEventListener("click", () => {
    window.location.href = createMemberEditUrl(memberDetailState);
  });
  header.append(editButton);

  return header;
}

function createBackNavigationButton() {
  const button = createHeaderIconButton({
    className: "button button--icon",
    icon: "back",
    ariaLabel: "회원 목록으로 돌아가기",
    dataset: { action: "backToMemberHome" },
  });
  button.addEventListener("click", () => {
    window.location.href = "./member-home.html";
  });
  return button;
}

function createMemberEditUrl(memberDetailState) {
  const queryParams = new URLSearchParams();

  if (memberDetailState.selectedMember?.id) {
    queryParams.set("memberId", memberDetailState.selectedMember.id);
  }

  if (memberDetailState.selectedPet?.id) {
    queryParams.set("petId", memberDetailState.selectedPet.id);
  }

  return `./member-edit.html?${queryParams.toString()}`;
}

function createReservationHighlightCard(memberDetailState, member) {
  const availability = getReservationAvailability(member, memberDetailState.reservations);
  const isOverbooked = availability.state === "error";
  const card = createElement("aside", {
    className: "member-detail-reservation-card",
    dataset: { area: "reservationSummary", state: availability.state },
  });
  card.append(createElement("span", { textContent: isOverbooked ? "초과 예약" : "예약 가능" }));
  card.append(createElement("strong", { textContent: isOverbooked ? `${availability.excessCount}회` : availability.text }));
  return card;
}

function createWebMemoSection(memberDetailState, member) {
  const section = createElement("section", {
    className: "card member-detail-card member-detail-memo-section",
    dataset: { area: "memberMemo" },
  });
  section.append(createElement("h2", { textContent: "메모" }));
  const memoField = createElement("textarea", {
    className: "member-detail-memo-box",
    value: String(member.memo || "").trim(),
  });
  memoField.placeholder = "성격, 알러지 등 필요한 내용을 입력해 주세요. (최대 500자)";
  memoField.dataset.state = String(member.memo || "").trim() ? "filled" : "empty";
  memoField.addEventListener("input", (event) => {
    member.memo = event.target.value;
    memberDetailState.petDetailDraft.memo = event.target.value;
    memoField.dataset.state = event.target.value.trim() ? "filled" : "empty";
  });
  section.append(memoField);
  return section;
}

function createWebGuardianInfoSection(memberDetailState, member) {
  const section = createDetailInfoCard("보호자 정보", {
    area: "guardianInfo",
    actionText: "수정",
    actionName: "openOwnerDetail",
  });
  section.append(createInfoList([
    ["보호자", formatText(member.guardianName)],
    ["연락처", formatText(formatPhoneNumber(member.phoneNumber))],
    ["주소", formatText(formatGuardianAddress(member))],
  ]));
  const actionButton = section.querySelector('[data-action="openOwnerDetail"]');
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      memberDetailState.ownerDetailDraft = createOwnerDetailDraft(memberDetailState.selectedMember);
      memberDetailState.isOwnerDetailModalOpen = true;
      rerender(memberDetailState);
    });
  }
  return section;
}

function createWebPetDetailSection(memberDetailState, member) {
  const section = createDetailInfoCard("반려견 세부 정보", { area: "petDetailInfo", actionText: "수정", actionName: "openPetDetail" });
  section.append(createInfoList([
    ["생년월일", formatMemberBirthDate(member.birthDate)],
    ["동물등록번호", formatText(member.animalRegistrationNumber)],
    ["모색", formatText(member.coatColor)],
    ["몸무게", formatMemberWeight(member.weight)],
    ["성별", formatMemberGender(member.gender, member.neuteredStatus)],
  ]));
  const actionButton = section.querySelector('[data-action="openPetDetail"]');
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      memberDetailState.petDetailDraft = createPetDetailDraft(memberDetailState.selectedPet);
      memberDetailState.isPetDetailModalOpen = true;
      rerender(memberDetailState);
    });
  }
  return section;
}

function createWebSiblingPetsSection(memberDetailState, member) {
  const section = createDetailInfoCard("형제 반려견", { area: "siblingPets", actionText: "추가 등록" });
  const siblings = getSiblingMembers(memberDetailState.members, member);

  if (siblings.length === 0) {
    section.append(createElement("p", {
      className: "member-detail-empty-inline",
      textContent: "등록된 형제 반려견이 없습니다.",
      dataset: { state: "empty" },
    }));
    return section;
  }

  const list = createElement("div", { className: "member-sibling-list", dataset: { state: "list" } });
  siblings.forEach((sibling) => {
    const item = createElement("article", {
      className: "member-sibling-item",
      dataset: { entity: "member", entityId: formatText(sibling.id) },
    });
    item.append(createMemberProfileImage("member-sibling-avatar"));
    const text = createElement("div", { className: "member-sibling-text" });
    text.append(createElement("strong", { textContent: getMemberPetName(sibling) }));
    text.append(createElement("span", { textContent: formatText(sibling.breed) }));
    item.append(text);
    item.append(createElement("span", { className: "member-sibling-arrow", textContent: "›" }));
    list.append(item);
  });
  section.append(list);
  return section;
}

function createAppMemberProfileSection(member) {
  const section = createElement("section", {
    className: "member-detail-app-profile",
    dataset: { area: "profileSummary" },
  });
  section.append(createMemberProfileImage("member-detail-app-avatar"));

  const text = createElement("div", { className: "member-detail-app-profile-text" });
  text.append(createElement("strong", { textContent: getMemberPetName(member) }));
  text.append(createElement("p", { textContent: formatText(member.breed) }));

  const guardian = createElement("p", { className: "member-detail-app-guardian-line" });
  guardian.append(createElement("span", { textContent: `${formatText(member.guardianName)} 보호자` }));
  guardian.append(createElement("span", { textContent: ` (${formatText(formatPhoneNumber(member.phoneNumber))})` }));
  text.append(guardian);

  section.append(text);
  return section;
}

function createAppAccordionSection(memberDetailState, sectionName, label, body) {
  const isOpen = sectionName === "detailInfo" ? memberDetailState.isDetailInfoExpanded : memberDetailState.isDetailMemoExpanded;
  const section = createElement("section", {
    className: sectionName === "memo" ? "card member-detail-app-accordion is-memo" : "card member-detail-app-accordion",
    dataset: { area: sectionName, state: isOpen ? "open" : "closed" },
  });
  const button = createElement("button", {
    className: "member-detail-app-accordion-button",
    type: "button",
    dataset: { action: "toggleDetailAccordion", target: sectionName },
  });
  button.append(createElement("span", { textContent: label }));
  button.append(createElement("span", { className: isOpen ? "member-detail-chevron is-open" : "member-detail-chevron", textContent: "⌄" }));
  button.addEventListener("click", () => {
    if (sectionName === "detailInfo") {
      memberDetailState.isDetailInfoExpanded = !memberDetailState.isDetailInfoExpanded;
    } else {
      memberDetailState.isDetailMemoExpanded = !memberDetailState.isDetailMemoExpanded;
    }
    rerender(memberDetailState);
  });
  section.append(button);

  if (isOpen) {
    section.append(body);
  }

  return section;
}

function createAppDetailInfoBody(member) {
  const body = createElement("div", { className: "member-detail-app-info-body" });
  body.append(createInfoList([
    ["기본 주소", formatText(member.address)],
    ["상세 주소", formatText(member.addressDetail)],
    ["생년월일", formatMemberBirthDate(member.birthDate)],
    ["동물등록번호", formatText(member.animalRegistrationNumber)],
    ["모색", formatText(member.coatColor)],
    ["몸무게", formatMemberWeight(member.weight)],
    ["성별", formatMemberGender(member.gender, member.neuteredStatus)],
  ], "member-detail-app-info-list"));
  return body;
}

function createAppMemoBody(memberDetailState, member) {
  const memoText = String(member.memo || "").trim();
  const body = createElement("div", {
    className: "member-detail-app-memo-body",
    dataset: { area: "memberMemoBody", state: memoText ? "filled" : "empty" },
  });
  body.append(createElement("div", { className: "member-detail-app-accordion-divider" }));
  body.append(createElement("p", {
    className: "member-detail-app-memo-copy",
    textContent: memoText || "작성된 메모가 없습니다.",
  }));

  const footer = createElement("div", {
    className: "member-detail-app-memo-actions",
    dataset: { area: "memberMemoActions" },
  });
  const editButton = createElement("button", {
    className: "member-detail-app-memo-edit-button",
    type: "button",
    textContent: "메모 수정",
    dataset: { action: "openMemberEdit", target: "memo" },
  });
  editButton.addEventListener("click", () => {
      memberDetailState.petDetailDraft = createPetDetailDraft(memberDetailState.selectedPet);
    memberDetailState.isPetDetailBottomSheetOpen = true;
    rerender(memberDetailState);
  });
  footer.append(editButton);
  body.append(footer);
  return body;
}

function createAppTicketSection(memberDetailState, member) {
  const section = createElement("section", {
    className: "member-detail-app-ticket-section",
    dataset: { area: "ticketSection" },
  });
  const title = createElement("div", { className: "member-detail-app-ticket-title" });
  title.append(createElement("strong", { textContent: "이용권" }));
  const availability = getReservationAvailability(member, memberDetailState.reservations);
  title.append(createElement("span", {
    className: availability.state === "error" ? "is-error" : "",
    textContent: `(${availability.state === "error" ? availability.text : `예약 가능 ${availability.text}`})`,
  }));
  section.append(title);
  section.append(createTicketIssuePrimaryButton(memberDetailState, member));

  const ticketHistories = getMemberTicketHistories(member);
  if (ticketHistories.length === 0) {
    section.append(createTicketHistoryPlaceholder("card member-detail-app-ticket-placeholder"));
    return section;
  }

  const list = createElement("div", {
    className: "member-detail-app-ticket-list",
    dataset: { state: "list" },
  });
  ticketHistories.forEach((ticketHistory) => {
    const card = createElement("article", {
      className: "card member-detail-app-ticket-card",
      dataset: { entity: "ticket", entityId: ticketHistory.id || ticketHistory.ticketName },
    });
    card.addEventListener("click", () => {
      window.location.href = createAppTicketUsageUrl(memberDetailState, ticketHistory);
    });
    const titleGroup = createElement("div", { className: "member-detail-app-ticket-card-title" });
    const ticketStatus = getTicketStatusForState(memberDetailState, ticketHistory);
    titleGroup.append(createElement("span", {
      className: `member-ticket-status status-${getTicketStatusTone(ticketStatus)}`,
      textContent: getTicketStatusLabel(ticketStatus),
    }));
    titleGroup.append(createElement("strong", { textContent: ticketHistory.ticketName }));
    card.append(titleGroup);

    const caption = createElement("p", {
      className: `member-detail-app-ticket-card-caption${getRawTicketReservableCount(ticketHistory) < 0 ? " is-error" : ""}`,
      textContent: `예약 가능: ${formatTicketReservableCount(ticketHistory)} | 유효기간: ${getAppTicketValidityCaption(memberDetailState, member, ticketHistory)}`,
    });
    card.append(caption);
    card.append(createElement("span", { className: "member-detail-app-ticket-card-arrow", textContent: "›" }));
    list.append(card);
  });
  section.append(list);

  return section;
}

export function createAppTicketDetailScreen(memberDetailState, options = {}) {
  const { onBack, onChange } = options;
  const member = getSelectedMemberView(memberDetailState);
  const ticket = memberDetailState.selectedTicketHistory || {};
  const screen = createElement("section", {
    className: "member-ticket-detail-screen",
    dataset: { area: "appTicketDetailScreen", state: "open" },
  });

  const header = createElement("header", { className: "member-ticket-detail-screen-header" });
  const backButton = createHeaderIconButton({
    className: "button button--icon",
    icon: "back",
    ariaLabel: "회원 상세로 돌아가기",
  });
  backButton.addEventListener("click", () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    memberDetailState.isAppTicketDetailOpen = false;
    memberDetailState.selectedTicketHistory = null;
    rerender(memberDetailState);
  });
  header.append(backButton, createElement("h1", { textContent: "이용권 사용 내역" }), createElement("span", { className: "member-ticket-detail-screen-spacer" }));
  screen.append(header);

  const body = createElement("main", { className: "member-ticket-detail-screen-body" });
  const infoSection = createElement("section", { className: "member-ticket-detail-info-section" });
  infoSection.append(createAppTicketDetailNotice(memberDetailState, ticket), createAppTicketSummary(ticket));
  body.append(infoSection);

  const tabs = createElement("div", { className: "member-ticket-detail-tabs", role: "tablist" });
  [["status", "이용권 상태"], ["usage", "사용 내역"]].forEach(([tabKey, label]) => {
    const tab = createElement("button", {
      className: `member-ticket-detail-tab${memberDetailState.appTicketDetailTab === tabKey ? " is-selected" : ""}`,
      type: "button",
      textContent: label,
    });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(memberDetailState.appTicketDetailTab === tabKey));
    tab.addEventListener("click", () => {
      memberDetailState.appTicketDetailTab = tabKey;
      if (typeof onChange === "function") {
        onChange();
        return;
      }
      rerender(memberDetailState);
    });
    tabs.append(tab);
  });
  body.append(tabs);

  const tabBody = createElement("section", { className: "member-ticket-detail-tab-body" });
  if (memberDetailState.appTicketDetailTab === "usage") {
    tabBody.append(createAppTicketUsagePanel(memberDetailState, member, ticket));
  } else {
    tabBody.append(createAppTicketStatusPanel(memberDetailState, ticket, onChange));
  }
  body.append(tabBody);
  screen.append(body);
  if (memberDetailState.isAppTicketStatusEditSheetOpen) {
    screen.append(createAppTicketStatusEditSheet(memberDetailState, onChange));
  }
  if (memberDetailState.isTicketCancelAlertOpen) {
    screen.append(createTicketCancelAlert(memberDetailState, onChange));
  }
  if (memberDetailState.isAppTicketStatusEditBlockedAlertOpen) {
    screen.append(createAppTicketStatusEditBlockedAlert(memberDetailState, onChange));
  }
  return screen;
}

function createAppTicketDetailNotice(memberDetailState, ticket) {
  const ticketStatus = getTicketStatusForState(memberDetailState, ticket);
  const notice = createElement("div", {
    className: `member-ticket-detail-notice ${getTicketDetailNoticeTone(ticketStatus, ticket)}`,
  });
  notice.append(createElement("img", { src: ERROR_ICON_PATH, alt: "" }));
  notice.append(createElement("span", { textContent: `[${getTicketStatusLabel(ticketStatus)}] ` }));
  notice.append(createElement("strong", { textContent: `예약 가능 ${formatTicketReservableCount(ticket)}` }));
  return notice;
}

function getTicketDetailNoticeTone(status, ticket) {
  const label = getTicketStatusLabel(status);
  if (label === "사용 전") return "is-ready";
  if (label === "이용 중" && getRawTicketReservableCount(ticket) >= 3) return "is-ready";
  return "is-error";
}

function createAppTicketSummary(ticket) {
  const summary = createElement("section", { className: "member-ticket-detail-summary" });
  summary.append(createElement("strong", { textContent: ticket.ticketName || "이용권" }));
  summary.append(createElement("p", {
    textContent: `${ticket.totalCount ?? 0}회 / ${getTicketValidityText(ticket)} / ${ticket.amount ? `${Number(ticket.amount).toLocaleString("ko-KR")}원` : "-"}`,
  }));
  return summary;
}

function createAppTicketUsagePanel(memberDetailState, member, ticket) {
  const panel = createElement("div", { className: "member-ticket-usage-panel" });
  panel.append(createElement("h3", { textContent: "사용 내역" }));
  const list = createElement("div", { className: "member-ticket-usage-card-list" });
  const usageHistory = getTicketUsageHistory(ticket, memberDetailState.reservations, {
    memberId: member?.memberId || memberDetailState.selectedMember?.id,
    petId: member?.petId || memberDetailState.selectedPet?.id,
    ticketHistories: member?.ticketHistories || [],
  }).map((reservation) => getTicketUsageItem(reservation));
  const items = usageHistory.length ? usageHistory : (ticket.usageHistory || []);

  if (!items.length) {
    panel.append(createTicketHistoryPlaceholder("member-ticket-usage-empty"));
    return panel;
  }

  items.forEach((item) => {
    const card = createElement("article", { className: `member-ticket-usage-card${item.status === "취소" ? " is-cancelled" : ""}` });
    card.append(createElement("strong", { textContent: item.service || "유치원" }));
    card.append(createElement("p", { textContent: formatTicketDateWithWeekday(item.visitDate || item.date) }));
    if (item.status === "취소") {
      card.append(createElement("span", { className: "member-ticket-usage-card-badge", textContent: "취소" }));
    }
    list.append(card);
  });
  panel.append(list);
  return panel;
}

function createAppTicketStatusPanel(memberDetailState, ticket, onChange) {
  const panel = createElement("div", { className: "member-ticket-status-panel" });
  const ticketDateFacts = getTicketDateFacts(memberDetailState, ticket);
  const ticketStatus = getTicketStatusLabel(getTicketStatusForState(memberDetailState, ticket));
  panel.append(createElement("h3", { textContent: "이용권 상태" }));
  const facts = createElement("dl", { className: "member-ticket-status-facts" });
  [
    ["지급일", ticketDateFacts.issuedAt],
    ["개시일", ticketDateFacts.startedAt],
    ["만료일", ticketDateFacts.expiresAt],
    ["예약 가능 날짜", `개시일 이후 ~ ${getReservationDateRuleLabel(ticket.reservationDateRule)}`],
  ].forEach(([label, value]) => {
    const valueElement = createElement("dd", { textContent: value });
    if (label === "개시일" && ticketDateFacts.startedAt !== "-") {
      valueElement.append(createElement("small", { textContent: `(${ticketDateFacts.startPolicyLabel})` }));
    }
    facts.append(createElement("dt", { textContent: label }), valueElement);
  });
  panel.append(facts);
  const editButton = createElement("button", { className: "member-ticket-status-edit-button", type: "button", textContent: "수정" });
  editButton.addEventListener("click", () => {
    if (hasOverbookedReservations(memberDetailState)) {
      memberDetailState.isAppTicketStatusEditBlockedAlertOpen = true;
      rerenderAppTicketDetail(memberDetailState, onChange);
      return;
    }
    memberDetailState.appTicketStatusDraft = createAppTicketStatusDraft(memberDetailState, ticket);
    memberDetailState.isAppTicketStatusEditSheetOpen = true;
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  panel.append(editButton);
  return panel;
}

function createAppTicketStatusEditBlockedAlert(memberDetailState, onChange) {
  return createConfirmAlert({
    className: "alert-dialog ticket-status-edit-blocked-alert",
    area: "ticketStatusEditBlockedAlert",
    modal: "ticketStatusEditBlockedAlert",
    title: "수정 실패",
    message: "초과 예약이 있는 경우\n이용권 변경이 불가능합니다.\n이용권 지급 후 다시 시도해 주세요.",
    confirmLabel: "확인",
    onConfirm: () => {
      memberDetailState.isAppTicketStatusEditBlockedAlertOpen = false;
      rerenderAppTicketDetail(memberDetailState, onChange);
    },
  });
}

function createAppTicketStatusEditSheet(memberDetailState, onChange) {
  const ticket = memberDetailState.selectedTicketHistory || {};
  const draft = memberDetailState.appTicketStatusDraft || createAppTicketStatusDraft(memberDetailState, ticket);
  const overlay = createElement("section", {
    className: "member-ticket-status-edit-sheet-overlay",
    dataset: { area: "ticketStatusEditSheet", modal: "ticketStatusEditSheet", state: "open" },
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeAppTicketStatusEditSheet(memberDetailState, onChange);
  });
  const sheet = createElement("section", { className: "member-ticket-status-edit-sheet" });
  const header = createElement("header", { className: "member-ticket-status-edit-sheet-header" });
  const closeButton = createHeaderIconButton({
    className: "button button--icon",
    icon: "close",
    ariaLabel: "이용권 상태 수정 닫기",
  });
  closeButton.addEventListener("click", () => closeAppTicketStatusEditSheet(memberDetailState, onChange));
  header.append(closeButton, createElement("h2", { textContent: "이용권 상태 수정" }), createElement("span", { className: "header-spacer" }));
  sheet.append(header);

  const body = createElement("div", { className: "member-ticket-status-edit-sheet-body" });
  const countField = createElement("section", { className: "member-ticket-status-edit-field" });
  countField.append(createElement("h3", { textContent: "예약 가능 횟수" }));
  const countControl = createElement("div", { className: "member-ticket-status-edit-count" });
  const minusButton = createElement("button", { className: "button", type: "button", textContent: "−", ariaLabel: "예약 가능 횟수 줄이기" });
  minusButton.disabled = draft.reservableCount <= 0;
  minusButton.addEventListener("click", () => {
    draft.reservableCount = Math.max(draft.reservableCount - 1, 0);
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  const countValue = createElement("output", { textContent: `${draft.reservableCount}회` });
  const plusButton = createElement("button", { className: "button", type: "button", textContent: "+", ariaLabel: "예약 가능 횟수 늘리기" });
  plusButton.addEventListener("click", () => {
    draft.reservableCount += 1;
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  countControl.append(minusButton, countValue, plusButton);
  countField.append(countControl);

  const expiryField = createElement("label", { className: "member-ticket-status-edit-field" });
  expiryField.append(createElement("span", { textContent: "만료일" }));
  const expiryInput = createElement("input", { type: "date", value: draft.expiresAt, dataset: { field: "ticketExpiryDate" } });
  expiryInput.addEventListener("change", () => {
    draft.expiresAt = expiryInput.value;
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  expiryField.append(expiryInput);
  body.append(countField, expiryField);
  sheet.append(body);

  const hasChanges = hasAppTicketStatusDraftChanges(memberDetailState, ticket, draft);
  const actions = createElement("footer", { className: "member-ticket-status-edit-sheet-actions" });
  if (canCancelTicketIssue(memberDetailState, ticket)) {
    const cancelButton = createElement("button", { className: "button button--danger", type: "button", textContent: "지급 취소" });
    cancelButton.addEventListener("click", () => {
      memberDetailState.isTicketCancelAlertOpen = true;
      rerenderAppTicketDetail(memberDetailState, onChange);
    });
    actions.append(cancelButton);
  }
  const submitButton = createElement("button", { className: "button button--primary", type: "button", textContent: "수정" });
  submitButton.disabled = !hasChanges;
  submitButton.addEventListener("click", () => {
    if (!hasChanges) return;
    submitAppTicketStatusDraft(memberDetailState, draft, onChange);
  });
  actions.append(submitButton);
  sheet.append(actions);
  overlay.append(sheet);
  return overlay;
}

function createAppTicketStatusDraft(memberDetailState, ticket) {
  const expiresAt = ticket.expiresAt || getDateInputValue(getTicketExpiryDate(ticket, memberDetailState.reservations, {
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
    ticketHistories: memberDetailState.selectedPet?.ticketHistories || [],
  }));
  return {
    ticketHistoryId: ticket.id,
    reservableCount: getTicketReservableCount(ticket),
    expiresAt,
  };
}

function hasAppTicketStatusDraftChanges(memberDetailState, ticket, draft) {
  const initialDraft = createAppTicketStatusDraft(memberDetailState, ticket);
  return draft.reservableCount !== initialDraft.reservableCount || draft.expiresAt !== initialDraft.expiresAt;
}

function submitAppTicketStatusDraft(memberDetailState, draft, onChange) {
  const result = updateTicketHistory({
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
    ticketHistoryId: draft.ticketHistoryId,
    reservableCount: draft.reservableCount,
    expiresAt: draft.expiresAt,
  });
  memberDetailState.members = result.members;
  memberDetailState.selectedMember = result.members.find((member) => member.id === memberDetailState.selectedMember?.id) || memberDetailState.selectedMember;
  memberDetailState.selectedPet = memberDetailState.selectedMember?.pets?.find((pet) => pet.id === memberDetailState.selectedPet?.id) || memberDetailState.selectedPet;
  memberDetailState.selectedTicketHistory = memberDetailState.selectedPet?.ticketHistories?.find((ticket) => ticket.id === draft.ticketHistoryId) || null;
  memberDetailState.isAppTicketStatusEditSheetOpen = false;
  memberDetailState.appTicketStatusDraft = null;
  memberDetailState.toastMessage = "이용권 상태를 수정했습니다.";
  rerenderAppTicketDetail(memberDetailState, onChange);
}

function closeAppTicketStatusEditSheet(memberDetailState, onChange) {
  memberDetailState.isAppTicketStatusEditSheetOpen = false;
  memberDetailState.appTicketStatusDraft = null;
  rerenderAppTicketDetail(memberDetailState, onChange);
}

function rerenderAppTicketDetail(memberDetailState, onChange) {
  if (typeof onChange === "function") {
    onChange();
    return;
  }
  rerender(memberDetailState);
}

function getDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createAppTicketUsageUrl(memberDetailState, ticket) {
  const params = new URLSearchParams({
    memberId: memberDetailState.selectedMember?.id || "",
    petId: memberDetailState.selectedPet?.id || "",
    ticketHistoryId: ticket.id || ticket.ticketId || ticket.ticketName || "",
  });
  return `./member-ticket-usage.html?${params.toString()}`;
}

function formatTicketDateWithWeekday(dateText) {
  if (!dateText) return "-";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return String(dateText);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
}

function createTicketIssuePrimaryButton(memberDetailState, member) {
  const button = createElement("button", {
    className: "button button--primary member-ticket-issue-button",
    type: "button",
    textContent: "이용권 지급",
    dataset: { action: "issueTicket", entityId: formatText(member.id) },
  });
  button.addEventListener("click", () => {
    const tickets = getTicketList("school");
    const latestUsedTicketId = getLatestUsedTicketId(memberDetailState.reservations, {
      memberId: member.memberId,
      petId: member.petId,
      ticketHistories: member.ticketHistories,
    });
    const latestUsedTicket = tickets.find((ticket) => ticket.id === latestUsedTicketId);
    const overbookedReservationCount = getOverbookedReservationCount(memberDetailState.reservations, {
      memberId: member.memberId,
      petId: member.petId,
    });
    memberDetailState.ticketIssueSelectedId = latestUsedTicketId;
    memberDetailState.ticketIssueQuantity = latestUsedTicket
      ? Math.max(Math.ceil(overbookedReservationCount / Math.max(Number(latestUsedTicket.quantity) || 0, 1)), 1)
      : 1;
    memberDetailState.isTicketIssueBottomSheetOpen = true;
    rerender(memberDetailState);
  });
  return button;
}

function createTicketIssueBottomSheet(memberDetailState, member) {
  const tickets = getTicketList("school");
  const selectedTicket = tickets.find((ticket) => ticket.id === memberDetailState.ticketIssueSelectedId);
  const overlay = createElement("section", { className: "member-ticket-issue-sheet-overlay", dataset: { area: "ticketIssueBottomSheet", state: "open" } });
  const closeSheet = () => {
    memberDetailState.isTicketIssueBottomSheetOpen = false;
    memberDetailState.ticketIssueSelectedId = "";
    memberDetailState.ticketIssueQuantity = 1;
    rerender(memberDetailState);
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeSheet(); });

  const sheet = createElement("div", { className: "member-ticket-issue-sheet" });
  const header = createElement("header", { className: "member-ticket-issue-sheet-header" });
  const close = createElement("button", { className: "button button--icon", type: "button", ariaLabel: "이용권 지급 닫기" });
  close.append(createElement("img", { src: CLOSE_ICON_PATH, alt: "" }));
  close.addEventListener("click", closeSheet);
  header.append(close, createElement("h2", { textContent: "이용권 지급" }));
  sheet.append(header);

  const list = createElement("div", { className: "member-ticket-issue-sheet-list" });
  tickets.forEach((ticket) => {
    const isSelected = ticket.id === selectedTicket?.id;
    const row = createElement("article", { className: `member-ticket-issue-sheet-ticket${isSelected ? " is-selected" : ""}` });
    const radio = createElement("input", { type: "radio" });
    radio.name = "ticketIssue";
    radio.checked = isSelected;
    const selectTicket = () => {
      memberDetailState.ticketIssueSelectedId = ticket.id;
      const ticketQuantity = Math.max(Number(ticket.quantity) || 0, 1);
      memberDetailState.ticketIssueQuantity = Math.max(Math.ceil(overbookedReservationCount / ticketQuantity), 1);
      rerender(memberDetailState);
    };
    radio.addEventListener("change", selectTicket);
    row.addEventListener("click", (event) => {
      if (event.target.closest("input, button")) return;
      selectTicket();
    });
    const content = createElement("div", { className: "member-ticket-issue-sheet-ticket-content" });
    content.append(
      createElement("strong", { textContent: ticket.name }),
      createElement("p", { textContent: formatTicketIssueSummary(ticket) }),
    );
    row.append(radio, content);
    if (isSelected) row.append(createTicketIssueQuantityControl(memberDetailState));
    list.append(row);
  });
  sheet.append(list);

  const footer = createElement("footer", { className: "member-ticket-issue-sheet-footer" });
  const overbookedReservationCount = getOverbookedReservationCount(memberDetailState.reservations, {
    memberId: member.id,
    petId: member.petId,
  });
  const baseAvailability = getMemberTicketReservableCount(member) - overbookedReservationCount;
  const availability = baseAvailability + (selectedTicket ? (Number(selectedTicket.quantity) || 0) * memberDetailState.ticketIssueQuantity : 0);
  const availabilityText = createElement("div", {
    className: `member-ticket-issue-sheet-availability${availability < 0 ? " is-error" : ""}`,
  });
  availabilityText.append(
    createElement("span", { textContent: "예약 가능" }),
    createElement("strong", { textContent: availability < 0 ? `초과 ${Math.abs(availability)}회` : `총 ${availability}회` }),
  );
  const issueButton = createElement("button", { className: "button button--primary", type: "button", textContent: "지급" });
  issueButton.disabled = !selectedTicket;
  issueButton.addEventListener("click", () => {
    if (!selectedTicket) return;
    const issueTotalCount = (Number(selectedTicket.quantity) || 0) * memberDetailState.ticketIssueQuantity;
    const deductedCount = Math.min(overbookedReservationCount, issueTotalCount);
    const result = issueTicketToMemberPet({
      memberId: member.id,
      petId: member.petId,
      ticket: selectedTicket,
      quantity: memberDetailState.ticketIssueQuantity,
      deductedCount,
    });
    if (result.issuedTickets?.length && deductedCount > 0) {
      const issuedTicketQueue = result.issuedTickets.flatMap((issuedTicket) => (
        Array.from({ length: issuedTicket.deductedCount || 0 }, () => issuedTicket)
      ));
      getAppOverbookedReservations(memberDetailState.reservations, member.id, member.petId)
        .slice(0, deductedCount)
        .forEach((reservation, index) => {
          const issuedTicket = issuedTicketQueue[index];
          if (issuedTicket) updateSchoolHomeReservationTicketHistory(reservation.id, issuedTicket);
        });
    }
    const nextMember = result.members.find((item) => item.id === member.id);
    memberDetailState.members = result.members;
    memberDetailState.reservations = getSchoolHomeReservations();
    memberDetailState.selectedMember = nextMember || memberDetailState.selectedMember;
    memberDetailState.selectedPet = nextMember?.pets?.find((pet) => pet.id === member.petId) || memberDetailState.selectedPet;
    memberDetailState.isTicketIssueBottomSheetOpen = false;
    memberDetailState.ticketIssueSelectedId = "";
    memberDetailState.ticketIssueQuantity = 1;
    memberDetailState.toastMessage = "이용권을 지급했습니다.";
    rerender(memberDetailState);
  });
  footer.append(availabilityText, issueButton);
  sheet.append(footer);
  overlay.append(sheet);
  return overlay;
}

function createTicketIssueQuantityControl(memberDetailState) {
  const quantity = createElement("div", { className: "member-ticket-issue-sheet-quantity" });
  quantity.append(createElement("span", { textContent: "수량" }));
  const controls = createElement("div", { className: "member-ticket-issue-sheet-quantity-controls" });
  const decrease = createElement("button", { type: "button", textContent: "−", ariaLabel: "수량 줄이기" });
  const value = createElement("span", { textContent: `${memberDetailState.ticketIssueQuantity}개` });
  const increase = createElement("button", { type: "button", textContent: "+", ariaLabel: "수량 늘리기" });
  decrease.disabled = memberDetailState.ticketIssueQuantity <= 1;
  decrease.addEventListener("click", (event) => {
    event.stopPropagation();
    memberDetailState.ticketIssueQuantity = Math.max(memberDetailState.ticketIssueQuantity - 1, 1);
    rerender(memberDetailState);
  });
  increase.addEventListener("click", (event) => {
    event.stopPropagation();
    memberDetailState.ticketIssueQuantity += 1;
    rerender(memberDetailState);
  });
  controls.append(decrease, value, increase);
  quantity.append(controls);
  return quantity;
}

function formatTicketIssueSummary(ticket) {
  const validity = ticket.unlimitedValidity ? "무제한" : `${ticket.validity}${ticket.unit}`;
  const price = ticket.price ? `${Number(ticket.price).toLocaleString("ko-KR")}원` : "-";
  return `${ticket.quantity}회 / ${validity} / ${price}`;
}

function getMemberTicketReservableCount(member) {
  return getActiveTicketReservableCount(member?.ticketHistories);
}

function getAppTicketValidityCaption(memberDetailState, member, ticket) {
  const context = {
    memberId: member?.memberId || memberDetailState.selectedMember?.id,
    petId: member?.petId || memberDetailState.selectedPet?.id,
    ticketHistories: member?.ticketHistories || [],
  };
  const startedAt = getTicketStartDate(ticket, memberDetailState.reservations, context);
  if (!startedAt) return getTicketValidityText(ticket);

  const expiresAt = getTicketExpiryDate(ticket, memberDetailState.reservations, context);
  if (!expiresAt) return getTicketValidityText(ticket);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryStart = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate());
  const remainingDays = Math.max(Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)), 0);
  return `${remainingDays}일 남음`;
}

function getAppOverbookedReservations(reservations = [], memberId = "", petId = "") {
  return (reservations || [])
    .filter((reservation) => {
      return reservation?.memberId === memberId
        && reservation?.petId === petId
        && reservation?.isOverbooked === true
        && String(reservation?.status || "예약").trim() !== "취소";
    })
    .sort((left, right) => {
      const dateOrder = String(left?.date || "").localeCompare(String(right?.date || ""));
      if (dateOrder !== 0) return dateOrder;
      return String(left?.createdAt || left?.reservedAt || "").localeCompare(String(right?.createdAt || right?.reservedAt || ""));
    });
}

function createDetailInfoCard(title, options = {}) {
  const section = createElement("section", {
    className: "card member-detail-card",
    dataset: { area: options.area || "detailCard" },
  });
  const header = createElement("div", { className: "member-detail-card-header" });
  header.append(createElement("h2", { textContent: title }));
  appendHeaderMemberTags(header, options.headerTags);

  if (options.actionText) {
    header.append(createElement("button", {
      className: "member-detail-card-action",
      type: "button",
      textContent: options.actionText,
      dataset: { action: options.actionName || "detailCardAction", target: options.area || title },
    }));
  }

  section.append(header);
  return section;
}

function appendHeaderMemberTags(header, tags) {
  const memberTags = sanitizeTagList(tags);
  if (memberTags.length === 0) {
    return;
  }

  const chipList = createElement("div", {
    className: "member-tag-chip-list member-detail-header-tags",
    dataset: { area: "memberTagChips", state: "list" },
  });
  renderMemberTagChips(chipList, memberTags);
  header.append(chipList);
}

function appendInlineMemberTags(parent, tags) {
  const memberTags = sanitizeTagList(tags);
  if (memberTags.length === 0) {
    return;
  }

  const chipList = createElement("div", {
    className: "member-tag-chip-list member-detail-profile-tags",
    dataset: { area: "memberTagChips", state: "list" },
  });
  renderMemberTagChips(chipList, memberTags);
  parent.append(chipList);
}

function createWebTicketHistorySection(memberDetailState, member) {
  const section = createElement("section", { className: "member-ticket-history-section", dataset: { area: "ticketHistory" } });
  section.append(createElement("h2", { textContent: "이용권 내역" }));
  const table = createElement("div", { className: "data-table data-table--ticket member-ticket-table", role: "table" });
  ["이용권 상태", "이용권", "예약 가능", "유효기간 / 만료일", "금액", "내역"].forEach((label) => {
    table.append(createElement("span", { className: "member-ticket-table-header", textContent: label, role: "columnheader" }));
  });
  const histories = getMemberTicketHistories(member);
  if (!histories.length) {
    section.append(createTicketHistoryPlaceholder());
    return section;
  }
  histories.forEach((ticket) => {
    const ticketStatus = getTicketStatusForState(memberDetailState, ticket);
    const ticketDateFacts = getTicketDateFacts(memberDetailState, ticket);
    table.append(createElement("span", { className: `member-ticket-status status-${getTicketStatusTone(ticketStatus)}`, textContent: getTicketStatusLabel(ticketStatus) }));
    table.append(createElement("span", { textContent: ticket.ticketName || "이용권" }));
    const count = createElement("span", {
      className: `member-ticket-count-cell${getRawTicketReservableCount(ticket) < 0 ? " is-error" : ""}`,
    });
    count.append(createElement("strong", { textContent: formatTicketReservableCount(ticket) }));
    table.append(count);
    table.append(createElement("span", { textContent: ticketDateFacts.expiresAt }));
    table.append(createElement("span", { textContent: ticket.amount ? `${Number(ticket.amount).toLocaleString("ko-KR")}원` : "-" }));
    const historyButton = createElement("button", { className: "member-ticket-history-arrow", type: "button", textContent: "›", ariaLabel: "이용권 내역 상세" });
    historyButton.addEventListener("click", () => {
      memberDetailState.isTicketDetailModalOpen = true;
      memberDetailState.selectedTicketHistory = ticket;
      rerender(memberDetailState);
    });
    table.append(historyButton);
  });
  section.append(table);
  return section;
}

function createTicketDetailModal(memberDetailState) {
  const ticket = memberDetailState.selectedTicketHistory || {};
  const overlay = createElement("section", { className: "ticket-detail-modal-overlay", dataset: { area: "ticketDetailModal", state: "open" } });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeTicketDetailModal(memberDetailState);
  });
  const modal = createElement("div", { className: "ticket-detail-modal" });
  const header = createElement("header", { className: "ticket-detail-modal-header" });
  header.append(createElement("h2", { textContent: "이용권 상세" }));
  const close = createElement("button", { className: "button button--icon", type: "button", textContent: "×", ariaLabel: "이용권 상세 닫기" });
  close.addEventListener("click", () => closeTicketDetailModal(memberDetailState));
  header.append(close);
  modal.append(header);

  const info = createElement("section", { className: "ticket-detail-info" });
  info.append(createElement("h3", { textContent: "정보" }));
  const summary = createElement("div", { className: "ticket-detail-summary" });
  const summaryText = createElement("div");
  summaryText.append(createElement("strong", { textContent: ticket.ticketName || "이용권" }));
  summaryText.append(createElement("p", { textContent: `(${ticket.totalCount ?? 0}회 / ${getTicketValidityText(ticket)} / ${ticket.amount ? `${Number(ticket.amount).toLocaleString("ko-KR")}원` : "-"})` }));
  const ticketStatus = getTicketStatusForState(memberDetailState, ticket);
  const ticketDateFacts = getTicketDateFacts(memberDetailState, ticket);
  summary.append(summaryText, createElement("span", { className: `ticket-detail-status status-${getTicketStatusTone(ticketStatus)}`, textContent: getTicketStatusLabel(ticketStatus) }));
  const facts = createElement("dl", { className: "ticket-detail-facts" });
  [["지급일", ticketDateFacts.issuedAt], ["개시일", ticketDateFacts.startedAt], ["만료일", ticketDateFacts.expiresAt], ["예약 가능 날짜", `개시일 이후 ~ ${getReservationDateRuleLabel(ticket.reservationDateRule)}`]].forEach(([label, value]) => {
    facts.append(createElement("dt", { textContent: label }), createElement("dd", { textContent: value }));
  });
  summary.append(facts); info.append(summary); modal.append(info);

  const usage = createElement("section", { className: "ticket-detail-usage" });
  const usageHeader = createElement("div", { className: "ticket-detail-usage-header" });
  usageHeader.append(createElement("h3", { textContent: "사용 내역" }));
  usageHeader.append(createElement("p", {
    className: getRawTicketReservableCount(ticket) < 0 ? "is-error" : "",
    textContent: `예약 가능 ${formatTicketReservableCount(ticket)} · 이용 완료 ${getTicketReservedCount(ticket)}회 · 잔여 ${getTicketRemainingCount(ticket)}회`,
  }));
  usage.append(usageHeader);
  const usageTable = createElement("div", { className: "ticket-detail-usage-table" });
  ["상태", "서비스", "방문일", "예약 일시 (취소 일시)"].forEach((label) => usageTable.append(createElement("span", { className: "ticket-detail-usage-header-cell", textContent: label })));
  const usageHistory = getTicketUsageHistory(ticket, memberDetailState.reservations, {
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
    ticketHistories: memberDetailState.selectedPet?.ticketHistories || [],
  }).map((reservation) => getTicketUsageItem(reservation));
  (usageHistory.length ? usageHistory : ticket.usageHistory || []).forEach((item) => {
    usageTable.append(createElement("span", { className: `ticket-detail-usage-status status-${getTicketStatusTone(item.status)}`, textContent: item.status || "-" }));
    usageTable.append(createElement("span", { textContent: item.service || "유치원" }));
    usageTable.append(createElement("span", { textContent: formatTicketDate(item.visitDate || item.date) }));
    usageTable.append(createElement("span", { textContent: formatTicketDate(item.cancelledAt || item.createdAt || item.reservedAt || item.date) }));
  });
  if (!(usageHistory.length || (ticket.usageHistory || []).length)) usage.append(createTicketHistoryPlaceholder("ticket-detail-usage-empty"));
  else usage.append(usageTable);
  modal.append(usage);

  const actions = createElement("div", { className: "ticket-detail-modal-actions modal-footer-actions" });
  if (canCancelTicketIssue(memberDetailState, ticket)) {
    const cancelButton = createElement("button", {
      className: "button button--primary button--danger ticket-detail-cancel-button",
      type: "button",
      textContent: "지급 취소",
    });
    cancelButton.addEventListener("click", () => {
      memberDetailState.isTicketCancelAlertOpen = true;
      rerender(memberDetailState);
    });
    actions.append(cancelButton);
    modal.append(actions);
  }
  overlay.append(modal);
  return overlay;
}

function createTicketCancelAlert(memberDetailState, onChange) {
  const overlay = createElement("section", { className: "ticket-cancel-alert-overlay", dataset: { area: "ticketCancelAlert", state: "open" } });
  const alert = createElement("div", { className: "ticket-cancel-alert", role: "alertdialog" });
  const ticket = memberDetailState.selectedTicketHistory || {};
  alert.append(
    createElement("p", { textContent: "이용권 지급을 취소하시겠습니까?\n취소된 지급 내역은 복원할 수 없습니다." }),
  );

  const reservationLabel = createElement("label", { className: "ticket-cancel-alert-option" });
  const reservationCheckbox = createElement("input", { type: "checkbox", dataset: { field: "cancelFutureReservations" } });
  reservationCheckbox.checked = memberDetailState.shouldCancelFutureTicketReservations;
  reservationCheckbox.addEventListener("change", () => {
    memberDetailState.shouldCancelFutureTicketReservations = reservationCheckbox.checked;
    writeJsonStorage(TICKET_CANCEL_FUTURE_RESERVATIONS_STORAGE_KEY, reservationCheckbox.checked);
  });
  reservationLabel.append(reservationCheckbox, createElement("span", { textContent: "오늘 포함 미래 예약도 취소" }));
  alert.append(reservationLabel);

  const actions = createElement("div", { className: "ticket-cancel-alert-actions modal-footer-actions" });
  const closeButton = createElement("button", { className: "button button--alert-secondary", type: "button", textContent: "닫기" });
  closeButton.addEventListener("click", () => {
    memberDetailState.isTicketCancelAlertOpen = false;
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  const confirmButton = createElement("button", { className: "button button--danger", type: "button", textContent: "지급 취소" });
  confirmButton.addEventListener("click", () => {
    const result = cancelTicketIssue({
      memberId: memberDetailState.selectedMember?.id,
      petId: memberDetailState.selectedPet?.id,
      ticketHistoryId: ticket.id,
      cancelFutureReservations: memberDetailState.shouldCancelFutureTicketReservations,
    });
    memberDetailState.members = result.members;
    memberDetailState.reservations = result.reservations;
    memberDetailState.selectedMember = result.members.find((member) => member.id === memberDetailState.selectedMember?.id) || memberDetailState.selectedMember;
    memberDetailState.selectedPet = memberDetailState.selectedMember?.pets?.find((pet) => pet.id === memberDetailState.selectedPet?.id) || memberDetailState.selectedPet;
    memberDetailState.isTicketCancelAlertOpen = false;
    memberDetailState.isTicketDetailModalOpen = false;
    memberDetailState.isAppTicketStatusEditSheetOpen = false;
    memberDetailState.appTicketStatusDraft = null;
    memberDetailState.isAppTicketDetailOpen = false;
    memberDetailState.selectedTicketHistory = null;
    memberDetailState.toastMessage = result.cancelledReservationIds.length
      ? "이용권 지급과 오늘부터의 예약을 취소했습니다."
      : "이용권 지급을 취소했습니다.";
    rerenderAppTicketDetail(memberDetailState, onChange);
  });
  actions.append(closeButton, confirmButton);
  alert.append(actions);
  overlay.append(alert);
  return overlay;
}

function closeTicketDetailModal(memberDetailState) {
  memberDetailState.isTicketDetailModalOpen = false;
  memberDetailState.isTicketCancelAlertOpen = false;
  memberDetailState.selectedTicketHistory = null;
  rerender(memberDetailState);
}

function formatTicketDate(dateText) {
  if (!dateText) return "-";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return String(dateText);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function createProfileMemberTags(tags) {
  const memberTags = sanitizeTagList(tags);
  if (memberTags.length === 0) {
    return document.createDocumentFragment();
  }

  const chipList = createElement("div", {
    className: "member-tag-chip-list member-detail-profile-tags",
    dataset: { area: "memberTagChips", state: "list" },
  });
  renderMemberTagChips(chipList, memberTags);
  return chipList;
}

function createInfoList(items, className = "member-detail-info-list") {
  const list = createElement("div", { className, dataset: { role: "infoList" } });
  items.forEach(([label, value]) => {
    const row = createElement("div", { className: "member-detail-info-row" });
    row.append(createElement("span", { className: "member-detail-info-label", textContent: label }));
    row.append(createElement("strong", { className: "member-detail-info-value", textContent: value }));
    list.append(row);
  });
  return list;
}

function createMemberTagDisplaySection(title, tags) {
  const memberTags = sanitizeTagList(tags);
  if (memberTags.length === 0) {
    return null;
  }

  const section = createElement("section", {
    className: "member-tag-section",
    dataset: { area: "memberTagDisplay", state: "list" },
  });
  section.append(createElement("strong", { className: "member-tag-section-title", textContent: title }));
  const chipList = createElement("div", { className: "member-tag-chip-list", dataset: { area: "memberTagChips" } });
  renderMemberTagChips(chipList, memberTags);
  section.append(chipList);
  return section;
}

function createTicketHistoryPlaceholder(className = "member-ticket-history-placeholder") {
  return createElement("p", {
    className,
    textContent: "지급한 이용권 내역이 없습니다.",
    dataset: { state: "empty" },
  });
}

function createMemberProfileImage(className) {
  return createElement("img", {
    className,
    src: DEFAULT_DOG_PROFILE_IMAGE,
    alt: "반려견 프로필",
  });
}

function getSelectedMemberView(memberDetailState) {
  const member = memberDetailState.selectedMember || {};
  const pet = memberDetailState.selectedPet || {};
  return {
    ...member,
    ...pet,
    id: member.id || "",
    memberId: member.id || "",
    petId: pet.id || "",
    guardianName: member.guardianName || "",
    phoneNumber: member.phoneNumber || "",
    address: member.address || "",
    addressDetail: member.addressDetail || "",
    ownerTags: Array.isArray(member.ownerTags) ? [...member.ownerTags] : [],
    pets: Array.isArray(member.pets) ? member.pets : [],
  };
}

function getMemberPetName(member) {
  return formatText(member.petName || member.dogName);
}

function getSiblingMembers(members, member) {
  const selectedMember = (members || []).find((candidate) => candidate.id === member.id);
  const pets = Array.isArray(selectedMember?.pets) ? selectedMember.pets : [];
  return pets
    .filter((pet) => pet.id !== member.petId)
    .map((pet) => ({
      ...selectedMember,
      ...pet,
      id: selectedMember.id,
      petId: pet.id,
    }));
}

function getMemberTicketHistories(member) {
  return Array.isArray(member?.ticketHistories) ? member.ticketHistories : [];
}

function getTicketStatusForState(memberDetailState, ticket) {
  return getTicketStatus(ticket, memberDetailState.reservations, {
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
    ticketHistories: memberDetailState.selectedPet?.ticketHistories || [],
  });
}

function getTicketDateFacts(memberDetailState, ticket) {
  const context = {
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
    ticketHistories: memberDetailState.selectedPet?.ticketHistories || [],
  };
  const startedAt = getTicketStartDate(ticket, memberDetailState.reservations, context);
  const expiresAt = getTicketExpiryDate(ticket, memberDetailState.reservations, context);
  return {
    issuedAt: formatTicketDate(ticket.issuedAt || ticket.createdAt),
    startedAt: formatTicketDate(startedAt),
    expiresAt: startedAt ? formatTicketDate(expiresAt) : getTicketValidityText(ticket),
    startPolicyLabel: getTicketStartPolicyLabel(ticket.startDatePolicy),
  };
}

function getTicketStartPolicyLabel(policy) {
  const normalizedPolicy = String(policy || "").trim().toLowerCase();
  if (["first-attendance", "first attendance", "첫 등원일"].includes(normalizedPolicy)) return "첫 등원일";
  if (["first-reservation", "first reservation", "첫 예약일"].includes(normalizedPolicy)) return "첫 예약일";
  return "지급일";
}

function getReservationDateRuleLabel(rule) {
  const normalizedRule = String(rule || "").trim().toLowerCase();
  if (["no-limit", "no limit", "unlimited", "제한 없음"].includes(normalizedRule)) {
    return "제한 없음";
  }
  return "만료일";
}

function canCancelTicketIssue(memberDetailState, ticket) {
  const status = getTicketStatusLabel(getTicketStatusForState(memberDetailState, ticket));
  return status === "사용 전" || status === "이용 중";
}

function hasOverbookedReservations(memberDetailState) {
  return getOverbookedReservationCount(memberDetailState.reservations, {
    memberId: memberDetailState.selectedMember?.id,
    petId: memberDetailState.selectedPet?.id,
  }) > 0;
}

function getTicketStatusLabel(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (normalizedStatus === "using" || normalizedStatus === "이용 중" || normalizedStatus === "이용중") {
    return "이용 중";
  }
  if (normalizedStatus === "before" || normalizedStatus === "unused" || normalizedStatus === "사용 전") {
    return "사용 전";
  }
  if (normalizedStatus === "expired" || normalizedStatus === "만료") {
    return "만료";
  }
  if (normalizedStatus === "depleted" || normalizedStatus === "횟수 소진") {
    return "횟수 소진";
  }
  if (normalizedStatus === "completed" || normalizedStatus === "이용 완료") {
    return "이용 완료";
  }
  if (normalizedStatus === "reserved" || normalizedStatus === "예약") {
    return "예약";
  }
  if (normalizedStatus === "cancelled" || normalizedStatus === "canceled" || normalizedStatus === "취소") {
    return "취소";
  }
  return formatText(status);
}

function getTicketStatusTone(status) {
  const label = getTicketStatusLabel(status);
  if (label === "이용 중" || label === "이용 완료") {
    return "active";
  }
  if (label === "사용 전" || label === "예약") {
    return "ready";
  }
  return "danger";
}

function getTicketValidityText(ticketHistory) {
  if (ticketHistory.expiresAt) {
    return formatDateLabel(ticketHistory.expiresAt);
  }

  if (ticketHistory.unlimitedValidity) {
    return "무제한";
  }

  if (ticketHistory.validity > 0 && ticketHistory.unit) {
    return `${ticketHistory.validity}${ticketHistory.unit}`;
  }

  if (ticketHistory.validDays > 0) {
    return `${ticketHistory.validDays}일`;
  }

  return "무제한";
}

function createOwnerDetailModal(memberDetailState) {
  const overlay = createElement("section", {
    className: "pet-detail-modal-overlay",
    dataset: { area: "ownerDetailModal", modal: "ownerDetail", state: "open" },
  });
  const modal = createElement("div", { className: "pet-detail-modal" });
  const header = createElement("div", { className: "pet-detail-modal-header" });
  header.append(createElement("h2", { textContent: "보호자 수정" }));

  const closeButton = createHeaderIconButton({
    className: "button button--icon",
    icon: "close",
    ariaLabel: "보호자 수정 닫기",
    dataset: { action: "closeOwnerDetail" },
  });
  closeButton.addEventListener("click", () => {
    memberDetailState.isOwnerDetailModalOpen = false;
    rerender(memberDetailState);
  });
  header.append(closeButton);

  const form = createElement("section", { className: "pet-detail-editor", dataset: { area: "ownerDetailEditor" } });
  form.append(createOwnerReadonlyField("보호자", memberDetailState.ownerDetailDraft.guardianName));
  form.append(createOwnerReadonlyField("연락처", formatPhoneNumber(memberDetailState.ownerDetailDraft.phoneNumber)));
  form.append(createOwnerAddressField(memberDetailState));

  form.append(createOwnerDetailActions(memberDetailState));

  modal.append(header);
  modal.append(form);
  overlay.append(modal);
  return overlay;
}

function createOwnerDetailActions(memberDetailState) {
  const actions = createElement("div", { className: "pet-detail-web-actions modal-footer-actions has-delete" });
  const deleteButton = createElement("button", {
    className: "pet-detail-delete-button",
    type: "button",
    textContent: "회원 삭제",
    dataset: { action: "deleteMember" },
  });
  deleteButton.addEventListener("click", () => {
    deleteSelectedMember(memberDetailState);
  });

  const submitButton = createElement("button", {
    className: "button button--action pet-detail-web-submit-button",
    type: "button",
    textContent: "수정",
    dataset: { action: "submitOwnerDetail", state: ACTION_BUTTON_STATE.enabled },
  });
  submitButton.addEventListener("click", () => {
    submitOwnerDetailDraft(memberDetailState);
  });

  actions.append(deleteButton);
  actions.append(submitButton);
  return actions;
}

function createOwnerReadonlyField(labelText, value) {
  const field = createElement("label", { className: "pet-detail-field" });
  field.append(createElement("span", { className: "pet-detail-label", textContent: labelText }));
  const input = createElement("input", { className: "pet-detail-input", type: "text", value: formatText(value) });
  input.readOnly = true;
  field.append(input);
  return field;
}

function createOwnerAddressField(memberDetailState) {
  const field = createElement("section", { className: "pet-detail-field address-field", dataset: { field: "address" } });
  field.append(createElement("span", { className: "pet-detail-label", textContent: "주소" }));

  const wrapper = createElement("div", { className: "address-fields pet-detail-address-fields" });
  const searchRow = createElement("div", { className: "address-search-row" });
  const baseAddressInput = createElement("input", {
    className: "pet-detail-input address-search-input",
    type: "text",
    value: memberDetailState.ownerDetailDraft.address || "",
    placeholder: "주소를 검색해 주세요.",
    dataset: { field: "baseAddress" },
  });
  baseAddressInput.addEventListener("input", (event) => {
    memberDetailState.ownerDetailDraft.address = event.target.value;
  });
  searchRow.append(baseAddressInput);
  searchRow.append(createElement("button", {
    className: "address-search-button",
    type: "button",
    textContent: "주소 검색",
    dataset: { action: "searchAddress" },
  }));

  const detailAddressInput = createElement("input", {
    className: "pet-detail-input address-detail-input",
    type: "text",
    value: memberDetailState.ownerDetailDraft.addressDetail || "",
    placeholder: "직접 입력",
    dataset: { field: "detailAddress" },
  });
  detailAddressInput.addEventListener("input", (event) => {
    memberDetailState.ownerDetailDraft.addressDetail = event.target.value;
  });

  wrapper.append(searchRow);
  wrapper.append(detailAddressInput);
  field.append(wrapper);
  return field;
}

function createPetDetailModal(memberDetailState) {
  const overlay = createElement("section", {
    className: "pet-detail-modal-overlay",
    dataset: { area: "petDetailModal", modal: "petDetail", state: "open" },
  });
  const modal = createElement("div", { className: "pet-detail-modal" });
  const header = createElement("div", { className: "pet-detail-modal-header" });
  header.append(createElement("h2", { textContent: "반려견 수정" }));

  const closeButton = createHeaderIconButton({
    className: "button button--icon",
    icon: "close",
    ariaLabel: "반려견 수정 닫기",
    dataset: { action: "closePetDetail" },
  });
  closeButton.addEventListener("click", () => {
    memberDetailState.isPetDetailModalOpen = false;
    rerender(memberDetailState);
  });
  header.append(closeButton);

  modal.append(header);
  modal.append(createPetDetailEditor(memberDetailState, "web"));
  overlay.append(modal);
  return overlay;
}

function createPetDetailBottomSheet(memberDetailState) {
  const overlay = createElement("section", {
    className: "pet-bottom-sheet-overlay",
    dataset: { area: "petDetailBottomSheet", modal: "petDetailBottomSheet", state: "open" },
  });
  const sheet = createElement("div", { className: "pet-bottom-sheet pet-detail-bottom-sheet" });
  const header = createElement("header", { className: "bottom-sheet-header" });

  const closeButton = createHeaderIconButton({
    className: "bottom-sheet-close-button button button--icon",
    icon: "close",
    ariaLabel: "반려견 상세 닫기",
    dataset: { action: "closePetDetail" },
  });
  closeButton.addEventListener("click", () => {
    memberDetailState.isPetDetailBottomSheetOpen = false;
    rerender(memberDetailState);
  });
  header.append(closeButton);
  header.append(createElement("h2", { textContent: "반려견 상세" }));
  header.append(createElement("span", { className: "header-spacer" }));

  const body = createElement("section", { className: "bottom-sheet-body" });
  body.append(createPetDetailEditor(memberDetailState, "mobile"));

  sheet.append(header);
  sheet.append(body);
  sheet.append(createPetDetailBottomSheetActions(memberDetailState));
  overlay.append(sheet);
  return overlay;
}

function createPetDetailEditor(memberDetailState, layoutMode) {
  const wrapper = createElement("section", {
    className: layoutMode === "web" ? "pet-detail-editor is-web" : "pet-detail-editor is-mobile",
    dataset: { area: "petDetailEditor", platform: layoutMode },
  });
  const draft = memberDetailState.petDetailDraft;

  if (layoutMode === "web") {
    const columns = createElement("div", { className: "pet-detail-editor-columns" });
    columns.append(createPetDetailColumnLeft(memberDetailState, draft));
    columns.append(createPetDetailColumnRight(memberDetailState, draft));
    wrapper.append(columns);
    wrapper.append(createPetDetailWebSubmit(memberDetailState));
    return wrapper;
  }

  wrapper.append(createPetDetailColumnLeft(memberDetailState, draft, true));
  wrapper.append(createPetDetailColumnRight(memberDetailState, draft, true));
  return wrapper;
}

function createPetDetailColumnLeft(memberDetailState, draft, isMobile = false) {
  const column = createElement("div", { className: isMobile ? "pet-detail-column mobile" : "pet-detail-column" });
  column.append(createPetDetailPhotoArea());
  column.append(createPetDetailTextField(memberDetailState, "이름", "petName", "한글, 영문, 숫자 입력 가능 (12자 이내)", true, draft));
  column.append(createPetDetailSearchField(memberDetailState, "견종", "breed", "견종을 검색해 주세요.", true, draft));
  if (isMobile) {
    column.append(createPetDetailTextArea(memberDetailState, "메모", "memo", "성격, 알러지 등 필요한 내용을 입력해 주세요. (최대 500자)", draft));
  }
  if (!isMobile) {
    column.append(createPetDetailTextField(memberDetailState, "몸무게", "weight", "0~999 사이 숫자만 입력", false, draft, { suffix: "kg" }));
  }
  return column;
}

function createPetDetailColumnRight(memberDetailState, draft, isMobile = false) {
  const column = createElement("div", { className: isMobile ? "pet-detail-column mobile" : "pet-detail-column" });
  if (isMobile) {
    column.append(createPetDetailOptionalInfoDivider());
    column.append(createPetDetailTextField(memberDetailState, "몸무게", "weight", "0~999 사이 숫자만 입력", false, draft, { suffix: "kg" }));
  }
  column.append(createPetDetailTextField(memberDetailState, "동물등록번호", "animalRegistrationNumber", "410XXXXXXXXXXXX", false, draft));
  column.append(createPetDetailTextField(memberDetailState, "모색", "coatColor", "20자 이내 입력", false, draft));
  column.append(createPetDetailBirthDateField(memberDetailState, draft));
  column.append(createPetDetailRadioGroup(memberDetailState, "성별", "gender", ["선택 안함", "남아", "여아"], draft));
  column.append(createPetDetailRadioGroup(memberDetailState, "중성화 여부", "neuteredStatus", ["선택안함", "완료", "미완료"], draft));
  column.append(createPetDetailTagField(memberDetailState, draft, { showRemoveControls: !isMobile }));
  return column;
}

function createPetDetailOptionalInfoDivider() {
  return createElement("div", {
    className: "pet-detail-optional-info-divider",
    textContent: "선택 정보",
    dataset: { area: "optionalPetInfoDivider" },
  });
}

function createPetDetailPhotoArea() {
  const area = createElement("div", { className: "pet-detail-photo-area", dataset: { area: "petProfileImage" } });
  area.append(createElement("img", { className: "pet-detail-photo-image", src: DEFAULT_DOG_PROFILE_IMAGE, alt: "반려견 프로필" }));
  const button = createElement("button", {
    className: "pet-detail-photo-button",
    type: "button",
    ariaLabel: "반려견 사진 수정",
    dataset: { action: "editPetPhoto" },
  });
  button.append(createElement("img", { className: "button__icon pet-detail-photo-icon", src: CAMERA_ICON_PATH, alt: "" }));
  area.append(button);
  return area;
}

function createPetDetailTextField(memberDetailState, labelText, fieldName, placeholder, isRequired, draft, options = {}) {
  const field = createElement("label", { className: "pet-detail-field", dataset: { field: fieldName } });
  const label = createElement("span", { className: "pet-detail-label", textContent: labelText });
  if (isRequired) {
    label.append(createElement("span", { className: "field__required", textContent: " *" }));
  }
  const input = createElement("input", {
    className: "pet-detail-input",
    type: "text",
    value: draft[fieldName] || "",
    placeholder,
  });
  input.addEventListener("input", (event) => {
    draft[fieldName] = event.target.value;
    syncPetDetailSubmitState(memberDetailState);
  });
  field.append(label);
  field.append(input);
  if (options.suffix) {
    field.className = `${field.className} has-suffix`;
    field.append(createElement("span", { className: "pet-detail-input-suffix", textContent: options.suffix }));
  }
  return field;
}

function createPetDetailSearchField(memberDetailState, labelText, fieldName, placeholder, isRequired, draft) {
  const field = createPetDetailTextField(memberDetailState, labelText, fieldName, placeholder, isRequired, draft);
  field.dataset.search = "true";
  return field;
}

function createPetDetailTextArea(memberDetailState, labelText, fieldName, placeholder, draft) {
  const field = createElement("label", { className: "pet-detail-field is-wide", dataset: { field: fieldName } });
  field.append(createElement("span", { className: "pet-detail-label", textContent: labelText }));
  const textarea = createElement("textarea", {
    className: "pet-detail-textarea",
    value: draft[fieldName] || "",
    placeholder,
  });
  textarea.addEventListener("input", (event) => {
    draft[fieldName] = event.target.value;
    syncPetDetailSubmitState(memberDetailState);
  });
  field.append(textarea);
  return field;
}

function createPetDetailBirthDateField(memberDetailState, draft) {
  const field = createElement("fieldset", { className: "pet-detail-field", dataset: { field: "birthDate" } });
  field.append(createElement("legend", { className: "pet-detail-label", textContent: "생년월일" }));
  const row = createElement("div", { className: "pet-detail-birth-row" });
  const parts = String(draft.birthDate || "").split("-");
  ["연도", "월", "일"].forEach((placeholder, index) => {
    const input = createElement("input", {
      className: "pet-detail-birth-input",
      type: "text",
      value: parts[index] || "",
      placeholder,
    });
    input.addEventListener("input", () => {
      const dateParts = Array.from(row.querySelectorAll(".pet-detail-birth-input")).map((dateInput) => dateInput.value);
      draft.birthDate = normalizeBirthDateParts(dateParts);
      ageOutput.textContent = getAgeOutputText(draft.birthDate);
      syncPetDetailSubmitState(memberDetailState);
    });
    row.append(input);
  });
  const ageOutput = createElement("output", { className: "pet-detail-age-output", textContent: getAgeOutputText(draft.birthDate) });
  row.append(ageOutput);
  field.append(row);
  field.append(createElement("p", { className: "pet-detail-guide", textContent: "정확한 생년월일을 모르면 연도만 적어 주세요." }));
  return field;
}

function createPetDetailRadioGroup(memberDetailState, labelText, fieldName, options, draft) {
  const field = createElement("fieldset", { className: "pet-detail-field", dataset: { field: fieldName } });
  field.append(createElement("legend", { className: "pet-detail-label", textContent: labelText }));
  const row = createElement("div", { className: "pet-detail-radio-row" });
  const groupName = `pet-detail-${fieldName}`;
  options.forEach((optionText, optionIndex) => {
    const optionValue = ["선택안함", "선택 안함"].includes(optionText) ? "" : optionText;
    const isSelected = draft[fieldName] === optionValue || (!draft[fieldName] && optionIndex === 0 && optionValue === "");
    const option = createElement("label", {
      className: "pet-detail-radio-option",
      dataset: { state: isSelected ? "selected" : "idle" },
    });
    const input = createElement("input", { className: "pet-detail-radio-input", type: "radio", value: optionValue });
    input.name = groupName;
    input.checked = isSelected;
    input.addEventListener("change", () => {
      draft[fieldName] = input.value;
      row.querySelectorAll(".pet-detail-radio-option").forEach((optionElement) => {
        optionElement.dataset.state = "idle";
      });
      option.dataset.state = "selected";
      syncPetDetailSubmitState(memberDetailState);
    });
    option.append(input);
    option.append(createElement("span", { textContent: optionText }));
    row.append(option);
  });
  field.append(row);
  return field;
}

function createPetDetailTagField(memberDetailState, draft, options = {}) {
  const field = createElement("section", { className: "pet-detail-field", dataset: { field: "petTags" } });
  field.append(createElement("span", { className: "pet-detail-label", textContent: "태그" }));
  const container = createElement("div", { dataset: { area: "petTagInput" } });
  initTagInput({
    container,
    initialTags: draft.petTags,
    getCatalog: () => memberDetailState.memberTagCatalog || [],
    showRemoveControls: options.showRemoveControls !== false,
    useSelectedListTrigger: options.showRemoveControls === false,
    onChange: (nextTags) => {
      draft.petTags = nextTags;
      syncPetDetailSubmitState(memberDetailState);
    },
  });
  field.append(container);
  return field;
}

function createPetDetailWebSubmit(memberDetailState) {
  const actions = createElement("div", {
    className: canDeleteSelectedPet(memberDetailState)
      ? "pet-detail-web-actions modal-footer-actions has-delete"
      : "pet-detail-web-actions modal-footer-actions",
  });

  if (canDeleteSelectedPet(memberDetailState)) {
    const deleteButton = createElement("button", {
      className: "pet-detail-delete-button",
      type: "button",
      textContent: "반려견 삭제",
      dataset: { action: "deletePet" },
    });
    deleteButton.addEventListener("click", () => {
      deleteSelectedPet(memberDetailState);
    });
    actions.append(deleteButton);
  }

  const button = createElement("button", {
    className: "button button--action pet-detail-web-submit-button",
    type: "button",
    textContent: "수정",
    dataset: { action: "submitPetDetail", state: isPetDetailDraftReady(memberDetailState.petDetailDraft) ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled },
  });
  button.disabled = !isPetDetailDraftReady(memberDetailState.petDetailDraft);
  button.addEventListener("click", () => {
    submitPetDetailDraft(memberDetailState);
  });
  actions.append(button);
  return actions;
}

function createPetDetailBottomSheetActions(memberDetailState) {
  const actions = createElement("div", {
    className: canDeleteSelectedPet(memberDetailState)
      ? "pet-detail-bottom-sheet-actions has-delete"
      : "pet-detail-bottom-sheet-actions",
  });

  if (canDeleteSelectedPet(memberDetailState)) {
    const deleteButton = createElement("button", {
      className: "pet-detail-delete-button",
      type: "button",
      textContent: "삭제",
      dataset: { action: "deletePet" },
    });
    deleteButton.addEventListener("click", () => {
      deleteSelectedPet(memberDetailState);
    });
    actions.append(deleteButton);
  }

  const submitButton = createElement("button", {
    className: "button button--action button--full bottom-sheet-submit-button",
    type: "button",
    textContent: "수정",
    dataset: { action: "submitPetDetail", state: isPetDetailDraftReady(memberDetailState.petDetailDraft) ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled },
  });
  submitButton.disabled = !isPetDetailDraftReady(memberDetailState.petDetailDraft);
  submitButton.addEventListener("click", () => {
    submitPetDetailDraft(memberDetailState);
  });

  actions.append(submitButton);
  return actions;
}

function isPetDetailDraftReady(draft) {
  return Boolean(String(draft?.petName || "").trim() && String(draft?.breed || "").trim());
}

function syncPetDetailSubmitState(memberDetailState) {
  const buttons = document.querySelectorAll("[data-action='submitPetDetail']");
  buttons.forEach((button) => {
    const isReady = isPetDetailDraftReady(memberDetailState.petDetailDraft);
    button.disabled = !isReady;
    button.dataset.state = isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled;
  });
}

function submitPetDetailDraft(memberDetailState) {
  if (!isPetDetailDraftReady(memberDetailState.petDetailDraft)) {
    return;
  }

  applyPetDetailDraft(memberDetailState.selectedPet, memberDetailState.petDetailDraft);
  memberDetailState.memberTagCatalog = mergeMemberTagCatalog(memberDetailState.petDetailDraft.petTags);
  memberDetailState.members = saveRegisteredMembers([memberDetailState.selectedMember]);
  memberDetailState.isPetDetailModalOpen = false;
  memberDetailState.isPetDetailBottomSheetOpen = false;
  memberDetailState.toastMessage = "정보를 수정했습니다.";
  rerender(memberDetailState);
}

function submitOwnerDetailDraft(memberDetailState) {
  memberDetailState.selectedMember.address = memberDetailState.ownerDetailDraft.address || "";
  memberDetailState.selectedMember.addressDetail = memberDetailState.ownerDetailDraft.addressDetail || "";
  memberDetailState.selectedMember.ownerTags = sanitizeTagList(memberDetailState.ownerDetailDraft.ownerTags);
  memberDetailState.memberTagCatalog = mergeMemberTagCatalog(memberDetailState.selectedMember.ownerTags);
  memberDetailState.members = saveRegisteredMembers([memberDetailState.selectedMember]);
  memberDetailState.isOwnerDetailModalOpen = false;
  memberDetailState.toastMessage = "정보를 수정했습니다.";
  rerender(memberDetailState);
}

function deleteSelectedMember(memberDetailState) {
  if (!memberDetailState.selectedMember?.id) {
    return;
  }

  deleteStoredMember(memberDetailState.selectedMember.id);
  window.location.href = "./member-home.html";
}

function deleteSelectedPet(memberDetailState) {
  if (!canDeleteSelectedPet(memberDetailState)) {
    return;
  }

  const selectedPetId = memberDetailState.selectedPet.id;
  memberDetailState.selectedMember.pets = memberDetailState.selectedMember.pets.filter((pet) => pet.id !== selectedPetId);
  memberDetailState.selectedPet = memberDetailState.selectedMember.pets[0];
  memberDetailState.petDetailDraft = createPetDetailDraft(memberDetailState.selectedPet);
  memberDetailState.members = saveStoredMembers((memberDetailState.members || []).map((member) => {
    return member.id === memberDetailState.selectedMember.id ? memberDetailState.selectedMember : member;
  }));
  memberDetailState.isPetDetailModalOpen = false;
  memberDetailState.isPetDetailBottomSheetOpen = false;
  memberDetailState.toastMessage = "반려견을 삭제했습니다.";
  rerender(memberDetailState);
}

function canDeleteSelectedPet(memberDetailState) {
  return Boolean(
    memberDetailState.selectedPet?.id
      && Array.isArray(memberDetailState.selectedMember?.pets)
      && memberDetailState.selectedMember.pets.length >= 2
  );
}

function applyPetDetailDraft(pet, draft) {
  pet.petName = draft.petName || "";
  pet.dogName = draft.petName || "";
  pet.breed = draft.breed || "";
  pet.birthDate = draft.birthDate || "";
  pet.animalRegistrationNumber = draft.animalRegistrationNumber || "";
  pet.coatColor = draft.coatColor || "";
  pet.weight = draft.weight || "";
  pet.gender = draft.gender || "";
  pet.neuteredStatus = draft.neuteredStatus || "";
  pet.memo = draft.memo || "";
  pet.petTags = sanitizeTagList(draft.petTags);
}

function formatGuardianAddress(member) {
  return [member.address, member.addressDetail].filter(Boolean).join(" ");
}

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatText(value);
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function getReservationAvailability(member, reservations = []) {
  const overbookedReservationCount = getOverbookedReservationCount(reservations, {
    memberId: member?.memberId || member?.id,
    petId: member?.petId,
  });
  const ticketHistories = getMemberTicketHistories(member);
  if (ticketHistories.length) {
    const availableCount = getActiveTicketReservableCount(ticketHistories) - overbookedReservationCount;
    return {
      state: availableCount < 0 ? "error" : availableCount <= 2 ? "warning" : "normal",
      text: formatTicketReservableCount(availableCount),
      excessCount: Math.abs(availableCount),
    };
  }

  const reservableCount = getTotalCount(member.totalReservableCountByType);
  const reservedCount = getTotalCount(member.totalReservedCountByType);
  const remainingCount = getTotalCount(member.remainingCountByType);
  const excessCount = Math.max(reservedCount - reservableCount, 0);
  const availableCount = (remainingCount || reservableCount - reservedCount) - overbookedReservationCount;

  if (availableCount < 0 || excessCount > 0) {
    const excessReservationCount = Math.abs(availableCount < 0 ? availableCount : excessCount);
    return {
      state: "error",
      text: `초과 예약 ${excessReservationCount}회`,
      excessCount: excessReservationCount,
    };
  }

  return {
    state: availableCount <= 2 ? "warning" : "normal",
    text: `${availableCount}회`,
  };
}

function getTicketReservableCount(ticket) {
  return Math.max(Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0, 0);
}

function getRawTicketReservableCount(ticket) {
  return Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0;
}

function formatTicketReservableCount(ticketOrCount) {
  const count = typeof ticketOrCount === "number"
    ? ticketOrCount
    : getRawTicketReservableCount(ticketOrCount);
  return count < 0 ? `초과 예약 ${Math.abs(count)}회` : `${count}회`;
}

function getTicketReservedCount(ticket) {
  return Math.max(Number(ticket?.reservedCount) || 0, 0);
}

function getTicketRemainingCount(ticket) {
  return Math.max(Number(ticket?.remainingCount) || 0, 0);
}

function getTotalCount(countMap = {}) {
  return Object.values(countMap).reduce((total, value) => {
    const count = Number(value);
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
}

function formatTicketAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "-";
  }
  return `${numericAmount.toLocaleString("ko-KR")}원`;
}
