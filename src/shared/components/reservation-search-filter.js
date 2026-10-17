import { createModalOverlay } from "./modal.js";
import { createEmptyStateElement } from "./empty-state.js";
import { sortMemberTagNames } from "../services/member-tag-service.js";
import { createElement } from "../utils/dom.js";

export function createReservationSearchFilter(state, options) {
  let isComposing = false;
  const wrapper = createElement("div", {
    className: options.className || "reservation-search-filter",
    dataset: options.dataset,
  });

  const searchField = createElement("div", {
    className: options.searchFieldClassName || "filter-field filter-search-field reservation-search-field member-search-suggestion-field",
    dataset: { field: "reservationSearch" },
  });
  const searchInput = createElement("input", {
    className: options.searchInputClassName || "filter-search-input reservation-search-input",
    type: "search",
    value: state.searchTerm || "",
    placeholder: options.placeholder || "예약자 / 반려견 검색",
  });
  searchInput.addEventListener("focus", () => {
    if (state.isReservationSearchMenuOpen) {
      return;
    }

    state.isReservationSearchMenuOpen = true;
    options.rerender(state);
    focusReservationSearchInput(options);
  });
  searchInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  searchInput.addEventListener("compositionend", (event) => {
    isComposing = false;
    window.setTimeout(() => {
      applyReservationMemberSearch(state, event.target.value);
      state.isReservationSearchMenuOpen = true;
      options.onSearchInput?.(state, event.target.value);
      focusReservationSearchInput(options);
    }, 0);
  });
  searchInput.addEventListener("input", (event) => {
    state.isReservationSearchMenuOpen = true;

    if (isComposing) {
      state.searchTerm = event.target.value;
      syncReservationSearchMenu(state, options);
      return;
    }

    applyReservationMemberSearch(state, event.target.value);
    options.onSearchInput?.(state, event.target.value);
    focusReservationSearchInput(options);
  });
  searchInput.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (
        document.activeElement?.closest?.("[data-field='reservationSearch']")
        || document.activeElement?.closest?.("[data-area='reservationSearchMenu']")
      ) {
        return;
      }

      state.isReservationSearchMenuOpen = false;
      options.rerender(state);
    }, 120);
  });
  searchField.append(searchInput);

  if (state.isReservationSearchMenuOpen) {
    searchField.append(createReservationSearchMenu(state, options));
  }

  wrapper.append(searchField);
  wrapper.append(createReservationTagFilter(state, options));
  return wrapper;
}

function syncReservationSearchMenu(state, options) {
  const field = document.querySelector("[data-field='reservationSearch']");
  if (!field) {
    return;
  }

  const currentMenu = field.querySelector("[data-area='reservationSearchMenu']");
  const nextMenu = createReservationSearchMenu(state, options);

  if (currentMenu) {
    currentMenu.replaceWith(nextMenu);
    return;
  }

  field.append(nextMenu);
}

function createReservationSearchMenu(state, options) {
  const visibleMembers = getVisibleReservationMemberOptions(state);
  const menu = createElement("div", {
    className: "member-search-menu reservation-search-menu",
    dataset: {
      area: "reservationSearchMenu",
      state: visibleMembers.length ? "list" : "empty",
    },
  });

  if (!visibleMembers.length) {
    menu.append(createTagEmptyState("등록된 예약이 없습니다."));
    return menu;
  }

  visibleMembers.forEach((member) => {
    const button = createElement("button", {
      className: "member-search-option",
      type: "button",
      dataset: {
        action: "selectReservationMemberSearch",
        entity: "member",
        entityId: member.memberId,
        petId: member.petId,
      },
    });
    button.append(createElement("strong", { textContent: member.petName || "-" }));
    button.append(createElement("span", { textContent: `${member.guardianName || "-"} / ${member.phoneNumber || "-"}` }));
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", () => {
      applyReservationMemberSearch(state, member.petName || member.guardianName || "");
      state.selectedReservationMember = member;
      state.selectedMemberTagNames = [];
      state.tagFilterQuery = "";
      state.isTagMenuOpen = false;
      state.isReservationSearchMenuOpen = false;
      if (options.onMemberSelect) {
        options.onMemberSelect(state, member);
        return;
      }

      options.onSearchInput?.(state, state.searchTerm);
    });
    menu.append(button);
  });

  return menu;
}

function applyReservationMemberSearch(state, searchTerm) {
  const nextSearchTerm = String(searchTerm || "");
  const didChange = String(state.searchTerm || "") !== nextSearchTerm;
  state.searchTerm = nextSearchTerm;

  if (!didChange) {
    return;
  }

  state.selectedReservationMember = null;
  state.selectedMemberTagNames = [];
  state.tagFilterQuery = "";
  state.isTagMenuOpen = false;
}

function clearReservationMemberSearch(state) {
  state.searchTerm = "";
  state.selectedReservationMember = null;
  state.isReservationSearchMenuOpen = false;
}

function getVisibleReservationMemberOptions(state) {
  const query = String(state.searchTerm || "").trim().toLowerCase();
  const options = getReservationMemberOptions(state);
  const visibleOptions = query
    ? options.filter((member) => {
      return [member.guardianName, member.petName, member.phoneNumber].some((fieldValue) => {
        return String(fieldValue || "").toLowerCase().includes(query);
      });
    })
    : options;

  return visibleOptions.slice(0, 8);
}

function getReservationMemberOptions(state) {
  const optionsByKey = new Map();

  (state.members || []).forEach((member) => {
    (member.pets || []).forEach((pet) => {
      const petName = pet?.petName || pet?.dogName || "";
      const key = `${member.id || member.guardianName}:${pet?.id || petName}`;
      optionsByKey.set(key, {
        memberId: member.id || "",
        petId: pet?.id || "",
        guardianName: member.guardianName || "",
        phoneNumber: member.phoneNumber || "",
        petName,
      });
    });
  });

  (state.reservations || []).forEach((reservation) => {
    const key = `${reservation.memberId || reservation.guardianName}:${reservation.petId || reservation.petName}`;
    if (optionsByKey.has(key)) {
      return;
    }

    optionsByKey.set(key, {
      memberId: reservation.memberId || "",
      petId: reservation.petId || "",
      guardianName: reservation.guardianName || "",
      phoneNumber: reservation.phoneNumber || "",
      petName: reservation.petName || "",
    });
  });

  return Array.from(optionsByKey.values()).filter((member) => {
    return member.guardianName || member.petName;
  });
}

function focusReservationSearchInput(options = {}) {
  window.setTimeout(() => {
    const nextInput = document.querySelector(options.searchInputSelector || ".reservation-search-input");
    if (!nextInput) {
      return;
    }

    nextInput.focus();
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  }, 0);
}

function createReservationTagFilter(state, options) {
  const wrapper = createElement("div", {
    className: "filter-field filter-tag-field reservation-tag-filter",
    dataset: { area: "reservationTagFilter", state: state.isTagMenuOpen ? "open" : "closed" },
  });
  const button = createElement("button", {
    className: options.filterButtonClassName || "filter-select-button",
    type: "button",
    textContent: getSelectedTagSummary(state),
    dataset: { action: "toggleReservationTagFilter" },
  });
  button.addEventListener("click", () => {
    state.isTagMenuOpen = !state.isTagMenuOpen;
    options.rerender(state);
  });
  wrapper.append(button);

  if (state.isTagMenuOpen) {
    wrapper.append(options.tagFilterPresentation === "bottomSheet"
      ? createReservationTagBottomSheet(state, options)
      : createReservationTagMenu(state, options));
  }

  return wrapper;
}

function createReservationTagBottomSheet(state, options) {
  const overlay = createModalOverlay({
    className: "tag-bottom-sheet-overlay reservation-tag-bottom-sheet-overlay",
    dataset: { area: "reservationTagBottomSheet", modal: "reservationTagBottomSheet", state: "open" },
  });
  const sheet = createElement("div", { className: "tag-bottom-sheet reservation-tag-bottom-sheet" });
  const header = createElement("div", { className: "tag-bottom-sheet-header" });
  header.append(createElement("span", { className: "tag-bottom-sheet-header-spacer" }));
  header.append(createElement("h3", { textContent: "태그" }));
  const closeButton = createElement("button", {
    className: "button button--text",
    type: "button",
    textContent: "닫기",
    dataset: { action: "closeReservationTagBottomSheet" },
  });
  closeButton.addEventListener("click", () => {
    state.isTagMenuOpen = false;
    options.rerender(state);
  });
  header.append(closeButton);

  sheet.append(header);
  sheet.append(createTagSearchControl(state, {
    ...options,
    tagSearchControlClassName: "member-tag-search-control member-tag-search-filter-control",
    tagSearchInputSelector: ".reservation-tag-bottom-sheet .member-tag-search-input",
  }));
  sheet.append(createReservationTagMenu(state, options, { includeSearch: false }));
  overlay.append(sheet);
  return overlay;
}

function createReservationTagMenu(state, options, menuOptions = {}) {
  const { includeSearch = true } = menuOptions;
  const menu = createElement("div", {
    className: "tag-multi-select-menu",
    dataset: { area: "reservationTagMenu", state: state.memberTagCatalog.length ? "list" : "empty" },
  });

  if (includeSearch) {
    menu.append(createTagSearchControl(state, options));
  }
  const list = createElement("div", {
    className: "member-tag-data-list",
    dataset: { area: "reservationTagOptionList" },
  });

  if (state.memberTagCatalog.length === 0) {
    list.append(createTagEmptyState("등록된 태그가 없습니다"));
    menu.append(list);
    return menu;
  }

  getVisibleReservationTags(state).forEach((memberTagName) => {
    list.append(createReservationTagOption(state, options, memberTagName));
  });

  if (!list.childNodes.length) {
    list.append(createTagEmptyState("검색 결과가 없습니다."));
  }

  menu.append(list);
  return menu;
}

function createTagSearchControl(state, options) {
  let isComposing = false;
  const wrapper = createElement("div", {
    className: "member-tag-search-stack",
    dataset: { area: "reservationTagSearchControl", state: state.selectedMemberTagNames?.length ? "selected" : "empty" },
  });

  const control = createElement("div", {
    className: options.tagSearchControlClassName || "member-tag-search-control tag-menu-search-control",
    dataset: { state: "input" },
  });

  const input = createElement("input", {
    className: "member-tag-search-input",
    type: "text",
    value: state.tagFilterQuery || "",
    placeholder: "태그 조회",
  });
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", (event) => {
    isComposing = false;
    const composingInput = event.target;
    window.setTimeout(() => {
      state.tagFilterQuery = composingInput.value;
      options.rerender(state);
      focusReservationTagSearchInput(options);
    }, 0);
  });
  input.addEventListener("input", (event) => {
    state.tagFilterQuery = event.target.value;

    if (isComposing) {
      syncReservationTagDataList(control, state, options);
      return;
    }

    options.rerender(state);
    focusReservationTagSearchInput(options);
  });
  control.append(input);

  wrapper.append(control);
  return wrapper;
}
  /*

    textContent: "×",
    ariaLabel: "",
}

*/
function syncReservationTagDataList(control, state, options) {
  const list = control.closest("[data-area='reservationTagMenu']")?.querySelector(".member-tag-data-list")
    || control.closest(".tag-bottom-sheet")?.querySelector("[data-area='reservationTagMenu'] .member-tag-data-list");
  if (!list) {
    return;
  }

  const visibleMemberTags = getVisibleReservationTags(state);
  const hasQuery = Boolean(String(state.tagFilterQuery || "").trim());

  list.innerHTML = "";
  list.dataset.state = visibleMemberTags.length ? "list" : hasQuery ? "searchEmpty" : "empty";
  list.dataset.query = String(state.tagFilterQuery || "").trim();

  if (state.memberTagCatalog.length === 0) {
    list.append(createTagEmptyState("등록된 태그가 없습니다"));
    return;
  }

  visibleMemberTags.forEach((memberTagName) => {
    list.append(createReservationTagOption(state, options, memberTagName));
  });

  if (!list.childNodes.length) {
    list.append(createTagEmptyState("검색 결과가 없습니다."));
  }
}

function createReservationTagOption(state, options, memberTagName) {
  const isSelected = state.selectedMemberTagNames.includes(memberTagName);
  const option = createElement("label", {
    className: "member-tag-option",
    dataset: { action: "toggleReservationTag", entityId: memberTagName, state: isSelected ? "selected" : "idle" },
  });
  const checkbox = createElement("input", {
    type: "checkbox",
    dataset: { field: "reservationTagOption" },
  });
  checkbox.checked = isSelected;
  checkbox.addEventListener("change", () => {
    state.selectedMemberTagNames = isSelected
      ? state.selectedMemberTagNames.filter((selectedTagName) => selectedTagName !== memberTagName)
      : [...state.selectedMemberTagNames, memberTagName];
    clearReservationMemberSearch(state);
    options.onTagSelect?.(state, memberTagName);
    options.rerender(state);
  });
  option.append(checkbox);
  option.append(createElement("span", { textContent: memberTagName }));
  return option;
}

function focusReservationTagSearchInput(options = {}) {
  window.setTimeout(() => {
    const nextInput = document.querySelector(options.tagSearchInputSelector || ".reservation-tag-filter .member-tag-search-input");
    if (!nextInput) {
      return;
    }

    nextInput.focus();
    nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
  }, 0);
}

function getVisibleReservationTags(state) {
  const query = String(state.tagFilterQuery || "").trim().toLowerCase();
  const memberTags = sortMemberTagNames(state.memberTagCatalog || []);

  if (!query) {
    return memberTags;
  }

  return memberTags.filter((memberTagName) => {
    return String(memberTagName || "").toLowerCase().includes(query);
  });
}

function getSelectedTagSummary(state) {
  if (!state.selectedMemberTagNames.length) {
    return "태그";
  }
  return `태그(${state.selectedMemberTagNames.length})`;
}

function createTagEmptyState(title) {
  const emptyState = createEmptyStateElement({ title });
  emptyState.className = "empty-state member-tag-empty-state";
  return emptyState;
}
