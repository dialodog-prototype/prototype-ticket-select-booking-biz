import { createSchoolReservationTicketSheet } from "../../shared/components/school-reservation-ticket-sheet.js";
import { createEmptyStateElement } from "../../shared/components/empty-state.js";
import { createBusinessNavigation, createDefaultAppBottomNavigation } from "../../shared/components/navigation.js";
import { createReservationSearchFilter } from "../../shared/components/reservation-search-filter.js";
import { createSchoolReservationCancelAlert } from "../../shared/components/school-reservation-cancel-alert.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { createElement } from "../../shared/utils/dom.js";
import { formatMemberWeight } from "../../shared/utils/member-date.js";
import { saveSchoolHomeReservation } from "../../shared/storage/school-home-storage.js";
import { updateTicketHistoryCounters } from "../../shared/storage/member-storage.js";
import { cancelSchoolReservation } from "../../shared/services/school-reservation-cancellation-service.js";
import { getLatestUsedTicketHistoryId, getTicketExpiryDate } from "../../shared/services/ticket-status-service.js";
import {
  createSchoolReservation,
  getPetReservableCount,
  getRegistrationValidation,
  getReservationPet,
  shouldRequireTicketChange,
} from "./school-home-reservation-service.js";
import {
  getCalendarMatrix,
  getDateKey,
  getMonthLabel,
  getFilteredReservationsByDate,
  getSelectedDateSummary,
  getTodayDateKey,
  isSchoolCapacityClosed,
  shiftMonth,
} from "./school-home-state.js";

const DEFAULT_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";
const DAYCARE_ICON_PATH = "../assets/menuIcon_daycare_on.svg";
const SETTING_ICON_PATH = "../assets/menuIcon_setting.svg";
const ALARM_ICON_PATH = "../assets/iconTime.svg";
const PROFILE_ICON_PATH = "../assets/menuIcon_profile.svg";
const SEARCH_ICON_PATH = "../assets/searchIcon.svg";
const CHEVRON_LEFT_ICON_PATH = "../assets/iconChevronLeft.svg";
const CHEVRON_RIGHT_ICON_PATH = "../assets/iconChevronRight.svg";
const DAYOFF_ICON_PATH = "../assets/iconDayoff.svg";
const CALENDAR_ICON_PATH = "../assets/iconCalendar.svg";
const CHECK_ICON_PATH = "../assets/iconCheckCircle.svg";
const RESERVATION_SUCCESS_TOAST_MESSAGE = "예약이 등록되었습니다.";
const TICKET_DEPLETED_TOAST_MESSAGE = "선택한 이용권을 모두 사용했습니다.";
const TICKET_CHANGE_REQUIRED_TOAST_MESSAGE = "계속 등록 후 이용권을 변경해 주세요.";
const HEADER_ICON_ACTIONS = {
  설정: "openSettings",
  알림: "openNotifications",
  계정: "openProfile",
  검색: "openSearch",
};
let schoolHomeToastDismissTimer = null;

export function renderSchoolHome(rootElement, schoolHomeState) {
  rootElement.innerHTML = "";
  rootElement.append(createSchoolHomeScreen(schoolHomeState));
  scheduleSchoolHomeToastDismiss(schoolHomeState);
}

function scheduleSchoolHomeToastDismiss(schoolHomeState) {
  window.clearTimeout(schoolHomeToastDismissTimer);
  if (!schoolHomeState.toastMessage) return;

  schoolHomeToastDismissTimer = window.setTimeout(() => {
    schoolHomeState.toastMessage = "";
    schoolHomeState.toastQueue = [];
    renderSchoolHome(document.querySelector("#app"), schoolHomeState);
  }, TOAST_AUTO_DISMISS_MS);
}

function setSchoolHomeToast(schoolHomeState, messages) {
  const toastQueue = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);
  schoolHomeState.toastMessage = toastQueue.shift() || "";
  schoolHomeState.toastQueue = toastQueue;
}

function rerender(schoolHomeState) {
  renderSchoolHome(document.querySelector("#app"), schoolHomeState);
}

function createSchoolHomeScreen(schoolHomeState) {
  const screen = createElement("main", {
    className: "school-home-screen",
    dataset: { screen: "schoolHome" },
  });
  screen.append(createSchoolHomeWebShell(schoolHomeState));
  screen.append(schoolHomeState.isAppReservationRegisterOpen
    ? schoolHomeState.isAppReservationMemberSearchOpen
        ? createAppReservationMemberSearchScreen(schoolHomeState)
        : createAppReservationRegisterScreen(schoolHomeState)
    : schoolHomeState.isReservationSearchScreenOpen
        ? createReservationSearchAppScreen(schoolHomeState)
        : createSchoolHomeAppShell(schoolHomeState));
  if (schoolHomeState.isReservationRegisterModalOpen) {
    screen.append(createReservationRegisterModal(schoolHomeState));
  }
  if (schoolHomeState.isAppReservationTicketSheetOpen) screen.append(createAppReservationTicketSheet(schoolHomeState));
  const toastMessages = [schoolHomeState.toastMessage, ...(schoolHomeState.toastQueue || [])].filter(Boolean);
  if (toastMessages.length) {
    const toastStack = createElement("div", { className: "toast-stack" });
    toastMessages.forEach((message) => {
      const toast = createToast(message);
      if (schoolHomeState.isAppReservationRegisterOpen) toast.classList.add("toast-popup--app");
      toastStack.append(toast);
    });
    screen.append(toastStack);
  }
  return screen;
}

function createSchoolHomeWebShell(schoolHomeState) {
  const shell = createElement("section", {
    className: "school-home-web-shell",
    dataset: { area: "schoolHomeWeb" },
  });
  shell.append(createWebHeader());

  const content = createElement("div", { className: "school-home-web-layout" });
  content.append(createSchoolNavigation("web"));
  content.append(createSchoolWebContent(schoolHomeState));
  shell.append(content);
  return shell;
}

function createWebHeader() {
  const header = createElement("header", {
    className: "header",
    dataset: { area: "header" },
  });

  header.append(createElement("strong", { className: "brand-name", textContent: "다이얼독 비즈" }));
  header.append(createElement("h1", { textContent: "유치원" }));
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

function createHeaderIconButton(iconPath, label) {
  const button = createElement("button", {
    className: "button button--icon button--icon-header",
    type: "button",
    ariaLabel: label,
    dataset: { action: HEADER_ICON_ACTIONS[label] || "openHeaderAction" },
  });
  button.append(createElement("img", { className: "button__icon", src: iconPath, alt: "" }));
  return button;
}

function createSchoolNavigation(platform) {
  return createBusinessNavigation({
    className: platform === "web" ? "business-navigation school-navigation web" : "school-navigation app",
    dataset: { area: "navigation", platform },
    profile: {
      imageSrc: DEFAULT_PROFILE_IMAGE,
      title: "다이얼독",
      subtitle: "애견유치원",
    },
    footerText: "개인정보 처리방침  이용약관  문의",
    items: [
      { label: "대시보드", href: "./index.html" },
      { label: "유치원", selected: true, href: "./index.html" },
      { label: "호텔링" },
      { label: "알림장" },
      { label: "회원", href: "./member-home.html" },
      { label: "이용권" }
    ]
  });
}
function createSchoolWebContent(schoolHomeState) {
  const content = createElement("section", {
    className: "content",
    dataset: { area: "content", feature: "schoolHome", platform: "web" },
  });
  const titleBar = createElement("div", { className: "page-title" });
  const titleGroup = createElement("div", { className: "page-title__group" });
  titleGroup.append(createElement("h1", { textContent: "유치원" }));
  titleGroup.append(createElement("button", {
    className: "button button--secondary button--capacity",
    type: "button",
    textContent: `정원 ${getSchoolCapacityCount(schoolHomeState)}`,
  }));
  titleBar.append(titleGroup);

  const actions = createElement("div", { className: "page-title__actions" });
  actions.append(createElement("button", {
    className: "button button--primary",
    type: "button",
    textContent: "예약 등록",
  }));
  actions.lastChild.addEventListener("click", () => openReservationRegisterModal(schoolHomeState));
  titleBar.append(actions);

  const sectionGroup = createElement("div", { className: "web-sections", dataset: { area: "webSections", feature: "schoolHome" } });
  sectionGroup.append(createSchoolCalendarPanel(schoolHomeState, "web"));
  sectionGroup.append(createSchoolReservationPanel(schoolHomeState, "web"));

  content.append(titleBar);
  content.append(sectionGroup);
  return content;
}

function createSchoolCalendarPanel(schoolHomeState, platform) {
  const panel = createElement("section", {
    className: "calendar-panel",
    dataset: { area: "calendarPanel", feature: "schoolHome", platform },
  });
  panel.append(createCalendarHeader(schoolHomeState, platform));
  panel.append(createCalendarGrid(schoolHomeState, platform));
  return panel;
}

function createCalendarHeader(schoolHomeState, platform) {
  const header = createElement("div", {
    className: "calendar-header",
    dataset: { area: "calendarHeader", feature: "schoolHome", platform },
  });

  if (platform === "web") {
    const left = createElement("div", { className: "calendar-controls" });
    left.append(createMonthMoveButton("prev", schoolHomeState, "이전 달"));
    left.append(createElement("strong", { className: "calendar-month-label", textContent: getMonthLabel(schoolHomeState.currentMonth) }));
    left.append(createMonthMoveButton("next", schoolHomeState, "다음 달"));

    const todayButton = createElement("button", {
      className: "button button--today",
      type: "button",
      textContent: "오늘",
    });
    todayButton.addEventListener("click", () => {
      resetToInitialView(schoolHomeState);
    });
    left.append(todayButton);
    header.append(left);

    header.append(createReservationSearchFilter(schoolHomeState, {
      className: "reservation-search-filter calendar-search-filter",
      searchInputClassName: "filter-search-input reservation-search-input calendar-search-input",
      rerender,
      onSearchInput: (state) => {
        rerender(state);
      },
    }));
    return header;
  }

  const controls = createElement("div", { className: "calendar-controls", dataset: { platform: "app" } });
  controls.append(createMonthMoveButton("prev", schoolHomeState, "이전 달"));
  controls.append(createElement("strong", { className: "calendar-month-label", textContent: getMonthLabel(schoolHomeState.currentMonth) }));
  controls.append(createMonthMoveButton("next", schoolHomeState, "다음 달"));
  header.append(controls);
  return header;
}

function createAppHeader(schoolHomeState) {
  const header = createElement("header", {
    className: "school-app-header",
    dataset: { area: "header", platform: "app" },
  });

  const searchButton = createHeaderIconButton(SEARCH_ICON_PATH, "검색");
  searchButton.addEventListener("click", () => {
    schoolHomeState.isReservationSearchScreenOpen = true;
    schoolHomeState.isReservationSearchMenuOpen = false;
    rerender(schoolHomeState);
  });
  const appHeaderRow = createElement("div", { className: "school-app-header-row" });
  const left = createElement("div", { className: "school-app-nav-left" });
  const iconBox = createElement("div", { className: "school-app-nav-icon-box" });
  iconBox.append(createElement("img", { src: DAYCARE_ICON_PATH, alt: "" }));
  left.append(iconBox);
  const title = createElement("div", { className: "school-app-nav-title" });
  title.append(createElement("strong", { textContent: "유치원" }));
  title.append(createElement("span", { textContent: `정원 ${getSchoolCapacityCount(schoolHomeState)}` }));
  left.append(title);

  const utility = createElement("div", { className: "school-app-nav-actions" });
  const registerButton = createElement("button", {
    className: "button button--secondary school-app-register-button",
    type: "button",
    textContent: "예약 등록",
  });
  registerButton.addEventListener("click", () => {
    window.location.href = "./school-reservation-registration.html";
  });
  utility.append(registerButton);
  utility.append(searchButton);

  appHeaderRow.append(left);
  appHeaderRow.append(utility);
  header.append(appHeaderRow);
  return header;
}

function createMonthMoveButton(direction, schoolHomeState, label) {
  const button = createElement("button", {
    className: "button button--month",
    type: "button",
    ariaLabel: label,
    dataset: { action: "moveMonth", direction },
  });
  button.append(createElement("img", {
    className: "button__icon button__icon--month",
    src: direction === "prev" ? CHEVRON_LEFT_ICON_PATH : CHEVRON_RIGHT_ICON_PATH,
    alt: "",
  }));
  button.addEventListener("click", () => {
    const nextMonth = shiftMonth(schoolHomeState.currentMonth, direction === "prev" ? -1 : 1);
    schoolHomeState.currentMonth = nextMonth;
    schoolHomeState.selectedDate = `${nextMonth}-01`;
    schoolHomeState.selectedReservationIds = [];
    rerender(schoolHomeState);
  });
  return button;
}

function createCalendarGrid(schoolHomeState, platform) {
  const matrix = getCalendarMatrix(schoolHomeState.currentMonth);
  const grid = createElement("section", {
    className: "calendar-grid",
    dataset: { area: "calendarGrid", feature: "schoolHome", platform },
  });

  const weekHeader = createElement("div", { className: "calendar-weekdays" });
  ["일", "월", "화", "수", "목", "금", "토"].forEach((dayLabel, dayIndex) => {
    weekHeader.append(createElement("span", {
      className: dayIndex === 0 ? "calendar-weekday is-holiday" : "calendar-weekday",
      textContent: dayLabel,
    }));
  });
  grid.append(weekHeader);

  const body = createElement("div", { className: "calendar-body" });
  matrix.forEach((week) => {
    const row = createElement("div", { className: "calendar-row" });
    week.forEach((cell) => {
      row.append(createCalendarDateButton(schoolHomeState, cell, platform));
    });
    body.append(row);
  });
  grid.append(body);
  return grid;
}

function createCalendarDateButton(schoolHomeState, cell, platform) {
  const reservationCount = getFilteredReservationsByDate(schoolHomeState, cell.dateKey)
    .filter((reservation) => reservation.status !== "취소")
    .length;
  const isSelected = cell.dateKey === schoolHomeState.selectedDate;
  const hasReservations = reservationCount > 0;
  const isCapacityClosed = isSchoolCapacityClosed(schoolHomeState, cell.dateKey);
  const classNames = [
    "calendar-date",
    cell.isCurrentMonth ? "" : "is-muted",
    cell.isToday ? "is-today" : "",
    isSelected ? "is-selected" : "",
    cell.isHoliday ? "is-holiday" : "",
    isCapacityClosed ? "is-capacity-closed" : "",
  ].filter(Boolean).join(" ");
  const button = createElement("button", {
    className: classNames,
    type: "button",
    dataset: {
      action: "selectSchoolDate",
      entityId: cell.dateKey,
      state: getCalendarDateState({ isSelected, isHoliday: cell.isHoliday, hasReservations, isCapacityClosed }),
    },
  });

  if (platform === "web") {
    button.append(...createWebCalendarDateContent(cell.dayNumber, reservationCount, cell.isHoliday, cell.isCurrentMonth, isCapacityClosed));
  } else {
    button.append(...createAppCalendarDateContent(cell.dayNumber, reservationCount, getSchoolCapacityCount(schoolHomeState), cell.isHoliday, cell.isCurrentMonth));
  }

  button.addEventListener("click", () => {
    schoolHomeState.currentMonth = `${cell.dateKey.slice(0, 7)}`;
    schoolHomeState.selectedDate = cell.dateKey;
    resetReservationFilters(schoolHomeState);
    schoolHomeState.selectedReservationIds = [];
    rerender(schoolHomeState);
  });

  return button;
}

function createWebCalendarDateContent(dayNumber, reservationCount, isHoliday, isCurrentMonth, isCapacityClosed) {
  const content = [];
  const dateBox = createElement("span", { className: "calendar-date-box" });
  dateBox.append(createElement("span", { className: "calendar-date-number", textContent: String(dayNumber) }));
  content.push(dateBox);

  if (isCapacityClosed) {
    content.push(createCalendarBadge("마감", "calendar-badge is-closed"));
  }

  if (isHoliday && isCurrentMonth) {
    content.push(createElement("span", {
      className: "calendar-meta",
      textContent: reservationCount > 0 ? `휴무 (예약 ${reservationCount}건)` : "휴무",
    }));
    return content;
  }

  if (reservationCount > 0) {
    content.push(createElement("span", {
      className: "calendar-meta",
      textContent: `예약 ${reservationCount}`,
    }));
  }

  return content;
}

function createAppCalendarDateContent(dayNumber, reservationCount, capacityCount, isHoliday, isCurrentMonth) {
  const content = [];
  const dateBox = createElement("span", { className: "calendar-date-box", dataset: { platform: "app" } });
  dateBox.append(createElement("span", { className: "calendar-date-number", textContent: String(dayNumber) }));
  content.push(dateBox);
  content.push(createElement("span", {
    className: `calendar-capacity-text${isHoliday && isCurrentMonth ? " is-holiday" : ""}`,
    textContent: isHoliday && isCurrentMonth ? "휴무" : `${reservationCount}/${capacityCount}`,
  }));
  return content;
}

function createCalendarBadge(label, className) {
  return createElement("span", {
    className,
    textContent: label,
    dataset: { state: "capacityClosed" },
  });
}

function getCalendarDateState({ isSelected, isHoliday, hasReservations, isCapacityClosed }) {
  if (isSelected) {
    return "selected";
  }

  if (isHoliday && hasReservations) {
    return "holidayReserved";
  }

  if (isCapacityClosed && hasReservations) {
    return "capacityClosed";
  }

  if (hasReservations) {
    return "reserved";
  }

  if (isHoliday) {
    return "holiday";
  }

  return "idle";
}

function createSchoolReservationPanel(schoolHomeState, platform) {
  const summary = getSchoolReservationPanelSummary(schoolHomeState, platform);
  const panel = createElement("section", {
    className: platform === "web" ? "school-reservation-panel web" : "school-reservation-panel app",
    dataset: {
      area: "reservationPanel",
      platform,
      state: summary.isHoliday && !summary.hasReservations ? "holiday" : summary.reservations.length > 0 ? "list" : "empty",
    },
  });

  if (platform === "web") {
    const header = createElement("div", { className: "school-reservation-panel-header" });
    const titleGroup = createElement("div", { className: "school-reservation-title-group" });
    const title = createElement("div", { className: "school-reservation-title" });
    const titleRow = createElement("div", { className: "school-reservation-title-row" });
    titleRow.append(createElement("span", { textContent: summary.dateText }));
    if (summary.isCapacityClosed) {
      titleRow.append(createCalendarBadge("마감", "calendar-badge is-closed is-panel"));
    }
    title.append(titleRow);
    title.append(createElement("strong", {
      className: summary.isHoliday ? "school-reservation-count is-holiday" : "school-reservation-count",
      textContent: summary.isHoliday ? "휴무" : `예약 ${summary.reservationCount}`,
    }));
    titleGroup.append(title);
    const cancelButton = createElement("button", {
      className: "school-reservation-cancel-button",
      type: "button",
      textContent: "예약 취소",
    });
    const cancellableReservations = summary.reservations.filter((reservation) => reservation.status !== "취소");
    cancelButton.disabled = !schoolHomeState.selectedReservationIds.some((reservationId) => {
      return cancellableReservations.some((reservation) => reservation.id === reservationId);
    });
    cancelButton.addEventListener("click", () => {
      const alert = createSchoolReservationCancelAlert({
        onConfirm: () => cancelSelectedReservations(schoolHomeState, summary.reservations),
      });
      document.body.append(alert);
    });
    const headerActions = createElement("div", { className: "school-reservation-panel-actions" });
    const hideCancelledLabel = createElement("label", { className: "school-reservation-hide-cancelled" });
    const hideCancelledCheckbox = createElement("input", { type: "checkbox" });
    hideCancelledCheckbox.checked = schoolHomeState.hideCancelledReservations;
    hideCancelledCheckbox.addEventListener("change", () => {
      schoolHomeState.hideCancelledReservations = hideCancelledCheckbox.checked;
      schoolHomeState.selectedReservationIds = [];
      rerender(schoolHomeState);
    });
    hideCancelledLabel.append(hideCancelledCheckbox, createElement("span", { textContent: "취소 목록 숨기기" }));
    header.append(titleGroup);
    headerActions.append(hideCancelledLabel, cancelButton);
    header.append(headerActions);
    panel.append(header);
    panel.append(createWebReservationBody(schoolHomeState, summary));
    return panel;
  }

  const content = createElement("div", { className: "school-app-sheet" });
  const title = createElement("div", { className: "school-app-sheet-title app-reservation-section-header" });
  const titleHeader = createElement("div", { className: "school-app-sheet-title-header" });
  titleHeader.append(createElement("span", { textContent: summary.dateText }));
  title.append(titleHeader);
  title.append(createElement("strong", {
    className: summary.isHoliday ? "school-reservation-count is-holiday" : "school-reservation-count",
    textContent: summary.isHoliday ? "휴무" : `예약 ${summary.reservationCount}`,
  }));
  content.append(title);
  content.append(createAppReservationBody(schoolHomeState, summary));
  panel.append(content);
  return panel;
}

function isPastDateKey(dateKey) {
  return String(dateKey || "") < getTodayDateKey();
}

function getSchoolReservationPanelSummary(schoolHomeState, platform) {
  const isMonthlyMemberSearch = platform === "web" && Boolean(schoolHomeState.selectedReservationMember?.memberId);
  const summary = isMonthlyMemberSearch
    ? getMonthlyMemberReservationSummary(schoolHomeState)
    : getSelectedDateSummary(schoolHomeState);
  const reservations = summary.reservations.filter((reservation) => {
    if (reservation.status !== "취소") return true;
    return platform === "web" && !schoolHomeState.hideCancelledReservations;
  });

  return {
    ...summary,
    reservationCount: reservations.length,
    hasReservations: reservations.length > 0,
    reservations,
    isMonthlyMemberSearch,
  };
}

function getMonthlyMemberReservationSummary(schoolHomeState) {
  const memberId = schoolHomeState.selectedReservationMember.memberId;
  const reservations = (schoolHomeState.reservations || [])
    .filter((reservation) => reservation.memberId === memberId && String(reservation.date || "").slice(0, 7) === schoolHomeState.currentMonth)
    .sort((left, right) => String(left.date || "").localeCompare(String(right.date || "")));

  return {
    dateText: `${getMonthLabel(schoolHomeState.currentMonth)} 예약`,
    reservationCount: reservations.length,
    isHoliday: false,
    isCapacityClosed: false,
    hasReservations: reservations.length > 0,
    reservations,
  };
}

function createPickdropRosterButton(schoolHomeState, platform) {
}

function createWebReservationBody(schoolHomeState, summary) {
  if (summary.isHoliday && !summary.hasReservations) {
    return createHolidayEmptyState("일요일은 휴무입니다.", "휴무 확인용 상태입니다.");
  }

  if (summary.reservations.length === 0 && hasActiveReservationFilters(schoolHomeState)) {
    return createEmptyStateElement({
      title: "등록된 예약이 없습니다.",
    });
  }

  const wrapper = createElement("div", { className: "school-reservation-table-wrapper" });
  const table = createElement("div", {
    className: "school-reservation-table",
    dataset: { state: summary.isMonthlyMemberSearch ? "monthlyMemberSearch" : "daily" },
  });
  const header = createElement("div", { className: "school-reservation-table-row is-header" });
  const allCheckbox = createElement("input", { type: "checkbox" });
  const activeReservations = summary.reservations.filter((reservation) => reservation.status !== "취소");
  allCheckbox.disabled = activeReservations.length === 0;
  allCheckbox.checked = activeReservations.length > 0 && activeReservations.every((reservation) => {
    return schoolHomeState.selectedReservationIds.includes(reservation.id);
  });
  allCheckbox.addEventListener("change", () => {
    schoolHomeState.selectedReservationIds = allCheckbox.checked ? activeReservations.map((reservation) => reservation.id) : [];
    rerender(schoolHomeState);
  });
  const checkboxCell = createElement("label", { className: "school-reservation-checkbox-cell" });
  checkboxCell.append(allCheckbox);
  header.append(checkboxCell);
  ["상태", ...(summary.isMonthlyMemberSearch ? ["예약일"] : []), "반려견", "품종", "예약자"].forEach((labelText) => {
    header.append(createElement("strong", { textContent: labelText }));
  });
  table.append(header);

  if (summary.reservations.length === 0) {
    table.append(createWebReservationPlaceholderRow(hasActiveReservationFilters(schoolHomeState)));
  } else {
    summary.reservations.forEach((reservation) => {
      table.append(createWebReservationRow(schoolHomeState, reservation, summary.isMonthlyMemberSearch));
    });
  }

  wrapper.append(table);
  return wrapper;
}

function createWebReservationPlaceholderRow(isFilteredEmpty = false) {
  const row = createElement("div", {
    className: "school-reservation-table-row school-reservation-table-placeholder-row",
    dataset: { state: "empty" },
  });
  row.append(createElement("span", {
    className: "school-reservation-table-placeholder",
    textContent: "등록된 예약이 없습니다.",
  }));
  return row;
}

function createWebReservationRow(schoolHomeState, reservation, showReservationDate = false) {
  const row = createElement("div", {
    className: "school-reservation-table-row",
    dataset: { entityId: reservation.id, state: schoolHomeState.selectedReservationIds.includes(reservation.id) ? "selected" : "idle" },
  });
  const checkbox = createElement("input", { type: "checkbox" });
  checkbox.disabled = reservation.status === "취소";
  checkbox.checked = schoolHomeState.selectedReservationIds.includes(reservation.id);
  checkbox.addEventListener("change", () => {
    schoolHomeState.selectedReservationIds = checkbox.checked
      ? [...schoolHomeState.selectedReservationIds, reservation.id]
      : schoolHomeState.selectedReservationIds.filter((reservationId) => reservationId !== reservation.id);
    rerender(schoolHomeState);
  });
  const checkboxCell = createElement("label", { className: "school-reservation-checkbox-cell" });
  checkboxCell.append(checkbox);
  row.append(checkboxCell);
  row.append(createElement("span", {
    className: `school-reservation-status${reservation.status === "취소" ? " is-cancelled" : ""}`,
    textContent: reservation.status,
  }));
  if (showReservationDate) row.append(createElement("span", { textContent: reservation.date || "-" }));
  row.append(createElement("span", { textContent: reservation.petName }));
  row.append(createElement("span", { textContent: reservation.breed }));
  row.append(createElement("span", { textContent: reservation.guardianName || "-" }));
  return row;
}

function cancelSelectedReservations(schoolHomeState, reservations) {
  const selectedReservations = reservations.filter((reservation) => {
    return schoolHomeState.selectedReservationIds.includes(reservation.id) && reservation.status !== "취소";
  });

  selectedReservations.forEach((reservation) => {
    const result = cancelSchoolReservation(reservation);
    if (!result.reservation) return;
    schoolHomeState.reservations = schoolHomeState.reservations.map((item) => {
      return item.id === result.reservation.id ? result.reservation : item;
    });
    if (result.members) schoolHomeState.members = result.members;
  });
  schoolHomeState.selectedReservationIds = [];
  setSchoolHomeToast(schoolHomeState, "예약이 취소되었습니다.");
  rerender(schoolHomeState);
}

function createPickdropEditorPopup(schoolHomeState) {
  const reservation = schoolHomeState.reservations.find((item) => item.id === schoolHomeState.editingPickdropReservationId);
  if (!reservation) return createElement("div");
  const currentRecords = schoolHomeState.pickdropReservations.filter((item) => item.daycareReservationId === reservation.id);
  const selections = {
    pickup: currentRecords.some((item) => item.type === "pickup"),
    dropoff: currentRecords.some((item) => item.type === "dropoff"),
  };
  const popup = createElement("section", {
    className: "pickdrop-editor-menu",
    dataset: { area: "pickdropEditor", modal: "pickdropEditor", state: "open" },
  });
  const anchor = schoolHomeState.pickdropEditorAnchor || { top: 80, left: 16 };
  popup.style.top = `${anchor.top}px`;
  popup.style.left = `${anchor.left}px`;

  const options = createElement("div", { className: "pickdrop-editor-options" });
  [["pickup", "픽업"], ["dropoff", "드랍"]].forEach(([type, label]) => {
    const option = createElement("label", { className: "pickdrop-editor-option" });
    const checkbox = createElement("input", { type: "checkbox", dataset: { field: type } });
    checkbox.checked = selections[type];
    checkbox.addEventListener("change", () => {
      selections[type] = checkbox.checked;
      savePickdropEditorSelections(schoolHomeState, reservation, selections);
    });
    option.append(checkbox, createElement("span", { textContent: label }));
    options.append(option);
  });
  popup.append(options);
  window.setTimeout(() => {
    const outsideHandler = (event) => {
      if (!popup.contains(event.target)) closePickdropEditor(schoolHomeState);
    };
    schoolHomeState.pickdropEditorOutsideHandler = outsideHandler;
    document.addEventListener("pointerdown", outsideHandler);
  });
  return popup;
}

function createPickdropRosterModal(schoolHomeState) {
  const rosterDate = schoolHomeState.pickdropRosterDate || schoolHomeState.selectedDate;
  const rosterType = schoolHomeState.pickdropRosterType;
  const rosterCounts = getPickdropRosterCounts(schoolHomeState.pickdropReservations, rosterDate);
  const overlay = createElement("section", {
    className: "pickdrop-roster-overlay",
    dataset: { area: "pickdropRoster", modal: "pickdropRoster", state: "open" },
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePickdropRosterModal(schoolHomeState);
  });
  const modal = createElement("section", { className: "pickdrop-roster-modal" });
  const header = createElement("header", { className: "pickdrop-roster-header" });
  header.append(createElement("h2", { textContent: `픽드랍 명단 · ${rosterCounts.total}` }));
  const closeButton = createElement("button", { className: "button button--icon", type: "button", ariaLabel: "픽드랍 명단 닫기" });
  closeButton.append(createElement("img", { src: "../assets/iconClose.svg", alt: "" }));
  closeButton.addEventListener("click", () => closePickdropRosterModal(schoolHomeState));
  header.append(closeButton);
  modal.append(header);
  modal.append(createPickdropRosterDateNavigation(schoolHomeState, rosterDate));
  modal.append(createPickdropRosterTabs(schoolHomeState, rosterType, rosterCounts));
  modal.append(createPickdropRosterList(schoolHomeState, rosterDate, rosterType));
  if (schoolHomeState.isPickdropRosterCalendarOpen) {
    modal.append(createPickdropRosterCalendar(schoolHomeState));
  }
  overlay.append(modal);
  return overlay;
}

function createAppPickdropRosterScreen(schoolHomeState) {
  const rosterDate = schoolHomeState.pickdropRosterDate || schoolHomeState.selectedDate;
  const rosterType = schoolHomeState.pickdropRosterType;
  const rosterCounts = getPickdropRosterCounts(schoolHomeState.pickdropReservations, rosterDate);
  const screen = createElement("section", {
    className: "school-app-pickdrop-roster-screen",
    dataset: { area: "pickdropRoster", platform: "app" },
  });
  const header = createElement("header", { className: "school-app-reservation-register-header" });
  const backButton = createElement("button", { className: "button button--icon school-app-reservation-register-back", type: "button", ariaLabel: "일정으로" });
  backButton.append(createElement("img", { className: "button__icon", src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => closeAppPickdropRosterScreen(schoolHomeState));
  header.append(backButton, createElement("h1", { textContent: rosterCounts.total ? `픽드랍 명단 (${rosterCounts.total})` : "픽드랍 명단" }), createElement("span", { className: "school-app-reservation-register-spacer" }));

  const body = createElement("main", { className: "school-app-pickdrop-roster-body" });
  body.append(createPickdropRosterDateNavigation(schoolHomeState, rosterDate));
  body.append(createPickdropRosterTabs(schoolHomeState, rosterType, rosterCounts));
  body.append(createPickdropRosterList(schoolHomeState, rosterDate, rosterType));
  if (schoolHomeState.isPickdropRosterCalendarOpen) {
    body.append(createPickdropRosterCalendar(schoolHomeState));
  }
  screen.append(header, body);
  return screen;
}

function createPickdropRosterDateNavigation(schoolHomeState, rosterDate) {
  const navigation = createElement("div", { className: "pickdrop-roster-date-navigation" });
  const previousButton = createElement("button", { className: "button button--month", type: "button", ariaLabel: "전날" });
  previousButton.append(createElement("img", { className: "button__icon button__icon--month", src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  previousButton.addEventListener("click", () => movePickdropRosterDate(schoolHomeState, -1));
  const dateButton = createElement("button", {
    className: "button button--text pickdrop-roster-date-button",
    type: "button",
    textContent: formatReservationDate(rosterDate),
    dataset: { action: "openPickdropRosterCalendar" },
  });
  dateButton.addEventListener("click", () => {
    schoolHomeState.pickdropRosterCalendarMonth = rosterDate.slice(0, 7);
    schoolHomeState.isPickdropRosterCalendarOpen = true;
    rerender(schoolHomeState);
  });
  const nextButton = createElement("button", { className: "button button--month", type: "button", ariaLabel: "다음날" });
  nextButton.append(createElement("img", { className: "button__icon button__icon--month", src: CHEVRON_RIGHT_ICON_PATH, alt: "" }));
  nextButton.addEventListener("click", () => movePickdropRosterDate(schoolHomeState, 1));
  navigation.append(previousButton, dateButton, nextButton);
  return navigation;
}

function getPickdropRosterCounts(pickdropReservations, rosterDate) {
  const getUniquePetCount = (type) => new Set(
    pickdropReservations
      .filter((reservation) => reservation.date === rosterDate && (!type || reservation.type === type))
      .map((reservation) => reservation.petId),
  ).size;

  return {
    total: getUniquePetCount(),
    pickup: getUniquePetCount("pickup"),
    dropoff: getUniquePetCount("dropoff"),
  };
}

function createPickdropRosterTabs(schoolHomeState, rosterType, rosterCounts) {
  const tabs = createElement("div", { className: "pickdrop-roster-tabs", dataset: { state: rosterType } });
  [["pickup", "픽업"], ["dropoff", "드랍"]].forEach(([type, label]) => {
    const button = createElement("button", {
      className: type === rosterType ? "pickdrop-roster-tab is-selected" : "pickdrop-roster-tab",
      type: "button",
      textContent: `${label} ${rosterCounts[type]}`,
      dataset: { action: "selectPickdropRosterType", state: type },
    });
    button.addEventListener("click", () => {
      schoolHomeState.pickdropRosterType = type;
      rerender(schoolHomeState);
    });
    tabs.append(button);
  });
  return tabs;
}

function createPickdropRosterList(schoolHomeState, rosterDate, rosterType) {
  const reservations = schoolHomeState.pickdropReservations.filter((reservation) => {
    return reservation.date === rosterDate && reservation.type === rosterType;
  });
  const list = createElement("div", { className: "pickdrop-roster-list", dataset: { state: reservations.length ? "list" : "empty" } });
  if (!reservations.length) {
    list.append(createElement("p", { className: "pickdrop-roster-empty", textContent: `등록된 ${rosterType === "pickup" ? "픽업" : "드랍"} 예약이 없습니다.` }));
    return list;
  }
  reservations.forEach((reservation) => {
    const item = createElement("article", { className: "pickdrop-roster-item", dataset: { entityId: reservation.id } });
    item.append(createElement("strong", { textContent: reservation.petName }));
    item.append(createElement("span", { textContent: `${reservation.breed} · ${reservation.guardianName}` }));
    list.append(item);
  });
  return list;
}

function createPickdropRosterCalendar(schoolHomeState) {
  const calendar = createElement("section", { className: "pickdrop-roster-calendar" });
  const controls = createElement("div", { className: "pickdrop-roster-calendar-controls" });
  ["prev", "next"].forEach((direction) => {
    const button = createElement("button", { className: "button button--month", type: "button", ariaLabel: direction === "prev" ? "이전 달" : "다음 달" });
    button.append(createElement("img", { className: "button__icon button__icon--month", src: direction === "prev" ? CHEVRON_LEFT_ICON_PATH : CHEVRON_RIGHT_ICON_PATH, alt: "" }));
    button.addEventListener("click", () => {
      schoolHomeState.pickdropRosterCalendarMonth = shiftMonth(schoolHomeState.pickdropRosterCalendarMonth, direction === "prev" ? -1 : 1);
      rerender(schoolHomeState);
    });
    controls.append(button);
    if (direction === "prev") controls.append(createElement("strong", { textContent: getMonthLabel(schoolHomeState.pickdropRosterCalendarMonth) }));
  });
  calendar.append(controls);
  const weekdays = createElement("div", { className: "pickdrop-roster-calendar-weekdays" });
  ["일", "월", "화", "수", "목", "금", "토"].forEach((day) => weekdays.append(createElement("span", { textContent: day })));
  calendar.append(weekdays);
  getCalendarMatrix(schoolHomeState.pickdropRosterCalendarMonth).forEach((week) => {
    const row = createElement("div", { className: "pickdrop-roster-calendar-row" });
    week.forEach((cell) => {
      const button = createElement("button", {
        className: cell.dateKey === schoolHomeState.pickdropRosterDate ? "pickdrop-roster-calendar-date is-selected" : cell.isCurrentMonth ? "pickdrop-roster-calendar-date" : "pickdrop-roster-calendar-date is-muted",
        type: "button",
        textContent: String(cell.dayNumber),
      });
      button.addEventListener("click", () => {
        schoolHomeState.pickdropRosterDate = cell.dateKey;
        schoolHomeState.pickdropRosterCalendarMonth = cell.dateKey.slice(0, 7);
        schoolHomeState.isPickdropRosterCalendarOpen = false;
        rerender(schoolHomeState);
      });
      row.append(button);
    });
    calendar.append(row);
  });
  return calendar;
}

function movePickdropRosterDate(schoolHomeState, offset) {
  const date = new Date(schoolHomeState.pickdropRosterDate);
  date.setDate(date.getDate() + offset);
  schoolHomeState.pickdropRosterDate = getDateKey(date);
  schoolHomeState.pickdropRosterCalendarMonth = schoolHomeState.pickdropRosterDate.slice(0, 7);
  schoolHomeState.isPickdropRosterCalendarOpen = false;
  rerender(schoolHomeState);
}

function closePickdropRosterModal(schoolHomeState) {
  schoolHomeState.isPickdropRosterOpen = false;
  schoolHomeState.isPickdropRosterCalendarOpen = false;
  schoolHomeState.pickdropRosterDate = null;
  schoolHomeState.pickdropRosterCalendarMonth = null;
  rerender(schoolHomeState);
}

function closeAppPickdropRosterScreen(schoolHomeState) {
  schoolHomeState.isAppPickdropRosterOpen = false;
  schoolHomeState.isPickdropRosterCalendarOpen = false;
  schoolHomeState.pickdropRosterDate = null;
  schoolHomeState.pickdropRosterCalendarMonth = null;
  rerender(schoolHomeState);
}

function savePickdropEditorSelections(schoolHomeState, reservation, selections) {
  const member = schoolHomeState.members.find((item) => item.id === reservation.memberId);
  const pet = getReservationPet(member, reservation.petId);
  if (!member || !pet) return;
  const nextRecords = ["pickup", "dropoff"].filter((type) => selections[type]).map((type) => {
    return createPickdropReservation({ member, pet, daycareReservationId: reservation.id, date: reservation.date, type });
  });
  const savedRecords = replacePickdropReservationsForDaycare(reservation.id, nextRecords);
  schoolHomeState.pickdropReservations = [
    ...schoolHomeState.pickdropReservations.filter((item) => item.daycareReservationId !== reservation.id),
    ...savedRecords,
  ];
}

function closePickdropEditor(schoolHomeState) {
  if (schoolHomeState.pickdropEditorOutsideHandler) {
    document.removeEventListener("pointerdown", schoolHomeState.pickdropEditorOutsideHandler);
  }
  schoolHomeState.isPickdropEditorOpen = false;
  schoolHomeState.editingPickdropReservationId = null;
  schoolHomeState.pickdropEditorAnchor = null;
  schoolHomeState.pickdropEditorOutsideHandler = null;
  rerender(schoolHomeState);
}

function createAppReservationBody(schoolHomeState, summary) {
  if (summary.isHoliday && !summary.hasReservations) {
    return createHolidayEmptyState("일요일은 휴무입니다.", "휴무 확인용 상태입니다.");
  }

  if (summary.reservations.length === 0) {
    return createEmptyStateElement({
      title: "등록된 예약이 없습니다.",
    });
  }

  const list = createElement("div", { className: "app-reservation-list", dataset: { feature: "schoolHome", state: "list" } });
  summary.reservations.forEach((reservation) => {
    const item = createElement("article", { className: "app-reservation-item", dataset: { feature: "schoolHome", entityId: reservation.id } });
    item.addEventListener("click", () => {
      window.location.href = `./school-reservation-detail.html?reservationId=${encodeURIComponent(reservation.id)}`;
    });
    item.append(createElement("strong", { textContent: reservation.petName }));
    item.append(createElement("span", { textContent: reservation.breed }));
    const more = createElement("button", {
      className: "button button--icon button--icon-tiny",
      type: "button",
      ariaLabel: `${reservation.petName} 더보기`,
      dataset: { action: "openReservationDetail", entityId: reservation.id },
    });
    more.append(createElement("img", { className: "button__icon", src: CHEVRON_RIGHT_ICON_PATH, alt: "" }));
    item.append(more);
    list.append(item);
  });
  return list;
}

function hasActiveReservationFilters(schoolHomeState) {
  return Boolean(
    String(schoolHomeState.searchTerm || "").trim()
    || (schoolHomeState.selectedMemberTagNames || []).length
  );
}

function createHolidayEmptyState(title, description) {
  const state = createEmptyStateElement({ title, description });
  state.className = "empty-state school-holiday-empty-state";
  const icon = createElement("img", { className: "school-holiday-icon", src: DAYOFF_ICON_PATH, alt: "" });
  state.prepend(icon);
  return state;
}

function openReservationRegisterModal(schoolHomeState) {
  schoolHomeState.reservationRegisterDraft = createReservationRegisterDraft();
  schoolHomeState.isReservationRegisterModalOpen = true;
  schoolHomeState.isPickdropReservationModalOpen = false;
  rerender(schoolHomeState);
}

function openAppReservationRegisterScreen(schoolHomeState) {
  schoolHomeState.reservationRegisterDraft = createReservationRegisterDraft();
  schoolHomeState.isAppReservationRegisterOpen = true;
  schoolHomeState.isAppReservationMemberSearchOpen = false;
  schoolHomeState.isAppReservationTicketSheetOpen = false;
  schoolHomeState.isAppPickdropReservationOpen = false;
  schoolHomeState.isReservationRegisterModalOpen = false;
  schoolHomeState.isPickdropReservationModalOpen = false;
  rerender(schoolHomeState);
}

function createReservationRegisterDraft({ memberId = "", petId = "" } = {}) {
  return {
    memberId,
    petId,
    ticketId: "",
    query: "",
    currentMonth: getTodayDateKey().slice(0, 7),
    selectedDates: [],
    ticketInitialCounts: {},
    allowOverLimit: false,
    pickdropSelections: [],
  };
}

function closeAppReservationRegisterScreen(schoolHomeState) {
  if (schoolHomeState.isStandaloneAppReservationRegistration) {
    window.location.href = "./index.html";
    return;
  }
  schoolHomeState.isAppReservationRegisterOpen = false;
  schoolHomeState.isAppReservationMemberSearchOpen = false;
  schoolHomeState.isAppReservationTicketSheetOpen = false;
  schoolHomeState.isAppPickdropReservationOpen = false;
  schoolHomeState.reservationRegisterDraft = null;
  rerender(schoolHomeState);
}

function createAppReservationRegisterScreen(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const screen = createElement("section", {
    className: "school-app-reservation-register-screen",
    dataset: { area: "schoolReservationRegister", platform: "app" },
  });
  const header = createElement("header", { className: "school-app-reservation-register-header" });
  const backButton = createElement("button", {
    className: "button button--icon school-app-reservation-register-back",
    type: "button",
    ariaLabel: "유치원 예약 등록 닫기",
  });
  backButton.append(createElement("img", { className: "button__icon", src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => closeAppReservationRegisterScreen(schoolHomeState));
  header.append(backButton, createElement("h1", { textContent: "유치원 예약 등록" }), createElement("span", { className: "school-app-reservation-register-spacer" }));
  const body = createElement("main", { className: "school-app-reservation-register-body" });
  body.append(createAppReservationMemberField(schoolHomeState, draft));
  body.append(createReservationTicketField(schoolHomeState, draft, { isAppRegistration: true }));
  body.append(createReservationDateField(schoolHomeState, draft, { isAppRegistration: true }));
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  const footer = member && pet
    ? createReservationRegistrationFooter(schoolHomeState, draft, { isAppRegistration: true })
    : null;
  screen.append(header, body);
  if (footer) screen.append(footer);
  return screen;
}

function createAppReservationMemberField(schoolHomeState, draft) {
  const field = createElement("section", { className: "school-registration-field school-registration-member-field school-app-reservation-member-field" });
  field.append(createElement("h3", { textContent: "회원" }));
  const { member, pet } = getAppReservationMemberPet(schoolHomeState, draft);
  const input = createElement("input", {
    className: "school-registration-member-search",
    type: "search",
    value: member && pet ? getReservationMemberOptionText(member, pet) : "",
    placeholder: "반려견 / 보호자 검색",
    readOnly: true,
    dataset: { action: "openAppReservationMemberSearch" },
  });
  input.addEventListener("click", () => {
    schoolHomeState.isAppReservationMemberSearchOpen = true;
    rerender(schoolHomeState);
  });
  field.append(input);
  return field;
}

function createAppReservationMemberSearchScreen(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const screen = createElement("section", {
    className: "school-app-reservation-member-search-screen",
    dataset: { area: "schoolReservationMemberSearch", platform: "app" },
  });
  const searchBar = createElement("div", { className: "school-app-reservation-member-search-bar" });
  const backButton = createElement("button", { className: "button button--icon", type: "button", ariaLabel: "유치원 예약 등록으로" });
  backButton.append(createElement("img", { className: "button__icon", src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => {
    schoolHomeState.isAppReservationMemberSearchOpen = false;
    rerender(schoolHomeState);
  });
  const queryInput = createElement("input", {
    className: "school-app-reservation-member-search-input",
    type: "search",
    value: draft.query || "",
    placeholder: "반려견 / 보호자 검색",
    dataset: { field: "appReservationMemberSearch" },
  });
  let isComposing = false;
  queryInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  queryInput.addEventListener("compositionend", () => {
    isComposing = false;
    draft.query = queryInput.value;
    rerender(schoolHomeState);
  });
  queryInput.addEventListener("input", () => {
    draft.query = queryInput.value;
    if (isComposing) return;
    rerender(schoolHomeState);
    requestAnimationFrame(() => document.querySelector('[data-field="appReservationMemberSearch"]')?.focus());
  });
  const clearButton = createElement("button", { className: "school-app-reservation-member-search-clear", type: "button", textContent: "×", ariaLabel: "검색어 지우기" });
  clearButton.hidden = !draft.query;
  clearButton.addEventListener("click", () => {
    draft.query = "";
    rerender(schoolHomeState);
    requestAnimationFrame(() => document.querySelector('[data-field="appReservationMemberSearch"]')?.focus());
  });
  searchBar.append(backButton, queryInput, clearButton);
  screen.append(searchBar);

  const normalizedQuery = String(draft.query || "").trim().toLowerCase();
  const results = schoolHomeState.members.flatMap((member) => (member.pets || []).map((pet) => ({ member, pet })))
    .filter(({ member, pet }) => !normalizedQuery || [member.guardianName, pet.petName || pet.dogName]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));
  const list = createElement("div", { className: "school-app-reservation-member-result-list", dataset: { state: results.length ? "list" : "empty" } });
  results.forEach(({ member, pet }) => {
    const button = createElement("button", {
      className: "school-app-reservation-member-result",
      type: "button",
      textContent: getReservationMemberOptionText(member, pet),
    });
    button.addEventListener("click", () => {
      draft.memberId = member.id;
      draft.petId = pet.id;
      draft.ticketId = getDefaultReservationTicket(pet, schoolHomeState.reservations, member.id, pet.id)?.id || "";
      draft.query = "";
      draft.selectedDates = [];
      draft.allowOverLimit = false;
      draft.ticketInitialCounts = getReservationTicketInitialCounts(pet);
      schoolHomeState.isAppReservationMemberSearchOpen = false;
      rerender(schoolHomeState);
    });
    list.append(button);
  });
  if (!results.length) list.append(createElement("p", { className: "school-app-reservation-member-result-empty", textContent: "검색 결과가 없습니다." }));
  screen.append(list);
  requestAnimationFrame(() => document.querySelector('[data-field="appReservationMemberSearch"]')?.focus());
  return screen;
}

function getAppReservationMemberPet(schoolHomeState, draft) {
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  return { member, pet };
}

function closeReservationRegisterModal(schoolHomeState) {
  if (schoolHomeState.isStandaloneAppReservationRegistration) {
    window.location.href = "./index.html";
    return;
  }
  schoolHomeState.isReservationRegisterModalOpen = false;
  schoolHomeState.isAppReservationRegisterOpen = false;
  schoolHomeState.isAppReservationMemberSearchOpen = false;
  schoolHomeState.isAppPickdropReservationOpen = false;
  schoolHomeState.isPickdropReservationModalOpen = false;
  schoolHomeState.reservationRegisterDraft = null;
  rerender(schoolHomeState);
}

function createReservationRegisterModal(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const overlay = createElement("section", {
    className: "school-registration-modal-overlay",
    dataset: { area: "schoolReservationRegisterModal", modal: "schoolReservationRegister", state: "open" },
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeReservationRegisterModal(schoolHomeState);
  });

  const modal = createElement("div", { className: "school-registration-modal" });
  const header = createElement("header", { className: "school-registration-modal-header" });
  header.append(createElement("h2", { textContent: "예약 등록" }));
  const closeButton = createElement("button", {
    className: "button button--icon school-registration-close-button",
    type: "button",
    ariaLabel: "예약 등록 닫기",
    dataset: { action: "closeSchoolReservationRegister" },
  });
  closeButton.append(createElement("img", { src: "../assets/iconClose.svg", alt: "" }));
  closeButton.addEventListener("click", () => closeReservationRegisterModal(schoolHomeState));
  header.append(closeButton);
  modal.append(header);
  modal.append(createReservationMemberField(schoolHomeState, draft));
  modal.append(createReservationTicketField(schoolHomeState, draft));
  modal.append(createReservationDateField(schoolHomeState, draft));
  modal.append(createReservationRegistrationFooter(schoolHomeState, draft));
  overlay.append(modal);
  return overlay;
}

function createReservationMemberField(schoolHomeState, draft) {
  const field = createElement("section", { className: "school-registration-field school-registration-field--horizontal school-registration-member-field" });
  field.append(createElement("h3", { textContent: "회원" }));
  const searchWrap = createElement("div", { className: "school-registration-member-search-wrap" });
  const selectedMember = schoolHomeState.members.find((member) => member.id === draft.memberId);
  const selectedPet = getReservationPet(selectedMember, draft.petId);
  const selectedMemberText = selectedMember && selectedPet
    ? getReservationMemberOptionText(selectedMember, selectedPet)
    : "";
  const searchInput = createElement("input", {
    className: "school-registration-member-search",
    type: "search",
    value: draft.query || selectedMemberText,
    placeholder: "반려견 또는 보호자 검색",
    dataset: { field: "memberSearch" },
  });
  searchInput.addEventListener("focus", () => {
    if (!draft.query) searchInput.value = "";
  });
  searchInput.addEventListener("input", () => {
    draft.query = searchInput.value;
    rerender(schoolHomeState);
    requestAnimationFrame(() => document.querySelector('[data-field="memberSearch"]')?.focus());
  });
  searchInput.addEventListener("blur", (event) => {
    if (!draft.query && !searchWrap.contains(event.relatedTarget)) rerender(schoolHomeState);
  });
  searchWrap.append(searchInput);

  const normalizedQuery = String(draft.query || "").trim().toLowerCase();
  const memberOptions = schoolHomeState.members.flatMap((member) => (member.pets || []).map((pet) => ({ member, pet })))
    .filter(({ member, pet }) => {
      if (!normalizedQuery) return true;
      return [member.guardianName, pet.petName || pet.dogName]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  const memberList = createElement("div", { className: "school-registration-member-list", dataset: { area: "reservationMemberOptions" } });
  memberOptions.forEach(({ member, pet }) => {
    const button = createElement("button", {
      className: member.id === draft.memberId && pet.id === draft.petId ? "school-registration-member-option is-selected" : "school-registration-member-option",
      type: "button",
      textContent: getReservationMemberOptionText(member, pet),
      dataset: { action: "selectReservationMember", entityId: member.id, petId: pet.id },
    });
    button.addEventListener("click", () => {
      draft.memberId = member.id;
      draft.petId = pet.id;
      draft.query = "";
      draft.selectedDates = [];
      draft.ticketId = getDefaultReservationTicket(pet, schoolHomeState.reservations, member.id, pet.id)?.id || "";
      draft.allowOverLimit = false;
      draft.ticketInitialCounts = getReservationTicketInitialCounts(pet);
      rerender(schoolHomeState);
    });
    memberList.append(button);
  });
  if (!memberOptions.length) {
    memberList.append(createElement("p", { className: "school-registration-member-empty", textContent: "검색 결과가 없습니다." }));
  }
  searchWrap.append(memberList);

  field.append(searchWrap);
  return field;
}

function getReservationMemberOptionText(member, pet) {
  const petName = pet?.petName || pet?.dogName || "반려견 없음";
  const breed = pet?.breed || "견종 미입력";
  const formattedWeight = formatMemberWeight(pet?.weight);
  const weight = formattedWeight === "-" ? "-kg" : formattedWeight;
  return `${petName}(${breed}) / ${weight} / ${member?.guardianName || "보호자 미입력"}`;
}

function getAvailableReservationTickets(pet) {
  return (pet?.ticketHistories || []).filter((ticket) => getTicketReservableCount(ticket) > 0);
}

function getReservationTicketInitialCounts(pet) {
  return getAvailableReservationTickets(pet).reduce((counts, ticket) => {
    counts[ticket.id] = getTicketReservableCount(ticket);
    return counts;
  }, {});
}

function getTicketReservableCount(ticket) {
  return Number(ticket?.reservableCount ?? ticket?.remainingCount) || 0;
}

function getDefaultReservationTicket(pet, reservations = [], memberId = "", petId = "") {
  const tickets = getAvailableReservationTickets(pet);
  const latestTicketHistoryId = getLatestUsedTicketHistoryId(reservations, { memberId, petId });
  const latestTicket = tickets.find((ticket) => ticket.id === latestTicketHistoryId);
  if (latestTicket) return latestTicket;

  return [...tickets].sort((a, b) => {
    const aTime = Date.parse(a.expiresAt || "") || Number.MAX_SAFE_INTEGER;
    const bTime = Date.parse(b.expiresAt || "") || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  })[0] || null;
}

function getReservationTicketLabel(ticket) {
  if (!ticket) return "사용 가능한 이용권이 없습니다.";
  return `${ticket.ticketName || "이용권"} · ${getTicketReservableCount(ticket)}회 남음`;
}

function getReservationTicketDraftRemainingLabel(draft, ticket) {
  if (!ticket) return "사용 가능한 이용권이 없습니다.";
  return `${getReservationTicketName(ticket)} · ${getDraftTicketInitialCount(draft, ticket)}회 남음`;
}

function getDraftTicketRemainingCount(draft, ticket) {
  const selectedCount = draft.ticketId === ticket?.id ? draft.selectedDates.length : 0;
  return Math.max(getTicketReservableCount(ticket) - selectedCount, 0);
}

function getDraftTicketInitialCount(draft, ticket) {
  const ticketId = ticket?.id;
  if (ticketId && Object.prototype.hasOwnProperty.call(draft.ticketInitialCounts || {}, ticketId)) {
    return draft.ticketInitialCounts[ticketId];
  }
  return getTicketReservableCount(ticket);
}

function getReservationTicketValidityLabel(schoolHomeState, draft, pet, ticket) {
  const explicitExpiryDate = ticket?.expiresAt ? new Date(ticket.expiresAt) : null;
  const expiryDate = explicitExpiryDate && !Number.isNaN(explicitExpiryDate.getTime())
    ? explicitExpiryDate
    : getTicketExpiryDate(ticket, schoolHomeState.reservations, {
      memberId: draft.memberId,
      petId: draft.petId,
      ticketHistories: pet?.ticketHistories || [],
    });

  if (!expiryDate) return ticket?.unlimitedValidity ? "무제한" : "유효기간 미정";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
  const remainingDays = Math.max(Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)), 0);
  return `${remainingDays}일 남음`;
}

function selectReservationTicket(draft, ticketId) {
  if (draft.ticketId === ticketId) return;
  draft.ticketId = ticketId;
  draft.selectedDates = [];
  draft.allowOverLimit = false;
}

function getReservationTicketName(ticket, pet) {
  if (ticket?.isOverbooked) return "초과";
  if (ticket?.ticketName || ticket?.name) return ticket.ticketName || ticket.name;
  return pet?.ticketHistories?.find((item) => item.id === ticket?.ticketId)?.ticketName || "";
}

function createReservationTicketField(schoolHomeState, draft, { isAppRegistration = false } = {}) {
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  const tickets = getAvailableReservationTickets(pet);
  const field = createElement("section", {
    className: `school-registration-field${isAppRegistration ? " school-app-reservation-ticket-field" : " school-registration-field--horizontal"} school-registration-ticket-field`,
    dataset: { state: member && pet ? (tickets.length ? "available" : "empty") : "memberRequired" },
  });
  field.append(createElement("h3", { textContent: "이용권" }));
  const selected = tickets.find((ticket) => ticket.id === draft.ticketId)
    || getDefaultReservationTicket(pet, schoolHomeState.reservations, draft.memberId, draft.petId);
  if (selected && !draft.ticketId) draft.ticketId = selected.id;

  if (isAppRegistration) {
    const button = createElement("button", {
      className: `school-registration-ticket-trigger${!member || !pet || !selected ? " is-placeholder" : ""}`,
      type: "button",
      textContent: member && pet ? getReservationTicketDraftRemainingLabel(draft, selected) : "회원을 먼저 선택해 주세요",
    });
    button.disabled = !member || !pet || !tickets.length;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      schoolHomeState.isAppReservationTicketSheetOpen = true;
      rerender(schoolHomeState);
    });
    field.append(button);
    return field;
  }

  const list = createElement("div", { className: "school-registration-ticket-list" });
  if (!member || !pet) {
    list.append(createElement("p", { className: "school-registration-ticket-empty", textContent: "회원을 먼저 선택해 주세요." }));
  } else if (!tickets.length) {
    list.append(createElement("p", { className: "school-registration-ticket-empty", textContent: "사용 가능한 이용권이 없습니다." }));
  } else {
    tickets.forEach((ticket) => {
      const option = createElement("button", {
        className: `school-registration-ticket-option${ticket.id === selected?.id ? " is-selected" : ""}`,
        type: "button",
      });
      option.setAttribute("aria-pressed", String(ticket.id === selected?.id));
      option.append(
        createElement("strong", { className: "school-registration-ticket-option__name", textContent: getReservationTicketName(ticket) }),
        createElement("span", { className: "school-registration-ticket-option__count", textContent: `${getDraftTicketInitialCount(draft, ticket)}회 선택 가능` }),
        createElement("span", { className: "school-registration-ticket-option__validity", textContent: getReservationTicketValidityLabel(schoolHomeState, draft, pet, ticket) }),
      );
      option.disabled = getDraftTicketRemainingCount(draft, ticket) === 0;
      option.addEventListener("click", () => {
        selectReservationTicket(draft, ticket.id);
        rerender(schoolHomeState);
      });
      list.append(option);
    });
  }
  field.append(list);
  return field;
}

function createAppReservationTicketSheet(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  const tickets = getAvailableReservationTickets(pet);
  return createSchoolReservationTicketSheet({
    tickets,
    selectedId: draft.ticketId,
    getLabel: (ticket) => getReservationTicketDraftRemainingLabel(draft, ticket),
    isDisabled: (ticket) => getDraftTicketRemainingCount(draft, ticket) === 0,
    onSelect: (ticket) => {
      selectReservationTicket(draft, ticket.id);
      schoolHomeState.isAppReservationTicketSheetOpen = false;
      rerender(schoolHomeState);
    },
    onClose: () => {
      schoolHomeState.isAppReservationTicketSheetOpen = false;
      rerender(schoolHomeState);
    },
  });
}

function createReservationDateField(schoolHomeState, draft, { isAppRegistration = false } = {}) {
  const field = createElement("section", { className: "school-registration-field school-registration-date-field" });
  const title = createElement("h3", { textContent: "날짜" });
  const selectedMember = schoolHomeState.members.find((member) => member.id === draft.memberId);
  const selectedPet = getReservationPet(selectedMember, draft.petId);
  const availableTickets = getAvailableReservationTickets(selectedPet);
  const selectedTicket = availableTickets.find((ticket) => ticket.id === draft.ticketId)
    || getTicketHistoryById(selectedPet, draft.ticketId);
  const hasSelectedMemberPet = Boolean(selectedMember && selectedPet);
  const isMemberSelected = hasSelectedMemberPet;
  const controls = createElement("div", { className: "school-registration-month-controls" });
  ["prev", "next"].forEach((direction) => {
    const button = createElement("button", {
      className: "button button--month",
      type: "button",
      ariaLabel: direction === "prev" ? "이전 달" : "다음 달",
    });
    button.append(createElement("img", {
      className: "button__icon button__icon--month",
      src: direction === "prev" ? CHEVRON_LEFT_ICON_PATH : CHEVRON_RIGHT_ICON_PATH,
      alt: "",
    }));
    button.disabled = !isMemberSelected;
    button.addEventListener("click", () => {
      draft.currentMonth = shiftMonth(draft.currentMonth, direction === "prev" ? -1 : 1);
      rerender(schoolHomeState);
    });
    controls.append(button);
    if (direction === "prev") controls.append(createElement("strong", { textContent: getMonthLabel(draft.currentMonth) }));
  });
  if (isAppRegistration) {
    field.append(title, controls);
  } else {
    const header = createElement("div", { className: "school-registration-date-header" });
    header.append(title, controls);
    field.append(header);
  }

  const calendar = createElement("div", {
    className: "school-registration-calendar",
    dataset: { state: isMemberSelected ? "enabled" : "disabled" },
  });
  const weekdays = createElement("div", { className: "school-registration-weekdays" });
  ["일", "월", "화", "수", "목", "금", "토"].forEach((label) => weekdays.append(createElement("span", { textContent: label })));
  calendar.append(weekdays);
  const body = createElement("div", { className: "school-registration-calendar-body" });
  getCalendarMatrix(draft.currentMonth).forEach((week) => {
    const row = createElement("div", { className: "school-registration-calendar-row" });
    week.forEach((cell) => {
      const existingReservation = hasSelectedMemberPet && schoolHomeState.reservations.find((reservation) => {
        return reservation.status !== "취소"
          && reservation.memberId === selectedMember.id
          && reservation.petId === selectedPet.id
          && reservation.date === cell.dateKey;
      });
      const isAlreadyReserved = Boolean(existingReservation);
      const isPastReservation = isAlreadyReserved && isPastDateKey(cell.dateKey);
      const unavailable = !cell.isCurrentMonth || isSchoolCapacityClosed(schoolHomeState, cell.dateKey);
      const isSelected = draft.selectedDates.includes(cell.dateKey);
      const activeTicket = getTicketHistoryById(selectedPet, draft.ticketId) || selectedTicket;
      const ticketCapacity = getTicketReservableCount(activeTicket);
      const selectedDateIndex = draft.selectedDates.indexOf(cell.dateKey);
      const usesSelectedTicket = isSelected && Boolean(draft.ticketId) && selectedDateIndex < ticketCapacity;
      const isOverbookedSelection = isSelected && !usesSelectedTicket;
      const isChecked = isSelected || (!isAppRegistration && isAlreadyReserved);
      const isDateDisabled = !isMemberSelected
        || unavailable
        || isAlreadyReserved;
      const dateButton = createElement("button", {
        className: ["school-registration-date", !cell.isCurrentMonth ? "is-muted" : "", isPastReservation ? "is-past" : "", unavailable ? "is-unavailable" : "", isDateDisabled ? "is-disabled" : "", isChecked ? "is-checked" : "", isOverbookedSelection || existingReservation?.isOverbooked ? "is-overbooked" : "", isAlreadyReserved ? "is-reserved" : ""].filter(Boolean).join(" "),
        type: "button",
        dataset: { action: "toggleReservationDate", entityId: cell.dateKey, state: !isMemberSelected ? "disabled" : isAlreadyReserved ? "reserved" : unavailable ? "unavailable" : isSelected ? "selected" : "idle" },
      });
      dateButton.disabled = isDateDisabled;
      dateButton.append(createElement("span", { className: "school-registration-date-number", textContent: String(cell.dayNumber) }));
      if (cell.isHoliday && cell.isCurrentMonth && !(isAppRegistration && isOverbookedSelection)) {
        dateButton.append(createElement("span", { className: "school-registration-date-holiday", textContent: "휴무" }));
      }
      if (!isAppRegistration) {
        const shouldShowCheck = isChecked;
        if (shouldShowCheck) {
          dateButton.append(createElement("img", {
            className: "school-registration-date-check",
            src: CHECK_ICON_PATH,
            alt: "",
            ariaLabel: isAlreadyReserved ? "예약된 날짜" : "선택된 날짜",
          }));
        }
      }
      dateButton.addEventListener("click", () => {
        if (isSelected) {
          draft.selectedDates = draft.selectedDates.filter((date) => date !== cell.dateKey);
        } else if (shouldRequireTicketChange({
          selectedDateCount: draft.selectedDates.length,
          selectedTicket: activeTicket,
          availableTickets,
        })) {
          setSchoolHomeToast(schoolHomeState, TICKET_CHANGE_REQUIRED_TOAST_MESSAGE);
        } else {
          draft.selectedDates = [...draft.selectedDates, cell.dateKey].sort();
        }
        rerender(schoolHomeState);
      });
      row.append(dateButton);
    });
    body.append(row);
  });
  calendar.append(body);
  field.append(calendar);
  return field;
}

function getTicketHistoryById(pet, ticketId) {
  return (pet?.ticketHistories || []).find((ticket) => ticket.id === ticketId || ticket.ticketId === ticketId) || null;
}

function createReservationRegistrationFooter(schoolHomeState, draft, { isAppRegistration = false } = {}) {
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  const totalCount = getPetReservableCount(pet);
  const selectedCount = draft.selectedDates.length;
  const isOverLimit = selectedCount > totalCount;
  const availableTickets = getAvailableReservationTickets(pet);
  const selectedTicket = getTicketHistoryById(pet, draft.ticketId);
  const ticketCapacity = getTicketReservableCount(selectedTicket);
  const hasTicketAllocation = Boolean(draft.ticketId) && draft.selectedDates.some((date) => draft.selectedDates.indexOf(date) < ticketCapacity);
  const hasOverbookedSelection = draft.selectedDates.some((date) => draft.selectedDates.indexOf(date) >= ticketCapacity);
  const isTicketSelected = !selectedTicket || hasTicketAllocation || hasOverbookedSelection;
  const validation = getRegistrationValidation({
    member,
    pet,
    ticketSelected: isTicketSelected,
    selectedDates: draft.selectedDates,
    reservations: schoolHomeState.reservations,
    capacityClosedDates: schoolHomeState.capacityClosedDates,
    allowOverLimit: true,
  });
  const canContinueRegistration = validation.isValid && availableTickets.length > 1;
  const footer = createElement("footer", {
    className: ["school-registration-footer", isAppRegistration ? "school-app-reservation-registration-footer" : ""].filter(Boolean).join(" "),
  });
  const count = createElement("div", { className: isOverLimit ? "school-registration-count is-error" : "school-registration-count" });
  count.append(createElement("strong", { textContent: "예약 횟수" }));
  count.append(createElement("span", { textContent: ` ${selectedCount} / ${totalCount}회` }));
  if (isOverLimit && !isAppRegistration) {
    count.append(createElement("em", { textContent: `${selectedCount - totalCount}회 초과` }));
  }
  footer.append(count);
  const actions = createElement("div", { className: "school-registration-actions modal-footer-actions" });
  const continueButton = createElement("button", {
    className: "button button--secondary school-registration-continue-button",
    type: "button",
    textContent: "계속 등록",
    dataset: { action: "continueSchoolReservation", state: canContinueRegistration ? "enabled" : "disabled" },
  });
  continueButton.disabled = !canContinueRegistration;
  continueButton.addEventListener("click", () => {
    if (!canContinueRegistration) return;
    submitSchoolReservations(schoolHomeState, draft, { preserveMember: true });
  });
  const submitButton = createElement("button", {
    className: [
      "button",
      "button--primary",
      "school-registration-submit-button",
      isOverLimit ? "button--danger" : "",
    ].filter(Boolean).join(" "),
    type: "button",
    textContent: isOverLimit ? "초과 등록" : "등록",
    dataset: { action: "submitSchoolReservation", state: validation.isValid ? "enabled" : "disabled" },
  });
  submitButton.disabled = !validation.isValid;
  submitButton.addEventListener("click", () => {
    if (!validation.isValid) return;
    submitSchoolReservations(schoolHomeState, draft);
  });
  actions.append(continueButton, submitButton);
  footer.append(actions);
  return footer;
}

function createPickdropReservationModal(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const overlay = createElement("section", {
    className: "pickdrop-registration-modal-overlay",
    dataset: { area: "pickdropReservationModal", modal: "pickdropReservation", state: "open" },
  });
  const modal = createElement("div", { className: "pickdrop-registration-modal" });
  const header = createElement("header", { className: "pickdrop-registration-modal-header" });
  header.append(createElement("h2", { textContent: "픽드랍 예약" }));
  const closeButton = createElement("button", {
    className: "button button--icon pickdrop-registration-close-button",
    type: "button",
    ariaLabel: "픽드랍 예약 닫기",
  });
  closeButton.append(createElement("img", { src: "../assets/iconClose.svg", alt: "" }));
  closeButton.addEventListener("click", () => {
    closeReservationRegisterModal(schoolHomeState);
  });
  header.append(closeButton);
  modal.append(header);

  const body = createElement("section", { className: "pickdrop-registration-modal-body" });
  const selectedMember = schoolHomeState.members.find((member) => member.id === draft.memberId);
  const selectedPet = getReservationPet(selectedMember, draft.petId);
  body.append(createElement("p", {
    className: "pickdrop-registration-selected-member",
    textContent: getReservationMemberOptionText(selectedMember, selectedPet),
  }));
  const allSelected = draft.pickdropSelections.length > 0 && draft.pickdropSelections.every((selection) => selection.pickup && selection.dropoff);
  const allOption = createElement("label", {
    className: "pickdrop-registration-all-option",
    dataset: { action: "toggleAllPickdrop", state: allSelected ? "selected" : "idle" },
  });
  const allCheckbox = createElement("input", { type: "checkbox", dataset: { field: "allPickdrop" } });
  allCheckbox.checked = allSelected;
  allCheckbox.addEventListener("change", () => {
    draft.pickdropSelections = draft.pickdropSelections.map((selection) => ({
      ...selection,
      pickup: allCheckbox.checked,
      dropoff: allCheckbox.checked,
    }));
    rerender(schoolHomeState);
  });
  allOption.append(allCheckbox, createElement("span", { textContent: "전체 선택" }));
  body.append(allOption);

  const list = createElement("div", { className: "pickdrop-registration-date-list" });
  draft.pickdropSelections.forEach((selection) => {
    const row = createElement("article", { className: "pickdrop-registration-date-row", dataset: { entityId: selection.date } });
    row.append(createElement("strong", { textContent: formatReservationDate(selection.date) }));
    row.append(createPickdropTypeCheckbox(schoolHomeState, draft, selection, "pickup", "픽업"));
    row.append(createPickdropTypeCheckbox(schoolHomeState, draft, selection, "dropoff", "드랍"));
    list.append(row);
  });
  body.append(list);
  modal.append(body);

  const footer = createElement("footer", { className: "pickdrop-registration-modal-footer modal-footer-actions" });
  const previousButton = createElement("button", {
    className: "button button--secondary pickdrop-registration-previous-button",
    type: "button",
    textContent: "이전",
    dataset: { action: "backToSchoolReservation" },
  });
  previousButton.addEventListener("click", () => {
    schoolHomeState.isPickdropReservationModalOpen = false;
    rerender(schoolHomeState);
  });
  const submitButton = createElement("button", {
    className: "button button--primary pickdrop-registration-submit-button",
    type: "button",
    textContent: "등록",
    dataset: { action: "submitSchoolAndPickdropReservation" },
  });
  submitButton.addEventListener("click", () => submitSchoolReservations(schoolHomeState, draft));
  footer.append(previousButton, submitButton);
  modal.append(footer);
  overlay.append(modal);
  return overlay;
}

function createAppPickdropReservationScreen(schoolHomeState) {
  const draft = schoolHomeState.reservationRegisterDraft;
  const screen = createElement("section", {
    className: "school-app-pickdrop-registration-screen",
    dataset: { area: "pickdropReservation", platform: "app" },
  });
  const header = createElement("header", { className: "school-app-reservation-register-header" });
  const backButton = createElement("button", {
    className: "button button--icon school-app-reservation-register-back",
    type: "button",
    ariaLabel: "유치원 예약 등록으로",
  });
  backButton.append(createElement("img", { className: "button__icon", src: CHEVRON_LEFT_ICON_PATH, alt: "" }));
  backButton.addEventListener("click", () => closeAppPickdropReservationScreen(schoolHomeState));
  header.append(backButton, createElement("h1", { textContent: "픽드랍 예약" }), createElement("span", { className: "school-app-reservation-register-spacer" }));

  const body = createElement("main", { className: "school-app-pickdrop-registration-body" });
  const selectedMember = schoolHomeState.members.find((member) => member.id === draft.memberId);
  const selectedPet = getReservationPet(selectedMember, draft.petId);
  body.append(createElement("p", {
    className: "pickdrop-registration-selected-member school-app-pickdrop-registration-selected-member",
    textContent: getReservationMemberOptionText(selectedMember, selectedPet),
  }));

  const allSelected = draft.pickdropSelections.length > 0 && draft.pickdropSelections.every((selection) => selection.pickup && selection.dropoff);
  const allOption = createElement("label", {
    className: "pickdrop-registration-all-option school-app-pickdrop-registration-all-option",
    dataset: { action: "toggleAllPickdrop", state: allSelected ? "selected" : "idle" },
  });
  const allCheckbox = createElement("input", { type: "checkbox", dataset: { field: "allPickdrop" } });
  allCheckbox.checked = allSelected;
  allCheckbox.addEventListener("change", () => {
    draft.pickdropSelections = draft.pickdropSelections.map((selection) => ({
      ...selection,
      pickup: allCheckbox.checked,
      dropoff: allCheckbox.checked,
    }));
    rerender(schoolHomeState);
  });
  allOption.append(allCheckbox, createElement("span", { textContent: allSelected ? "전체 해제" : "전체 선택" }));
  body.append(allOption);

  const list = createElement("div", { className: "pickdrop-registration-date-list school-app-pickdrop-registration-date-list" });
  draft.pickdropSelections.forEach((selection) => {
    const row = createElement("article", { className: "pickdrop-registration-date-row school-app-pickdrop-registration-date-row", dataset: { entityId: selection.date } });
    row.append(createElement("strong", { textContent: formatReservationDate(selection.date) }));
    row.append(createPickdropTypeCheckbox(schoolHomeState, draft, selection, "pickup", "픽업"));
    row.append(createPickdropTypeCheckbox(schoolHomeState, draft, selection, "dropoff", "드랍"));
    list.append(row);
  });
  body.append(list);

  const footer = createElement("footer", { className: "school-app-pickdrop-registration-footer" });
  const previousButton = createElement("button", {
    className: "button button--secondary",
    type: "button",
    textContent: "이전",
    dataset: { action: "backToSchoolReservation" },
  });
  previousButton.addEventListener("click", () => closeAppPickdropReservationScreen(schoolHomeState));
  const submitButton = createElement("button", {
    className: "button button--primary",
    type: "button",
    textContent: "등록",
    dataset: { action: "submitSchoolAndPickdropReservation" },
  });
  submitButton.addEventListener("click", () => submitSchoolReservations(schoolHomeState, draft));
  footer.append(previousButton, submitButton);
  screen.append(header, body, footer);
  return screen;
}

function closeAppPickdropReservationScreen(schoolHomeState) {
  schoolHomeState.isAppPickdropReservationOpen = false;
  rerender(schoolHomeState);
}

function createPickdropTypeCheckbox(schoolHomeState, draft, selection, type, label) {
  const checkboxLabel = createElement("label", { className: "pickdrop-registration-type-option" });
  const checkbox = createElement("input", { type: "checkbox", dataset: { field: type, entityId: selection.date } });
  checkbox.checked = selection[type];
  checkbox.addEventListener("change", () => {
    selection[type] = checkbox.checked;
    rerender(schoolHomeState);
  });
  checkboxLabel.append(checkbox, createElement("span", { textContent: label }));
  return checkboxLabel;
}

function submitSchoolReservations(schoolHomeState, draft, { preserveMember = false } = {}) {
  const member = schoolHomeState.members.find((item) => item.id === draft.memberId);
  const pet = getReservationPet(member, draft.petId);
  const selectedTicket = getTicketHistoryById(pet, draft.ticketId)
    || getAvailableReservationTickets(pet).find((item) => item.id === draft.ticketId);
  const ticketCapacity = getTicketReservableCount(selectedTicket);
  let didExhaustSelectedTicket = false;
  draft.selectedDates.forEach((date) => {
    const ticket = selectedTicket && draft.selectedDates.indexOf(date) < ticketCapacity ? selectedTicket : null;
    const reservation = saveSchoolHomeReservation(createSchoolReservation({
      member,
      pet,
      date,
      ticket,
      isOverbooked: !ticket,
    }));
    schoolHomeState.reservations.push(reservation);
    if (ticket?.id) {
      const counterResult = updateTicketHistoryCounters({
        memberId: member.id,
        petId: pet.id,
        ticketHistoryId: ticket.id,
        reservableDelta: -1,
      });
      if (counterResult.didUpdate) {
        schoolHomeState.members = counterResult.members;
        const updatedPet = counterResult.members
          .find((item) => item.id === member.id)
          ?.pets?.find((item) => item.id === pet.id);
        const updatedTicket = updatedPet?.ticketHistories?.find((item) => item.id === ticket.id);
        didExhaustSelectedTicket = didExhaustSelectedTicket
          || Boolean(updatedTicket && getTicketReservableCount(updatedTicket) === 0);
      }
    }
  });
  schoolHomeState.selectedDate = draft.selectedDates[0];
  setSchoolHomeToast(schoolHomeState, [
    RESERVATION_SUCCESS_TOAST_MESSAGE,
    ...(didExhaustSelectedTicket ? [TICKET_DEPLETED_TOAST_MESSAGE] : []),
  ]);
  schoolHomeState.reservationRegisterDraft = createReservationRegisterDraft({
    memberId: preserveMember ? member?.id || "" : "",
    petId: preserveMember ? pet?.id || "" : "",
  });
  schoolHomeState.isAppReservationMemberSearchOpen = false;
  schoolHomeState.isAppReservationTicketSheetOpen = false;
  schoolHomeState.isAppPickdropReservationOpen = false;
  schoolHomeState.isPickdropReservationModalOpen = false;
  rerender(schoolHomeState);
}

function formatReservationDate(dateKey) {
  const date = new Date(dateKey);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function createSchoolHomeAppShell(schoolHomeState) {
  const shell = createElement("section", {
    className: "school-home-app-shell",
    dataset: { area: "schoolHomeApp" },
  });
  shell.append(createAppHeader(schoolHomeState));
  shell.append(createSchoolCalendarPanel(schoolHomeState, "app"));
  shell.append(createSchoolReservationPanel(schoolHomeState, "app"));
  shell.append(createAppBottomNavigation());
  return shell;
}

function createAppBottomNavigation() {
  return createDefaultAppBottomNavigation({
    className: "mobile-bottom-nav",
    selectedLabel: "일정",
  });
}

function createReservationSearchAppScreen(schoolHomeState) {
  const screen = createElement("section", {
    className: "app-reservation-search-screen",
    dataset: { area: "reservationSearchScreen", platform: "app", service: "school" },
  });
  screen.append(createReservationSearchAppHeader(schoolHomeState, "유치원 예약 검색"));
  screen.append(createReservationSearchFilter(schoolHomeState, {
    className: "reservation-search-filter app-reservation-search-filter",
    searchFieldClassName: "filter-field filter-search-field reservation-search-field member-search-suggestion-field app-reservation-search-field",
    searchInputClassName: "filter-search-input reservation-search-input app-reservation-search-input",
    searchInputSelector: ".app-reservation-search-screen .reservation-search-input",
    tagFilterPresentation: "bottomSheet",
    tagSearchInputSelector: ".reservation-tag-bottom-sheet .member-tag-search-input",
    placeholder: "예약자 / 반려견 검색",
    rerender,
    onSearchInput: (state) => {
      rerender(state);
    },
  }));
  screen.append(createReservationSearchResultList(
    getFilteredReservationSearchResults(schoolHomeState),
    "schoolHome"
  ));
  return screen;
}

function createReservationSearchAppHeader(schoolHomeState, titleText) {
  const header = createElement("header", { className: "app-reservation-search-header" });
  const backButton = createHeaderIconButton(CHEVRON_LEFT_ICON_PATH, "뒤로");
  backButton.addEventListener("click", () => {
    schoolHomeState.isReservationSearchScreenOpen = false;
    schoolHomeState.isReservationSearchMenuOpen = false;
    schoolHomeState.isTagMenuOpen = false;
    rerender(schoolHomeState);
  });
  header.append(backButton);
  header.append(createElement("h1", { textContent: titleText }));
  header.append(createElement("span", { className: "header-spacer" }));
  return header;
}

function createReservationSearchResultList(reservations, featureName) {
  const list = createElement("section", {
    className: "app-reservation-search-results",
    dataset: { area: "reservationSearchResults", feature: featureName, state: reservations.length ? "list" : "empty" },
  });

  if (!reservations.length) {
    list.append(createEmptyStateElement({ title: "등록된 예약이 없습니다." }));
    return list;
  }

  reservations.forEach((reservation) => {
    list.append(createReservationSearchResultItem(reservation, featureName));
  });
  return list;
}

function createReservationSearchResultItem(reservation, featureName) {
  const item = createElement("article", {
    className: "app-reservation-search-item",
    dataset: { entity: "reservation", entityId: reservation.id, feature: featureName },
  });
  const row = createElement("div", { className: "app-reservation-search-item-main" });
  row.append(createElement("strong", { textContent: reservation.petName || "-" }));
  row.append(createElement("span", {
    textContent: [reservation.breed || "-", reservation.weight || "-kg", reservation.guardianName || "-"].join(" / "),
  }));
  const more = createElement("button", {
    className: "button button--icon button--icon-tiny",
    type: "button",
    ariaLabel: `${reservation.petName || "예약"} 상세`,
    dataset: { action: "openReservationDetail", entityId: reservation.id },
  });
  more.append(createElement("img", { className: "button__icon", src: CHEVRON_RIGHT_ICON_PATH, alt: "" }));
  more.addEventListener("click", () => {
    window.location.href = `./school-reservation-detail.html?reservationId=${encodeURIComponent(reservation.id)}`;
  });
  row.append(more);
  item.append(row);
  item.append(createElement("span", {
    className: "app-reservation-search-date",
    textContent: `${formatReservationSearchDate(reservation.date)} 예약`,
  }));
  return item;
}

function getFilteredReservationSearchResults(schoolHomeState) {
  const searchTerm = normalizeReservationSearchText(schoolHomeState.searchTerm);
  return [...(schoolHomeState.reservations || [])]
    .filter((reservation) => {
      if (!searchTerm) {
        return true;
      }
      return [reservation.guardianName, reservation.petName].some((fieldValue) => {
        return normalizeReservationSearchText(fieldValue).includes(searchTerm);
      });
    })
    .filter((reservation) => {
      if (!schoolHomeState.selectedMemberTagNames?.length) {
        return true;
      }
      const reservationTags = reservation.petTags || [];
      return schoolHomeState.selectedMemberTagNames.every((memberTagName) => reservationTags.includes(memberTagName));
    })
    .sort((leftReservation, rightReservation) => String(leftReservation.date || "").localeCompare(String(rightReservation.date || "")));
}

function formatReservationSearchDate(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function normalizeReservationSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function resetToInitialView(schoolHomeState) {
  const todayDateKey = getTodayDateKey();
  schoolHomeState.currentMonth = todayDateKey.slice(0, 7);
  schoolHomeState.selectedDate = todayDateKey;
  resetReservationFilters(schoolHomeState);
  schoolHomeState.selectedReservationIds = [];
  rerender(schoolHomeState);
}

function resetReservationFilters(schoolHomeState) {
  schoolHomeState.searchTerm = "";
  schoolHomeState.selectedReservationMember = null;
  schoolHomeState.selectedMemberTagNames = [];
  schoolHomeState.tagFilterQuery = "";
  schoolHomeState.isReservationSearchMenuOpen = false;
  schoolHomeState.isTagMenuOpen = false;
}

function getSchoolCapacityCount() {
  return 12;
}
