import { createEmptyStateElement } from "../../shared/components/empty-state.js";
import { createHeaderIconButton } from "../../shared/components/header-icon-button.js";
import { createBusinessNavigation, createDefaultAppBottomNavigation } from "../../shared/components/navigation.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { ACTION_BUTTON_STATE } from "../../shared/constants/ui-state.js";
import { normalizeMemberTagName, sanitizeTagList, sortMemberTagNames } from "../../shared/services/member-tag-service.js";
import {
  createMemberTag,
  deleteMemberTag,
  issueTicketToMemberPet,
  renameMemberTag,
} from "../../shared/storage/member-storage.js";
import {
  getSchoolHomeReservations,
  updateSchoolHomeReservationTicketHistory,
} from "../../shared/storage/school-home-storage.js";
import { createElement } from "../../shared/utils/dom.js";
import { formatText } from "../../shared/utils/format.js";
import { formatPhoneNumber, normalizePhoneNumber } from "../../shared/utils/phone.js";
import { getTicketList } from "../../shared/data/ticket-list.js";
import { getActiveTicketReservableCount, getLatestUsedTicketId, getOverbookedReservationCount } from "../../shared/services/ticket-status-service.js";
import { getFilteredMembers, getMemberListState } from "./member-home-state.js";

const MEMBER_SEARCH_FIELDS = ["petName", "breed", "guardianName", "phoneNumber"];
const MENU_FOLD_ICON_PATH = "../assets/menuFold.svg";
const MENU_FOLD_OPEN_ICON_PATH = "../assets/menuFold_fold.svg";
const DEFAULT_DOG_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";
const CHEVRON_RIGHT_ICON_PATH = "../assets/iconChevronRight.svg";
const CHEVRON_LEFT_ICON_PATH = "../assets/iconChevronLeft.svg";
const MEMBER_TAG_DUPLICATE_MESSAGE = "이미 존재하는 태그입니다.";
const MEMBER_TAG_MAX_CATALOG_MESSAGE = "태그는 최대 20개까지 등록할 수 있습니다.";
let toastDismissTimer = null;

export function renderMemberHome(rootElement, memberHomeState) {
  rootElement.innerHTML = "";

  if (memberHomeState.isMemberRegistrationPageOpen) {
    rootElement.append(createGuardianRegistrationPage(memberHomeState));
    return;
  }

  rootElement.append(createMemberHomeShell(memberHomeState));
  scheduleToastDismiss(memberHomeState);
}

function scheduleToastDismiss(memberHomeState) {
  window.clearTimeout(toastDismissTimer);

  if (!memberHomeState.toastMessage) {
    return;
  }

  toastDismissTimer = window.setTimeout(() => {
    memberHomeState.toastMessage = "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  }, TOAST_AUTO_DISMISS_MS);
}

function createMemberHomeShell(memberHomeState) {
  const shell = createElement("main", {
    className: "member-home-shell",
    dataset: {
      screen: "memberHome",
      state: "ready",
    },
  });

  shell.append(createHeader(memberHomeState));
  shell.append(createNavigation());
  shell.append(createContent(memberHomeState));

  if (memberHomeState.isGuardianLookupModalOpen) {
    shell.append(createGuardianLookupModal(memberHomeState));
  }

  if (memberHomeState.isMemberTagManagementOpen) {
    shell.append(createMemberTagManagementModal(memberHomeState));
  }

  if (memberHomeState.isTicketIssueModalOpen) {
    shell.append(createTicketIssueModal(memberHomeState));
  }

  if (memberHomeState.toastMessage) {
    shell.append(createToast(memberHomeState.toastMessage));
  }

  return shell;
}

function createHeader(memberHomeState) {
  const header = createElement("header", {
    className: "header",
    dataset: { area: "header" },
  });

  header.append(createElement("strong", { className: "brand-name", textContent: "다이얼독 비즈" }));
  header.append(createElement("h1", { textContent: "회원" }));
  header.append(createCreateMemberButton("button button--icon-round header-add-button", "+", memberHomeState));
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
    window.location.href = "./settings/member/tag-management.html";
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

  sharedNavigation.append(createDefaultAppBottomNavigation({
    className: "mobile-bottom-nav",
    dataset: { area: "bottomNavigation" },
    selectedLabel: "회원",
  }));

  return sharedNavigation;
}
function createContent(memberHomeState) {
  const content = createElement("section", {
    className: "content",
    dataset: { area: "content", feature: "memberHome", screen: "memberHome" },
  });

  const titleBar = createElement("div", {
    className: "page-title-bar",
    dataset: { area: "title" },
  });
  titleBar.append(createElement("h1", { textContent: "회원" }));
  titleBar.append(createCreateMemberButton("button button--primary", "회원 등록", memberHomeState));

  const panel = createElement("section", {
    className: "member-panel",
    dataset: { area: "memberPanel" },
  });
  panel.append(createPanelHeader(memberHomeState));
  panel.append(createMemberFilterArea(memberHomeState));
  panel.append(createMemberListArea(memberHomeState));

  content.append(titleBar);
  content.append(panel);

  return content;
}

function createPanelHeader(memberHomeState) {
  const panelHeader = createElement("div", {
    className: "member-panel-header",
    dataset: { area: "memberPanelHeader" },
  });

  panelHeader.append(createElement("h2", { textContent: "회원 목록" }));

  if (!isMobileLayout()) {
    return panelHeader;
  }

  const controlRow = createElement("div", {
    className: "member-panel-controls",
    dataset: { area: "memberControls" },
  });

  controlRow.append(createMobileTagFilterButton(memberHomeState));
  controlRow.append(createMemberSearchField(memberHomeState, {
    fieldClassName: "member-search-suggestion-field mobile-member-search-field",
    inputClassName: "search-input",
  }));
  panelHeader.append(controlRow);

  return panelHeader;
}

function createCreateMemberButton(className, textContent, memberHomeState) {
  const button = createElement("button", {
    className,
    type: "button",
    textContent,
    dataset: { action: "createMember" },
    ariaLabel: textContent === "+" ? "회원 등록" : undefined,
  });

  button.addEventListener("click", () => {
    if (isMobileLayout()) {
      memberHomeState.isMemberRegistrationPageOpen = true;
      memberHomeState.isGuardianLookupModalOpen = false;
    } else {
      memberHomeState.isGuardianLookupModalOpen = true;
      memberHomeState.isMemberRegistrationPageOpen = false;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function createTicketIssueModal(memberHomeState) {
  const member = memberHomeState.members.find((item) => item.id === memberHomeState.ticketIssueMemberId);
  const pet = member?.pets?.find((item) => item.id === memberHomeState.ticketIssuePetId);
  const tickets = getTicketList("school");
  const excessCount = getTicketIssueExcessCount(pet, memberHomeState.reservations, { memberId: member?.id });
  const overbookedReservations = getTicketIssueOverbookedReservations(memberHomeState.reservations, member?.id, pet?.id);
  const latestUsedTicketId = getLatestUsedTicketId(memberHomeState.reservations, {
    memberId: member?.id,
    petId: pet?.id,
    ticketHistories: pet?.ticketHistories,
  });
  const ticketRows = [];
  const overlay = createElement("section", { className: "ticket-issue-modal-overlay", dataset: { area: "ticketIssueModal", state: "open" } });
  const closeModal = () => {
    memberHomeState.isTicketIssueModalOpen = false;
    memberHomeState.ticketIssueMemberId = "";
    memberHomeState.ticketIssuePetId = "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); });
  const modal = createElement("div", { className: "ticket-issue-modal" });
  const header = createElement("header", { className: "ticket-issue-modal-header" });
  header.append(createElement("h2", { textContent: "이용권 지급" }));
  const close = createElement("button", { className: "button button--icon", type: "button", textContent: "×", ariaLabel: "이용권 지급 닫기" });
  close.addEventListener("click", closeModal); header.append(close); modal.append(header);
  const memberRow = createElement("div", { className: "ticket-issue-modal-member-row" });
  memberRow.append(createElement("strong", { textContent: "회원" }), createElement("span", { textContent: `${pet?.petName || pet?.dogName || "-"} (${pet?.breed || "견종 미입력"}) / ${member?.guardianName || "-"}` }));
  const rawAvailability = getActiveTicketReservableCount(pet?.ticketHistories);
  const initialAvailability = rawAvailability - excessCount;
  const availabilityText = createElement("span", { className: getTicketIssueAvailabilityTone(initialAvailability) });
  const availabilityCount = createElement("strong", { textContent: formatTicketIssueAvailability(initialAvailability) });
  const memberDeduction = createElement("small", { textContent: "", hidden: true });
  availabilityText.append(availabilityCount, memberDeduction);
  memberRow.append(createElement("strong", { textContent: "예약 가능" }), availabilityText);
  const updateAvailability = () => {
    const selectedRows = ticketRows.filter((row) => row.selected);
    const selectedCount = selectedRows.reduce((total, row) => total + Math.max(Number(row.ticket.quantity) || 0, 0) * row.quantity, 0);
    const deductedCount = Math.min(excessCount, selectedCount);
    const nextAvailability = selectedRows.length > 0 ? rawAvailability + selectedCount - deductedCount : initialAvailability;
    availabilityText.className = getTicketIssueAvailabilityTone(nextAvailability);
    availabilityCount.textContent = formatTicketIssueAvailability(nextAvailability);
    memberDeduction.textContent = deductedCount > 0 ? `선택한 이용권에서 ${deductedCount}회 차감` : "";
    memberDeduction.hidden = deductedCount <= 0;
    updateTicketIssueDeductionLabels(ticketRows, excessCount);
  };
  modal.append(memberRow, createElement("h3", { className: "ticket-issue-modal-section-title", textContent: "이용권 목록" }));
  const notice = createElement("div", { className: "ticket-issue-modal-notice" });
  notice.append(createElement("span", { textContent: "선택한 이용권의 총횟수가 초과 횟수보다 적을 경우, 수량이 자동으로 복수 선택됩니다." }));
  const noticeClose = createElement("button", { type: "button", textContent: "×", ariaLabel: "안내 닫기" });
  noticeClose.addEventListener("click", () => notice.remove());
  notice.append(noticeClose);
  modal.append(notice);
  const selectAllCheckbox = createElement("input", { type: "checkbox" });
  const table = createElement("div", { className: "ticket-issue-table" });
  const tableHeaderSelectAll = createElement("span", { className: "ticket-issue-table-header ticket-issue-check" });
  tableHeaderSelectAll.append(selectAllCheckbox);
  table.append(tableHeaderSelectAll);
  ["이용권", "총횟수", "유효기간", "가격", "수량"].forEach((label) => table.append(createElement("span", { className: "ticket-issue-table-header", textContent: label })));
  tickets.forEach((ticket) => {
    const rowState = {
      ticket,
      quantity: ticket.id === latestUsedTicketId ? getTicketIssueQuantityForExcess(ticket, excessCount) : 1,
      selected: ticket.id === latestUsedTicketId,
      checkbox: null,
      deductionElement: null,
      quantityElement: null,
      decreaseButton: null,
      increaseButton: null,
    };
    const checkbox = createElement("input", { type: "checkbox" });
    rowState.checkbox = checkbox;
    checkbox.checked = rowState.selected;
    table.append(createElement("span", { className: "ticket-issue-check" , childNodes: [checkbox] }));
    table.append(createElement("span", { textContent: ticket.name }));
    const totalCount = createElement("span", { className: "ticket-issue-total-count" });
    totalCount.append(createElement("strong", { textContent: `${ticket.quantity}회` }));
    rowState.deductionElement = createElement("small", { textContent: "", hidden: true });
    totalCount.append(rowState.deductionElement);
    table.append(totalCount);
    table.append(createElement("span", { textContent: ticket.unlimitedValidity ? "무제한" : `${ticket.validity}${ticket.unit}` }));
    table.append(createElement("span", { textContent: ticket.price ? `${Number(ticket.price).toLocaleString("ko-KR")}원` : "-" }));
    const quantity = createElement("span", { className: "ticket-issue-quantity is-disabled", dataset: { state: "disabled" } });
    const quantityValue = createElement("strong", { textContent: String(rowState.quantity) });
    const decreaseButton = createElement("button", { type: "button", textContent: "−", ariaLabel: "수량 줄이기" });
    const increaseButton = createElement("button", { type: "button", textContent: "+", ariaLabel: "수량 늘리기" });
    rowState.quantityElement = quantity;
    rowState.decreaseButton = decreaseButton;
    rowState.increaseButton = increaseButton;
    const updateQuantity = (nextQuantity) => {
      rowState.quantity = Math.max(Math.floor(Number(nextQuantity) || 1), 1);
      quantityValue.textContent = String(rowState.quantity);
      syncTicketIssueQuantityControl(rowState);
      updateAvailability();
    };
    decreaseButton.addEventListener("click", () => updateQuantity(rowState.quantity - 1));
    increaseButton.addEventListener("click", () => updateQuantity(rowState.quantity + 1));
    checkbox.addEventListener("change", () => {
      setTicketIssueRowSelected(rowState, checkbox.checked, excessCount, updateQuantity);
      syncTicketIssueSelectAll(selectAllCheckbox, ticketRows);
      issueButton.disabled = !ticketRows.some((row) => row.selected);
      updateAvailability();
    });
    quantity.append(decreaseButton, quantityValue, increaseButton);
    syncTicketIssueQuantityControl(rowState);
    table.append(quantity);
    ticketRows.push(rowState);
  });
  modal.append(table);
  const footer = createElement("footer", { className: "ticket-issue-modal-footer modal-footer-actions" });
  const issueButton = createElement("button", { className: "button button--primary", type: "button", textContent: "지급" });
  issueButton.disabled = true;
  issueButton.disabled = !ticketRows.some((row) => row.selected);
  syncTicketIssueSelectAll(selectAllCheckbox, ticketRows);
  selectAllCheckbox.addEventListener("change", () => {
    ticketRows.forEach((rowState) => {
      setTicketIssueRowSelected(rowState, selectAllCheckbox.checked, excessCount);
    });
    issueButton.disabled = !ticketRows.some((row) => row.selected);
    updateAvailability();
  });
  updateAvailability();
  issueButton.addEventListener("click", () => {
    const selectedRows = ticketRows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      return;
    }

    let remainingDeduction = excessCount;
    let reservationOffset = 0;
    let nextMembers = memberHomeState.members;
    selectedRows.forEach((row) => {
      const ticketTotalCount = Math.max(Number(row.ticket.quantity) || 0, 0) * row.quantity;
      const rowDeduction = Math.min(remainingDeduction, ticketTotalCount);
      const result = issueTicketToMemberPet({
        memberId: memberHomeState.ticketIssueMemberId,
        petId: memberHomeState.ticketIssuePetId,
        ticket: row.ticket,
        quantity: row.quantity,
        deductedCount: rowDeduction,
      });
      nextMembers = result.members;
      if (result.issuedTickets?.length && rowDeduction > 0) {
        const issuedTicketQueue = result.issuedTickets.flatMap((issuedTicket) => (
          Array.from({ length: issuedTicket.deductedCount || 0 }, () => issuedTicket)
        ));
        overbookedReservations.slice(reservationOffset, reservationOffset + rowDeduction).forEach((reservation, index) => {
          const issuedTicket = issuedTicketQueue[index];
          if (issuedTicket) updateSchoolHomeReservationTicketHistory(reservation.id, issuedTicket);
        });
      }
      reservationOffset += rowDeduction;
      remainingDeduction = Math.max(remainingDeduction - rowDeduction, 0);
    });

    memberHomeState.members = nextMembers;
    memberHomeState.reservations = getSchoolHomeReservations();
    memberHomeState.isTicketIssueModalOpen = false;
    memberHomeState.ticketIssueMemberId = "";
    memberHomeState.ticketIssuePetId = "";
    memberHomeState.toastMessage = "이용권을 지급했습니다.";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  footer.append(issueButton);
  modal.append(footer); overlay.append(modal); return overlay;
}

function setTicketIssueRowSelected(rowState, isSelected, excessCount, updateQuantity) {
  rowState.selected = isSelected;
  rowState.checkbox.checked = isSelected;
  if (isSelected && excessCount > Number(rowState.ticket.quantity || 0) && updateQuantity) {
    updateQuantity(Math.ceil(excessCount / Math.max(Number(rowState.ticket.quantity) || 1, 1)));
  }
  syncTicketIssueQuantityControl(rowState);
}

function getTicketIssueQuantityForExcess(ticket, excessCount) {
  const ticketQuantity = Math.max(Number(ticket?.quantity) || 0, 1);
  return Math.max(Math.ceil(Math.max(Number(excessCount) || 0, 0) / ticketQuantity), 1);
}

function syncTicketIssueQuantityControl(rowState) {
  const isEnabled = rowState.selected;
  rowState.quantityElement.dataset.state = isEnabled ? "active" : "disabled";
  rowState.quantityElement.classList.toggle("is-disabled", !isEnabled);
  rowState.decreaseButton.disabled = !isEnabled || rowState.quantity <= 1;
  rowState.increaseButton.disabled = !isEnabled;
}

function syncTicketIssueSelectAll(selectAllCheckbox, ticketRows) {
  const selectedCount = ticketRows.filter((row) => row.selected).length;
  selectAllCheckbox.checked = ticketRows.length > 0 && selectedCount === ticketRows.length;
  selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < ticketRows.length;
}

function updateTicketIssueDeductionLabels(ticketRows, excessCount) {
  ticketRows.forEach((rowState) => {
    const rowDeduction = getTicketIssueRowDeduction(rowState, ticketRows, excessCount);
    rowState.deductionElement.textContent = rowDeduction > 0 ? `${rowDeduction}회 차감` : "";
    rowState.deductionElement.hidden = rowDeduction <= 0;
  });
}

function getTicketIssueRowDeduction(targetRow, ticketRows, excessCount) {
  let remainingDeduction = excessCount;
  for (const rowState of ticketRows) {
    if (!rowState.selected) continue;
    const ticketTotalCount = Math.max(Number(rowState.ticket.quantity) || 0, 0) * rowState.quantity;
    const rowDeduction = Math.min(remainingDeduction, ticketTotalCount);
    if (rowState === targetRow) return rowDeduction;
    remainingDeduction = Math.max(remainingDeduction - rowDeduction, 0);
  }
  return 0;
}

function getTicketIssueAvailabilityTone(availability) {
  if (availability < 0) return "is-error";
  return availability >= 3 ? "is-available" : "is-warning";
}

function formatTicketIssueAvailability(availability) {
  return availability < 0 ? `초과 ${Math.abs(availability)}회` : `${availability}회`;
}

function getTicketIssueExcessCount(pet, reservations = [], { memberId = "" } = {}) {
  const overbookedReservationCount = getOverbookedReservationCount(reservations, {
    memberId: memberId || pet?.memberId,
    petId: pet?.id,
  });
  const reservableCount = Number(pet?.totalReservableCountByType?.school) || 0;
  const reservedCount = Number(pet?.totalReservedCountByType?.school) || 0;
  return Math.max(overbookedReservationCount, reservedCount - reservableCount, 0);
}

function getTicketIssueOverbookedReservations(reservations = [], memberId = "", petId = "") {
  return reservations
    .filter((reservation) => {
      return reservation?.memberId === memberId
        && reservation?.petId === petId
        && reservation?.isOverbooked === true
        && String(reservation?.status || "예약").trim() !== "취소";
    })
    .sort((left, right) => {
      return String(left.date || "").localeCompare(String(right.date || ""))
        || String(left.createdAt || left.reservedAt || "").localeCompare(String(right.createdAt || right.reservedAt || ""));
    });
}

function createGuardianLookupModal(memberHomeState) {
  const overlay = createElement("section", {
    className: "guardian-modal-overlay",
    dataset: { area: "guardianLookupModal", modal: "guardianLookup", state: "open" },
  });
  const modal = createElement("div", { className: "guardian-modal" });
  const header = createElement("div", { className: "modal-header" });
  header.append(createElement("h2", { textContent: "보호자 조회" }));
  header.append(createCloseRegistrationButton(memberHomeState, "modal__close-button", "✕", "보호자 조회 닫기"));

  const body = createElement("div", { className: "registration-form" });
  body.append(createRegistrationNotice("등록 전, 다이얼독에 가입한 회원인지 조회합니다.\n보호자의 성함과 전화번호는 아이디로 사용되니 정확하게 입력해 주세요."));
  body.append(createFormField("보호자 성함", "이름 입력", true, {
    value: memberHomeState.guardianLookup.guardianName,
    hasError: Boolean(memberHomeState.guardianLookup.error),
    errorMessage: memberHomeState.guardianLookup.error,
    onInput: (value) => {
      memberHomeState.guardianLookup.guardianName = value;
      memberHomeState.guardianLookup.error = "";
      syncGuardianLookupButtonState(memberHomeState);
    },
  }));
  body.append(createFormField("전화번호", "010-0000-0000", true, {
    value: formatPhoneNumber(memberHomeState.guardianLookup.phoneNumber),
    inputFormatter: formatPhoneNumber,
    onInput: (value) => {
      memberHomeState.guardianLookup.phoneNumber = value;
      syncGuardianLookupButtonState(memberHomeState);
    },
  }));
  body.append(createLookupGuardianButton(memberHomeState, "조회"));

  modal.append(header);
  modal.append(body);
  overlay.append(modal);

  return overlay;
}

function createGuardianRegistrationPage(memberHomeState) {
  const page = createElement("main", {
    className: "member-registration-page",
    dataset: { screen: "memberRegistration", state: "creating" },
  });
  const header = createElement("header", {
    className: "registration-page-header",
    dataset: { area: "header" },
  });
  header.append(createCloseRegistrationButton(memberHomeState, "page-close-button", "✕", "회원 등록 닫기"));
  header.append(createElement("h1", { textContent: "회원 등록" }));
  header.append(createElement("span", { className: "header-spacer" }));

  const form = createElement("section", {
    className: "registration-form registration-page-form",
    dataset: { area: "memberRegistrationForm" },
  });
  form.append(createRegistrationNotice("보호자 이름과 번호는 회원 아이디로 사용됩니다.\n올바른 보호자 정보를 입력해 주세요."));
  form.append(createFormField("보호자 이름", "한글, 영문 10자 이내 입력", true, {
    value: memberHomeState.guardianLookup.guardianName,
    hasError: Boolean(memberHomeState.guardianLookup.error),
    errorMessage: memberHomeState.guardianLookup.error,
    onInput: (value) => {
      memberHomeState.guardianLookup.guardianName = value;
      memberHomeState.guardianLookup.error = "";
      syncGuardianLookupButtonState(memberHomeState);
    },
  }));
  form.append(createFormField("전화번호", "010-0000-0000", true, {
    value: formatPhoneNumber(memberHomeState.guardianLookup.phoneNumber),
    inputFormatter: formatPhoneNumber,
    onInput: (value) => {
      memberHomeState.guardianLookup.phoneNumber = value;
      syncGuardianLookupButtonState(memberHomeState);
    },
  }));

  page.append(header);
  page.append(form);
  page.append(createLookupGuardianButton(memberHomeState, "다음", "button button--action mobile-next-button"));

  return page;
}

function createCloseRegistrationButton(memberHomeState, className, textContent, ariaLabel) {
  const actionClassName = "button button--icon";
  const button = createHeaderIconButton({
    className: `${className} ${actionClassName}`,
    icon: textContent === "←" ? "back" : "close",
    ariaLabel,
    dataset: { action: "closeMemberRegistration" },
  });

  button.addEventListener("click", () => {
    memberHomeState.isGuardianLookupModalOpen = false;
    memberHomeState.isMemberRegistrationPageOpen = false;
    memberHomeState.toastMessage = "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function createRegistrationNotice(textContent) {
  return createElement("section", {
    className: "registration-notice",
    textContent,
    dataset: { area: "registrationNotice" },
  });
}

function createFormField(labelText, placeholder, isRequired, options = {}) {
  const field = createElement("label", {
    className: options.hasError ? "field field--error registration-field" : "field registration-field",
    dataset: {
      field: labelText,
      state: options.hasError ? "validationError" : "idle",
    },
  });
  const label = createElement("span", { className: "field__label registration-label", textContent: labelText });

  if (isRequired) {
    label.append(createElement("span", { className: "field__required", textContent: " *" }));
  }

  const input = createElement("input", {
    className: "field__control registration-input",
    type: "text",
    placeholder,
    value: options.value || "",
  });
  input.addEventListener("input", (event) => {
    if (options.inputFormatter) {
      event.target.value = options.inputFormatter(event.target.value);
    }

    if (options.onInput) {
      options.onInput(event.target.value);
    }
  });

  field.append(label);
  field.append(input);

  if (options.errorMessage) {
    field.append(createElement("p", { className: "field__error", textContent: options.errorMessage }));
  }

  return field;
}

function createLookupGuardianButton(memberHomeState, textContent, className = "button button--action") {
  const isReady = isGuardianLookupReady(memberHomeState);
  const button = createElement("button", {
    className,
    type: "button",
    textContent,
    dataset: {
      action: "lookupGuardian",
      state: isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled,
    },
  });
  button.disabled = !isReady;

  button.addEventListener("click", () => {
    if (!isGuardianLookupReady(memberHomeState)) {
      syncGuardianLookupButtonState(memberHomeState);
      return;
    }

    const didRedirect = handleGuardianLookup(memberHomeState);

    if (didRedirect) {
      return;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function syncGuardianLookupButtonState(memberHomeState) {
  const lookupButton = document.querySelector("[data-action='lookupGuardian']");

  if (!lookupButton) {
    return;
  }

  const isReady = isGuardianLookupReady(memberHomeState);
  lookupButton.disabled = !isReady;
  lookupButton.dataset.state = isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled;
}

function isGuardianLookupReady(memberHomeState) {
  const guardianName = normalizeLookupText(memberHomeState.guardianLookup.guardianName);
  const phoneNumber = normalizePhoneNumber(memberHomeState.guardianLookup.phoneNumber);
  return Boolean(guardianName && phoneNumber.length >= 10);
}

function handleGuardianLookup(memberHomeState) {
  const inputPhoneNumber = normalizePhoneNumber(memberHomeState.guardianLookup.phoneNumber);
  const inputGuardianName = normalizeLookupText(memberHomeState.guardianLookup.guardianName);
  const matchedByPhone = inputPhoneNumber
    ? memberHomeState.members.find((member) => {
        return normalizePhoneNumber(member.phoneNumber) === inputPhoneNumber;
      })
    : null;

  if (matchedByPhone && normalizeLookupText(matchedByPhone.guardianName) !== inputGuardianName) {
    memberHomeState.guardianLookup.error = "회원 정보가 일치하지 않습니다";
    return false;
  }

  const selectedMember = matchedByPhone || {
    id: "",
    petName: "",
    dogName: "",
    guardianName: memberHomeState.guardianLookup.guardianName,
    phoneNumber: memberHomeState.guardianLookup.phoneNumber,
    address: "",
    breed: "",
    ownerTags: [],
    petTags: [],
    isRegistered: false,
  };

  memberHomeState.guardianLookup.error = "";
  memberHomeState.isGuardianLookupModalOpen = false;
  memberHomeState.isMemberRegistrationPageOpen = false;

  if (matchedByPhone && matchedByPhone.isRegistered) {
    window.location.href = createMemberDetailUrl(matchedByPhone);
    return true;
  }

  window.location.href = createMemberRegistrationUrl(selectedMember, matchedByPhone);
  return true;
}

function createMemberRegistrationUrl(member, matchedByPhone) {
  const queryParams = new URLSearchParams();

  if (member.id) {
    queryParams.set("memberId", member.id);
  }

  queryParams.set("guardianName", member.guardianName || "");
  queryParams.set("phoneNumber", member.phoneNumber || "");
  queryParams.set("address", member.address || "");

  if (matchedByPhone) {
    queryParams.set("toast", "loaded");
  }

  return `./member-registration.html?${queryParams.toString()}`;
}

function createMemberDetailUrl(member) {
  const queryParams = new URLSearchParams();

  if (member?.id) {
    queryParams.set("memberId", member.id);
  }

  const petId = member?.petId || member?.pets?.[0]?.id || "";
  if (petId) {
    queryParams.set("petId", petId);
  }

  return `./member-detail.html?${queryParams.toString()}`;
}

function normalizeLookupText(value) {
  return String(value || "").trim();
}

function isMobileLayout() {
  return window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
}

function createMemberFilterArea(memberHomeState) {
  const filterArea = createElement("section", {
    className: "member-filter-area",
    dataset: {
      area: "memberFilter",
      state: memberHomeState.isFilterPanelOpen ? "open" : "closed",
    },
  });

  if (isMobileLayout() && memberHomeState.isTagMenuOpen) {
    filterArea.append(createMobileTagBottomSheet(memberHomeState));
  }

  if (!isMobileLayout()) {
    const headerRow = createElement("div", {
      className: "member-filter-row",
      dataset: { area: "memberFilterRow" },
    });
    headerRow.append(createWebFilterToggle(memberHomeState));
    headerRow.append(createWebFilterSearchField(memberHomeState));
    filterArea.append(headerRow);

    if (memberHomeState.isFilterPanelOpen) {
      filterArea.append(createWebFilterPanel(memberHomeState));
    }
  }

  return filterArea;
}

function createWebFilterToggle(memberHomeState) {
  const button = createElement("button", {
    className: "filter-toggle-button",
    type: "button",
    dataset: {
      action: "toggleFilterPanel",
      state: memberHomeState.isFilterPanelOpen ? "open" : "closed",
    },
    childNodes: [
      createElement("span", { textContent: "필터" }),
      createFoldIcon(memberHomeState.isFilterPanelOpen),
    ],
  });

  button.addEventListener("click", () => {
    memberHomeState.isFilterPanelOpen = !memberHomeState.isFilterPanelOpen;
    memberHomeState.isTagMenuOpen = false;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function createWebFilterPanel(memberHomeState) {
  const panel = createElement("div", {
    className: "filter-detail-panel",
    dataset: { area: "filterDetail" },
  });

  const fields = createElement("div", {
    className: "member-filter-fields",
    dataset: { area: "memberFilterFields" },
  });
  fields.append(createWebFilterTagField(memberHomeState));
  panel.append(fields);
  panel.append(createResetFilterButton(memberHomeState));

  return panel;
}

function createWebFilterSearchField(memberHomeState) {
  return createMemberSearchField(memberHomeState, {
    fieldClassName: "filter-field filter-search-field member-search-filter-field member-search-suggestion-field",
    inputClassName: "filter-search-input member-filter-search-input",
  });
}

function createMemberSearchField(memberHomeState, options) {
  const field = createElement("div", {
    className: options.fieldClassName,
    dataset: { field: "memberSearch" },
  });
  field.append(createMemberSearchInput(memberHomeState, options.inputClassName));

  return field;
}

function createWebFilterTagField(memberHomeState) {
  const field = createElement("div", {
    className: "filter-field filter-tag-field member-tag-filter-field",
    dataset: {
      field: "memberTag",
      state: memberHomeState.isTagMenuOpen ? "open" : "closed",
    },
  });
  const tagButton = createElement("button", {
    className: "filter-select-button member-filter-select-button",
    type: "button",
    dataset: { action: "toggleMemberTagMenu" },
    childNodes: [
      createElement("span", { textContent: getSelectedTagSummary(memberHomeState) }),
      createFoldIcon(memberHomeState.isTagMenuOpen),
    ],
  });
  tagButton.addEventListener("click", () => {
    memberHomeState.isTagMenuOpen = !memberHomeState.isTagMenuOpen;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  field.append(tagButton);

  if (memberHomeState.isTagMenuOpen) {
    field.append(createTagMultiSelectMenu(memberHomeState));
  }

  return field;
}

function createMobileTagFilterButton(memberHomeState) {
  const button = createElement("button", {
    className: "mobile-tag-filter-button",
    type: "button",
    textContent: getSelectedTagSummary(memberHomeState),
    dataset: {
      action: "openMemberTagBottomSheet",
      state: memberHomeState.selectedMemberTagNames.length ? "selected" : "empty",
    },
  });

  button.addEventListener("click", () => {
    memberHomeState.isTagMenuOpen = true;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function createMobileTagBottomSheet(memberHomeState) {
  const overlay = createElement("section", {
    className: "tag-bottom-sheet-overlay",
    dataset: { area: "memberTagBottomSheet", modal: "memberTagBottomSheet", state: "open" },
  });
  const sheet = createElement("div", { className: "tag-bottom-sheet" });
  const header = createElement("div", { className: "tag-bottom-sheet-header" });
  header.append(createTagBottomSheetResetButton(memberHomeState));
  header.append(createElement("h3", { textContent: "태그" }));

  const closeButton = createElement("button", {
    className: "button button--text button--text-primary",
    type: "button",
    textContent: "닫기",
    dataset: { action: "closeMemberTagBottomSheet" },
  });
  closeButton.addEventListener("click", () => {
    memberHomeState.isTagMenuOpen = false;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  header.append(closeButton);

  sheet.append(header);
  sheet.append(createTagBottomSheetSearchControl(memberHomeState));
  sheet.append(createTagMultiSelectMenu(memberHomeState));
  overlay.append(sheet);

  return overlay;
}

function createTagBottomSheetResetButton(memberHomeState) {
  const button = createElement("button", {
    className: "reset-filter-button",
    type: "button",
    textContent: "초기화",
    dataset: { action: "resetMemberTagSelection" },
  });
  button.addEventListener("click", () => {
    memberHomeState.selectedMemberTagNames = [];
    memberHomeState.currentPage = 1;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  return button;
}

function createTagBottomSheetSearchControl(memberHomeState) {
  return createTagSearchControl(memberHomeState, {
    className: "member-tag-search-control member-tag-search-filter-control",
    inputClassName: "member-tag-search-input",
    refocusSelector: ".member-tag-search-filter-control .member-tag-search-input",
    clearMode: "selection",
  });
}

function createTagMultiSelectMenu(memberHomeState) {
  const visibleMemberTags = getVisibleMemberTags(memberHomeState);
  const menu = createElement("div", {
    className: "tag-multi-select-menu",
    dataset: {
      area: "memberTagMenu",
      state: visibleMemberTags.length ? "list" : memberHomeState.memberTagCatalog.length ? "searchEmpty" : "empty",
    },
  });

  if (!isMobileLayout()) {
    menu.append(createTagSearchControl(memberHomeState, {
      className: "member-tag-search-control tag-menu-search-control",
      inputClassName: "member-tag-search-input",
      refocusSelector: ".tag-menu-search-control .member-tag-search-input",
      clearMode: "query",
    }));
  }

  const list = createElement("div", {
    className: "member-tag-data-list",
    dataset: { area: "memberTagOptionList" },
  });

  if (memberHomeState.memberTagCatalog.length === 0) {
    list.append(createTagEmptyState("등록된 태그가 없습니다"));
    menu.append(list);
    return menu;
  }

  if (visibleMemberTags.length === 0) {
    list.append(createTagEmptyState("검색 결과가 없습니다."));
    menu.append(list);
    return menu;
  }

  visibleMemberTags.forEach((memberTagName) => {
    list.append(createTagOptionButton(memberHomeState, memberTagName));
  });

  menu.append(list);
  return menu;
}

function createTagSearchControl(memberHomeState, options = {}) {
  let isComposing = false;
  const wrapper = createElement("div", {
    className: "member-tag-search-stack",
    dataset: { area: "memberTagFilterSearchControl", state: memberHomeState.selectedMemberTagNames.length ? "selected" : "empty" },
  });

  const control = createElement("div", {
    className: options.className || "member-tag-search-control",
    dataset: { state: "input" },
  });

  const input = createElement("input", {
    className: options.inputClassName || "member-tag-search-input",
    type: "text",
    value: memberHomeState.tagFilterQuery || "",
    placeholder: "태그 조회",
    dataset: { field: "memberTagSearch" },
  });
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", (event) => {
    isComposing = false;
    const composingInput = event.target;
    window.setTimeout(() => {
      memberHomeState.tagFilterQuery = composingInput.value;
      renderMemberHome(document.querySelector("#app"), memberHomeState);
      focusTagSearchInput(options.refocusSelector);
    }, 0);
  });
  input.addEventListener("input", (event) => {
    memberHomeState.tagFilterQuery = event.target.value;

    if (isComposing) {
      syncMemberTagFilterDataList(memberHomeState, control);
      return;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);

    if (!options.refocusSelector) {
      return;
    }

    focusTagSearchInput(options.refocusSelector);
  });
  control.append(input);
  wrapper.append(control);

  if (options.clearMode === "selection" || !memberHomeState.tagFilterQuery) {
    return wrapper;
  }

  const clearButton = createElement("button", {
    className: "member-tag-clear-button",
    type: "button",
    textContent: "×",
    ariaLabel: "태그 검색어 지우기",
    dataset: { action: "clearMemberTagQuery" },
  });
  clearButton.addEventListener("click", () => {
    memberHomeState.tagFilterQuery = "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  control.append(clearButton);

  return wrapper;
}

function syncMemberTagFilterDataList(memberHomeState, control) {
  const list = control
    ?.closest(".tag-multi-select-menu, .tag-bottom-sheet")
    ?.querySelector(".member-tag-data-list")
    || document.querySelector(".tag-bottom-sheet .member-tag-data-list");

  if (!list) {
    return;
  }

  populateMemberTagFilterDataList(list, memberHomeState);
}

function populateMemberTagFilterDataList(list, memberHomeState) {
  const visibleMemberTags = getVisibleMemberTags(memberHomeState);
  const hasQuery = Boolean(normalizeLookupText(memberHomeState.tagFilterQuery));

  list.innerHTML = "";
  list.dataset.state = visibleMemberTags.length ? "list" : hasQuery ? "searchEmpty" : "empty";
  list.dataset.query = normalizeLookupText(memberHomeState.tagFilterQuery);

  if (memberHomeState.memberTagCatalog.length === 0) {
    list.append(createTagEmptyState("등록된 태그가 없습니다"));
    return;
  }

  if (visibleMemberTags.length === 0) {
    list.append(createTagEmptyState("검색 결과가 없습니다."));
    return;
  }

  visibleMemberTags.forEach((memberTagName) => {
    list.append(createTagOptionButton(memberHomeState, memberTagName));
  });
}

function createTagEmptyState(title) {
  const emptyState = createEmptyStateElement({ title });
  emptyState.className = "empty-state member-tag-empty-state";
  return emptyState;
}

function focusTagSearchInput(selector) {
  if (!selector) {
    return;
  }

  window.setTimeout(() => {
    const nextInput = document.querySelector(selector);
    if (!nextInput) {
      return;
    }

    nextInput.focus();
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  }, 0);
}

function createMemberSearchInput(memberHomeState, className) {
  let isComposing = false;
  const searchInput = createElement("input", {
    className,
    type: "search",
    value: memberHomeState.searchTerm,
    placeholder: "반려견 / 보호자 / 전화번호 검색",
    dataset: { field: "memberSearch", action: "searchMembers" },
  });
  searchInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  searchInput.addEventListener("compositionend", (event) => {
    isComposing = false;
    window.setTimeout(() => {
      memberHomeState.searchTerm = event.target.value;
      memberHomeState.currentPage = 1;
      renderMemberHome(document.querySelector("#app"), memberHomeState);
      focusMemberSearchInput();
    }, 0);
  });
  searchInput.addEventListener("input", (event) => {
    memberHomeState.searchTerm = event.target.value;
    memberHomeState.currentPage = 1;

    if (isComposing) {
      return;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);
    focusMemberSearchInput();
  });
  return searchInput;
}

function focusMemberSearchInput() {
  window.setTimeout(() => {
    const nextInput = document.querySelector(".member-filter-search-input, .mobile-member-search-field .search-input");
    if (!nextInput) {
      return;
    }

    nextInput.focus();
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  }, 0);
}

function createTagOptionButton(memberHomeState, memberTagName) {
  const isSelected = memberHomeState.selectedMemberTagNames.includes(memberTagName);
  const option = createElement("label", {
    className: "member-tag-option",
    dataset: {
      action: "toggleMemberTagFilter",
      entity: "memberTag",
      entityId: memberTagName,
      state: isSelected ? "selected" : "idle",
    },
  });
  const checkbox = createElement("input", {
    type: "checkbox",
    dataset: { field: "memberTagOption" },
  });
  checkbox.checked = isSelected;
  checkbox.addEventListener("change", () => {
    toggleSelectedMemberTag(memberHomeState, memberTagName);
    memberHomeState.currentPage = 1;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  option.append(checkbox);
  option.append(createElement("span", { textContent: memberTagName }));

  return option;
}

function getVisibleMemberTags(memberHomeState) {
  const query = normalizeLookupText(memberHomeState.tagFilterQuery).toLowerCase();
  const memberTags = memberHomeState.memberTagCatalog || [];

  if (!query) {
    return memberTags;
  }

  return memberTags.filter((memberTagName) => {
    return String(memberTagName || "").toLowerCase().includes(query);
  });
}

function createResetFilterButton(memberHomeState) {
  const button = createElement("button", {
    className: "reset-filter-button",
    type: "button",
    textContent: "초기화",
    dataset: { action: "resetMemberFilters" },
  });

  button.addEventListener("click", () => {
    memberHomeState.selectedMemberTagNames = [];
    memberHomeState.tagFilterQuery = "";
    memberHomeState.isTagMenuOpen = false;
    memberHomeState.currentPage = 1;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });

  return button;
}

function toggleSelectedMemberTag(memberHomeState, memberTagName) {
  if (memberHomeState.selectedMemberTagNames.includes(memberTagName)) {
    memberHomeState.selectedMemberTagNames = memberHomeState.selectedMemberTagNames.filter((selectedTagName) => {
      return selectedTagName !== memberTagName;
    });
    return;
  }

  memberHomeState.selectedMemberTagNames = [...memberHomeState.selectedMemberTagNames, memberTagName];
}

function getSelectedTagSummary(memberHomeState) {
  if (memberHomeState.selectedMemberTagNames.length === 0) {
    return "태그";
  }

  return `태그(${memberHomeState.selectedMemberTagNames.length})`;
}

function createFoldIcon(isOpen) {
  return createElement("img", {
    className: "fold-icon",
    src: isOpen ? MENU_FOLD_OPEN_ICON_PATH : MENU_FOLD_ICON_PATH,
    alt: "",
  });
}

function createMemberListArea(memberHomeState) {
  const filteredMembers = getFilteredMembers(memberHomeState, MEMBER_SEARCH_FIELDS);
  const listState = getMemberListState(memberHomeState, filteredMembers);
  const pagination = getMemberPagination(memberHomeState, filteredMembers);
  const listArea = createElement("section", {
    className: "member-list-area",
    dataset: { area: "memberList", state: listState },
  });

  listArea.append(createMemberListHeader());

  if (listState !== "list") {
    listArea.append(createMemberEmptyState(listState));
    return listArea;
  }

  const visibleMembers = isMobileLayout() ? filteredMembers : pagination.items;
  visibleMembers.forEach((member) => {
    listArea.append(createMemberRow(memberHomeState, member));
  });

  if (!isMobileLayout()) {
    listArea.append(createMemberPaginationControls(memberHomeState, pagination));
  }

  return listArea;
}

function getMemberPagination(memberHomeState, filteredMembers) {
  const pageSize = Number(memberHomeState.pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(Math.max(Number(memberHomeState.currentPage) || 1, 1), totalPages);

  if (currentPage !== memberHomeState.currentPage) {
    memberHomeState.currentPage = currentPage;
  }

  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    pageSize,
    totalCount: filteredMembers.length,
    items: filteredMembers.slice(startIndex, startIndex + pageSize),
  };
}

function createMemberPaginationControls(memberHomeState, pagination) {
  const controls = createElement("nav", {
    className: "member-pagination",
    dataset: {
      area: "memberPagination",
      state: pagination.totalPages > 1 ? "active" : "single",
    },
  });

  controls.append(createMemberPageMoveButton(memberHomeState, "prev", pagination));

  for (let pageNumber = 1; pageNumber <= pagination.totalPages; pageNumber += 1) {
    const button = createElement("button", {
      className: pageNumber === pagination.currentPage ? "member-page-button is-selected" : "member-page-button",
      type: "button",
      textContent: String(pageNumber),
      ariaLabel: `${pageNumber}페이지`,
      dataset: {
        action: "goToMemberPage",
        page: String(pageNumber),
        state: pageNumber === pagination.currentPage ? "selected" : "idle",
      },
    });
    button.addEventListener("click", () => {
      memberHomeState.currentPage = pageNumber;
      renderMemberHome(document.querySelector("#app"), memberHomeState);
    });
    controls.append(button);
  }

  controls.append(createMemberPageMoveButton(memberHomeState, "next", pagination));
  return controls;
}

function createMemberPageMoveButton(memberHomeState, direction, pagination) {
  const isPrev = direction === "prev";
  const disabled = isPrev ? pagination.currentPage <= 1 : pagination.currentPage >= pagination.totalPages;
  const button = createElement("button", {
    className: "member-page-button member-page-move-button",
    type: "button",
    ariaLabel: isPrev ? "이전 페이지" : "다음 페이지",
    dataset: {
      action: isPrev ? "prevMemberPage" : "nextMemberPage",
      state: disabled ? "disabled" : "idle",
    },
  });
  button.append(createElement("img", {
    className: "member-page-move-icon",
    src: isPrev ? CHEVRON_LEFT_ICON_PATH : CHEVRON_RIGHT_ICON_PATH,
    alt: "",
  }));
  button.disabled = disabled;
  button.addEventListener("click", () => {
    if (disabled) {
      return;
    }

    memberHomeState.currentPage = isPrev ? pagination.currentPage - 1 : pagination.currentPage + 1;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  return button;
}

function createMemberListHeader() {
  const header = createElement("div", {
    className: "member-list-header",
    dataset: { role: "memberListHeader" },
  });

  ["반려견", "보호자", "전화번호", "예약 가능", "이용권 지급"].forEach((headerText) => {
    header.append(createElement("span", { textContent: headerText }));
  });

  return header;
}

function createMemberRow(memberHomeState, member) {
  const row = createElement("article", {
    className: "member-row",
    dataset: {
      entity: "member",
      entityId: formatText(member.id),
      petId: formatText(member.petId),
    },
  });

  row.append(createMemberIdentity(member));
  row.append(createElement("span", { className: "member-cell guardian-cell", textContent: formatText(member.guardianName) }));
  row.append(createElement("span", { className: "member-cell phone-cell", textContent: formatText(formatPhoneNumber(member.phoneNumber)) }));
  row.append(createReservationAvailabilityCell(memberHomeState, member));
  row.append(createTicketIssueCell(memberHomeState, member));
  row.append(createMemberRowMoreButton(memberHomeState, member));

  row.addEventListener("click", () => {
    openMemberDetail(memberHomeState, member);
  });

  return row;
}

function createMemberRowMoreButton(memberHomeState, member) {
  const button = createElement("button", {
    className: "row-more-button",
    type: "button",
    ariaLabel: `${formatText(member.petName)} 보기`,
    dataset: {
      action: "openMemberMoreMenu",
      entity: "member",
      entityId: formatText(member.id),
      petId: formatText(member.petId),
    },
    childNodes: [
      createElement("img", { className: "row-more-icon", src: CHEVRON_RIGHT_ICON_PATH, alt: "" }),
    ],
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openMemberDetail(memberHomeState, member);
  });

  return button;
}

function createMemberIdentity(member) {
  const identity = createElement("span", { className: "member-identity member-cell" });

  const title = createElement("strong", { textContent: `${formatText(member.petName)} (${formatText(member.breed)})` });
  identity.append(title);

  return identity;
}

function createReservationAvailabilityCell(memberHomeState, member) {
  const availability = getReservationAvailability(member, memberHomeState.reservations);
  return createElement("span", {
    className: [
      "member-cell",
      "reservation-cell",
      availability.state === "warning" ? "is-warning" : "",
      availability.state === "error" ? "is-error" : "",
    ].filter(Boolean).join(" "),
    textContent: availability.state === "error" && isMobileLayout() ? "초과" : availability.text,
    dataset: { state: availability.state, area: "reservationAvailability" },
  });
}

function createTicketIssueCell(memberHomeState, member) {
  const cell = createElement("span", { className: "member-cell ticket-issue-cell" });
  const button = createElement("button", {
    className: "button button--secondary ticket-issue-button",
    type: "button",
    textContent: "지급",
    dataset: { action: "issueTicket", entityId: formatText(member.id), petId: formatText(member.petId) },
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    memberHomeState.isTicketIssueModalOpen = true;
    memberHomeState.ticketIssueMemberId = member.id;
    memberHomeState.ticketIssuePetId = member.petId;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  cell.append(button);
  return cell;
}

function getReservationAvailability(member, reservations = []) {
  const overbookedReservationCount = getOverbookedReservationCount(reservations, {
    memberId: member?.memberId || member?.id,
    petId: member?.petId,
  });
  if (Array.isArray(member?.ticketHistories) && member.ticketHistories.length > 0) {
    const availableCount = getActiveTicketReservableCount(member?.ticketHistories) - overbookedReservationCount;
    return {
      state: availableCount < 0 ? "error" : availableCount >= 3 ? "ready" : "warning",
      text: formatMemberReservationAvailability(availableCount),
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
      text: `초과 ${excessReservationCount}회`,
    };
  }

  return {
    state: availableCount <= 2 ? "warning" : "normal",
    text: `${availableCount}회`,
  };
}

function formatMemberReservationAvailability(availability) {
  return availability < 0 ? `초과 ${Math.abs(availability)}회` : `${availability}회`;
}

function getTotalCount(countMap = {}) {
  return Object.values(countMap).reduce((total, value) => {
    const count = Number(value);
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
}

function openMemberDetail(memberHomeState, member) {
  window.location.href = createMemberDetailUrl(member);
}

function createMemberEmptyState(listState) {
  return createEmptyStateElement({
    title: listState === "searchEmpty" ? "검색 결과가 없습니다." : "",
    description: listState === "searchEmpty" ? "" : "등록된 회원이 없습니다",
  });
}

function createMemberTagManagementModal(memberHomeState) {
  const overlay = createElement("section", {
    className: "member-tag-management-overlay",
    dataset: { area: "memberTagManagement", modal: "memberTagManagement", state: "open" },
  });
  const modal = createElement("div", { className: "member-tag-management-modal" });
  const header = createElement("div", { className: "member-tag-management-header" });
  header.append(createElement("h2", { textContent: "태그 관리" }));

  const closeButton = createHeaderIconButton({
    className: "button button--icon modal__close-button",
    icon: "close",
    ariaLabel: "태그 관리 닫기",
    dataset: { action: "closeMemberTagManagement" },
  });
  closeButton.addEventListener("click", () => {
    memberHomeState.isMemberTagManagementOpen = false;
    memberHomeState.memberTagManagementQuery = "";
    memberHomeState.openMemberTagMenuTagName = "";
    memberHomeState.activeMemberTagSheetTagName = "";
    memberHomeState.memberTagSheetDraftName = "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  header.append(closeButton);
  modal.append(header);
  modal.append(createMemberTagManagementSearch(memberHomeState));
  modal.append(createMemberTagManagementList(memberHomeState));
  overlay.append(modal);

  if (memberHomeState.activeMemberTagSheetTagName) {
    overlay.append(createMemberTagEditBottomSheet(memberHomeState));
  }

  return overlay;
}

function createMemberTagManagementSearch(memberHomeState) {
  let isComposing = false;
  const field = createElement("label", {
    className: "member-tag-management-search",
    dataset: { field: "memberTagManagementSearch" },
  });
  const input = createElement("input", {
    className: "member-tag-management-search-input",
    type: "search",
    value: memberHomeState.memberTagManagementQuery || "",
    placeholder: "태그 조회",
    dataset: { field: "memberTagSearch" },
  });
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", (event) => {
    isComposing = false;
    window.setTimeout(() => {
      memberHomeState.memberTagManagementQuery = event.target.value;
      memberHomeState.openMemberTagMenuTagName = "";
      renderMemberHome(document.querySelector("#app"), memberHomeState);
      focusMemberTagManagementSearch();
    }, 0);
  });
  input.addEventListener("input", (event) => {
    memberHomeState.memberTagManagementQuery = event.target.value;
    memberHomeState.openMemberTagMenuTagName = "";

    if (isComposing) {
      syncMemberTagManagementList(memberHomeState);
      return;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);
    focusMemberTagManagementSearch();
  });
  field.append(input);
  return field;
}

function syncMemberTagManagementList(memberHomeState) {
  const list = document.querySelector("[data-area='memberTagManagementList']");
  if (!list) {
    return;
  }

  list.replaceWith(createMemberTagManagementList(memberHomeState));
}

function focusMemberTagManagementSearch() {
  window.setTimeout(() => {
    const input = document.querySelector(".member-tag-management-search-input");
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

function createMemberTagManagementList(memberHomeState) {
  const visibleMemberTags = getVisibleManagedMemberTags(memberHomeState);
  const hasQuery = Boolean(normalizeLookupText(memberHomeState.memberTagManagementQuery));
  const creatableTagName = getCreatableMemberTagName(memberHomeState);
  const canCreateTag = Boolean(creatableTagName);
  const list = createElement("div", {
    className: "member-tag-management-list",
    dataset: {
      area: "memberTagManagementList",
      state: visibleMemberTags.length || canCreateTag ? "list" : hasQuery ? "searchEmpty" : "empty",
    },
  });

  if (!memberHomeState.memberTagCatalog.length && !canCreateTag) {
    list.append(createElement("p", { className: "empty-inline", textContent: "등록된 태그가 없습니다" }));
    return list;
  }

  if (canCreateTag) {
    list.append(createMemberTagCreateRow(memberHomeState, creatableTagName));
  }

  if (!visibleMemberTags.length && !canCreateTag) {
    list.append(createElement("p", { className: "empty-inline", textContent: "검색 결과가 없습니다" }));
    return list;
  }

  visibleMemberTags.forEach((memberTagName) => {
    list.append(createMemberTagManagementRow(memberHomeState, memberTagName));
  });

  return list;
}

function createMemberTagCreateRow(memberHomeState, memberTagName) {
  const row = createElement("button", {
    className: "member-tag-management-row member-tag-management-create-row",
    type: "button",
    textContent: `"${memberTagName}" 추가`,
    dataset: { action: "createMemberTagDraft", entity: "memberTag", entityId: memberTagName },
  });
  row.addEventListener("click", () => {
    applyMemberHomeTagMutation(memberHomeState, createMemberTag(memberTagName), {
      clearQuery: true,
      closeMenu: true,
    });
  });
  return row;
}

function createMemberTagManagementRow(memberHomeState, memberTagName) {
  const row = createElement("div", {
    className: "member-tag-management-row",
    dataset: { entity: "memberTag", entityId: memberTagName, state: "idle" },
  });

  if (isMobileLayout()) {
    row.append(createElement("span", { className: "member-tag-management-name", textContent: memberTagName }));
    row.append(createMemberTagMoreButton(memberHomeState, memberTagName, { presentation: "sheet" }));
    return row;
  }

  const input = createElement("input", {
    className: "member-tag-management-input",
    type: "text",
    value: memberTagName,
    placeholder: "태그명",
    dataset: { field: "memberTag" },
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitMemberHomeTagRename(memberHomeState, memberTagName, event.target.value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.target.value = memberTagName;
      event.target.blur();
    }
  });
  input.addEventListener("blur", (event) => {
    commitMemberHomeTagRename(memberHomeState, memberTagName, event.target.value);
  });
  row.append(input);
  row.append(createMemberTagMoreButton(memberHomeState, memberTagName, { presentation: "menu" }));

  if (memberHomeState.openMemberTagMenuTagName === memberTagName) {
    row.append(createMemberTagOptionMenu(memberHomeState, memberTagName));
  }

  return row;
}

function createMemberTagMoreButton(memberHomeState, memberTagName, options) {
  const button = createElement("button", {
    className: "member-tag-more-button",
    type: "button",
    textContent: "...",
    ariaLabel: `${memberTagName} 태그 더보기`,
    dataset: { action: "openMemberTagOptions", entityId: memberTagName },
  });
  button.addEventListener("click", () => {
    if (options.presentation === "sheet") {
      memberHomeState.activeMemberTagSheetTagName = memberTagName;
      memberHomeState.memberTagSheetDraftName = memberTagName;
      renderMemberHome(document.querySelector("#app"), memberHomeState);
      focusMemberHomeTagSheetInput();
      return;
    }

    memberHomeState.openMemberTagMenuTagName = memberHomeState.openMemberTagMenuTagName === memberTagName ? "" : memberTagName;
    renderMemberHome(document.querySelector("#app"), memberHomeState);
  });
  return button;
}

function createMemberTagOptionMenu(memberHomeState, memberTagName) {
  const menu = createElement("div", {
    className: "member-tag-option-menu",
    dataset: { area: "memberTagOptionMenu", state: "open" },
  });
  const deleteButton = createElement("button", {
    className: "member-tag-option-button",
    type: "button",
    textContent: "삭제",
    dataset: { action: "deleteMemberTag", entityId: memberTagName },
  });
  deleteButton.addEventListener("click", () => {
    applyMemberHomeTagMutation(memberHomeState, deleteMemberTag(memberTagName), {
      closeMenu: true,
      deletedTag: memberTagName,
    });
  });
  menu.append(deleteButton);
  return menu;
}

function createMemberTagEditBottomSheet(memberHomeState) {
  const sourceTag = memberHomeState.activeMemberTagSheetTagName;
  const overlay = createElement("section", {
    className: "member-tag-edit-sheet-overlay",
    dataset: { area: "memberTagEditBottomSheet", modal: "memberTagEditBottomSheet", state: "open" },
  });
  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) {
      return;
    }

    closeMemberHomeTagEditSheet(memberHomeState);
  });

  const sheet = createElement("div", { className: "member-tag-edit-sheet" });
  sheet.append(createElement("div", { className: "member-tag-edit-sheet-handle" }));

  const header = createElement("header", { className: "member-tag-edit-sheet-header" });
  header.append(createElement("span", { className: "member-tag-edit-sheet-spacer" }));
  header.append(createElement("h2", { textContent: sourceTag }));
  const doneButton = createElement("button", {
    className: "button button--text button--text-primary member-tag-edit-done-button",
    type: "button",
    textContent: "완료",
    dataset: { action: "saveMemberTagEdit" },
  });
  header.append(doneButton);
  sheet.append(header);

  const input = createElement("input", {
    className: "member-tag-edit-input",
    type: "text",
    value: memberHomeState.memberTagSheetDraftName || sourceTag,
    placeholder: "태그명",
    dataset: { field: "memberTag" },
  });
  doneButton.addEventListener("click", () => {
    commitMemberHomeTagRename(memberHomeState, sourceTag, input.value, { closeSheet: true });
  });
  sheet.append(input);

  const deleteButton = createElement("button", {
    className: "member-tag-edit-delete-button",
    type: "button",
    textContent: "삭제",
    dataset: { action: "deleteMemberTag", entityId: sourceTag },
  });
  deleteButton.addEventListener("click", () => {
    applyMemberHomeTagMutation(memberHomeState, deleteMemberTag(sourceTag), {
      closeSheet: true,
      deletedTag: sourceTag,
    });
  });
  sheet.append(deleteButton);
  overlay.append(sheet);
  return overlay;
}

function closeMemberHomeTagEditSheet(memberHomeState) {
  memberHomeState.activeMemberTagSheetTagName = "";
  memberHomeState.memberTagSheetDraftName = "";
  renderMemberHome(document.querySelector("#app"), memberHomeState);
}

function focusMemberHomeTagSheetInput() {
  window.setTimeout(() => {
    const input = document.querySelector(".member-tag-edit-input");
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

function commitMemberHomeTagRename(memberHomeState, sourceTag, nextTagName, options = {}) {
  const trimmedTagName = String(nextTagName || "").trim().replace(/\s+/g, " ");
  if (!trimmedTagName) {
    if (options.closeSheet) {
      closeMemberHomeTagEditSheet(memberHomeState);
      return;
    }

    renderMemberHome(document.querySelector("#app"), memberHomeState);
    return;
  }

  applyMemberHomeTagMutation(memberHomeState, renameMemberTag(sourceTag, trimmedTagName), {
    ...options,
    renamedFrom: sourceTag,
    renamedTo: trimmedTagName,
  });
}

function applyMemberHomeTagMutation(memberHomeState, result, options = {}) {
  if (!result.ok) {
    memberHomeState.toastMessage = result.reason === "duplicate"
      ? MEMBER_TAG_DUPLICATE_MESSAGE
      : result.reason === "maxCatalog"
        ? MEMBER_TAG_MAX_CATALOG_MESSAGE
        : "";
    renderMemberHome(document.querySelector("#app"), memberHomeState);
    return;
  }

  memberHomeState.members = result.members;
  memberHomeState.memberTagCatalog = result.memberTagCatalog;

  if (options.renamedFrom) {
    memberHomeState.selectedMemberTagNames = sanitizeTagList(memberHomeState.selectedMemberTagNames.map((selectedTagName) => {
      return normalizeMemberTagName(selectedTagName) === normalizeMemberTagName(options.renamedFrom)
        ? options.renamedTo
        : selectedTagName;
    }));
  }

  if (options.deletedTag) {
    memberHomeState.selectedMemberTagNames = sanitizeTagList(memberHomeState.selectedMemberTagNames.filter((selectedTagName) => {
      return normalizeMemberTagName(selectedTagName) !== normalizeMemberTagName(options.deletedTag);
    }));
  }

  if (options.clearQuery) {
    memberHomeState.memberTagManagementQuery = "";
  }

  if (options.closeMenu) {
    memberHomeState.openMemberTagMenuTagName = "";
  }

  if (options.closeSheet) {
    memberHomeState.activeMemberTagSheetTagName = "";
    memberHomeState.memberTagSheetDraftName = "";
  }

  renderMemberHome(document.querySelector("#app"), memberHomeState);
}

function getCreatableMemberTagName(memberHomeState) {
  const tagName = String(memberHomeState.memberTagManagementQuery || "").trim().replace(/\s+/g, " ");
  const normalizedTagName = normalizeMemberTagName(tagName);

  if (!normalizedTagName) {
    return "";
  }

  const isExistingTag = (memberHomeState.memberTagCatalog || []).some((memberTagName) => {
    return normalizeMemberTagName(memberTagName) === normalizedTagName;
  });

  return isExistingTag ? "" : tagName;
}

function getVisibleManagedMemberTags(memberHomeState) {
  const query = normalizeMemberTagName(memberHomeState.memberTagManagementQuery);
  const memberTags = sortMemberTagNames(memberHomeState.memberTagCatalog || []);

  if (!query) {
    return memberTags;
  }

  return memberTags.filter((memberTagName) => {
    return normalizeMemberTagName(memberTagName).includes(query);
  });
}
