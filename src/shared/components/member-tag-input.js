import { createModalOverlay } from "./modal.js";
import {
  buildTagSuggestions,
  hasMemberTagName,
  MAX_MEMBER_TAG_CATALOG_SIZE,
  MAX_MEMBER_TAGS_PER_MEMBER,
  normalizeMemberTagName,
  sanitizeTagList,
  sortMemberTagNames,
} from "../services/member-tag-service.js";
import { createEmptyStateElement } from "./empty-state.js";
import { createHeaderIconButton } from "./header-icon-button.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "./toast.js";
import { createElement } from "../utils/dom.js";

const CHEVRON_RIGHT_ICON_PATH = "../assets/iconChevronRight.svg";

export function initTagInput({
  container,
  initialTags = [],
  getCatalog,
  onChange,
  showRemoveControls = true,
  useSelectedListTrigger = false,
}) {
  let selectedTags = sanitizeTagList(initialTags);
  let query = "";
  let isSuggestionOpen = false;
  let isComposing = false;
  let isMobileSearchOpen = false;
  let mobileSearchInitialTagCount = 0;
  let toastMessage = "";
  let toastDismissTimer = null;
  const inputId = `member-tag-input-${Math.random().toString(36).slice(2)}`;

  function notifyChange() {
    if (onChange) {
      onChange(getTags());
    }
  }

  function getTags() {
    return sanitizeTagList(selectedTags);
  }

  function addTag(memberTagName, options = {}) {
    const { keepSearchOpen = false } = options;
    const shouldKeepMobileSearchOpen = keepSearchOpen && isMobileSearchOpen;
    const trimmedTagName = String(memberTagName || "").trim().replace(/\s+/g, " ");
    const selectedTagSet = new Set(selectedTags.map(normalizeMemberTagName));
    const catalog = getCatalog ? getCatalog() : [];

    if (!trimmedTagName || selectedTagSet.has(normalizeMemberTagName(trimmedTagName))) {
      query = "";
      isMobileSearchOpen = shouldKeepMobileSearchOpen;
      isSuggestionOpen = keepSearchOpen;
      render({ shouldFocusSearchInput: shouldKeepMobileSearchOpen, shouldFocusInput: keepSearchOpen && !shouldKeepMobileSearchOpen });
      return;
    }

    if (selectedTags.length >= MAX_MEMBER_TAGS_PER_MEMBER) {
      showTagLimitToast("한 회원당 최대 10개까지만 태그를 붙일 수 있습니다.", { keepSearchOpen });
      return;
    }

    if (!hasMemberTagName(catalog, trimmedTagName) && sanitizeTagList(catalog).length >= MAX_MEMBER_TAG_CATALOG_SIZE) {
      showTagLimitToast("태그는 최대 20개까지 등록할 수 있습니다.", { keepSearchOpen });
      return;
    }

    selectedTags = sanitizeTagList([...selectedTags, trimmedTagName]);
    query = "";
    isSuggestionOpen = keepSearchOpen;
    isMobileSearchOpen = shouldKeepMobileSearchOpen;
    render({ shouldFocusSearchInput: shouldKeepMobileSearchOpen, shouldFocusInput: keepSearchOpen && !shouldKeepMobileSearchOpen });
    notifyChange();
  }

  function showTagLimitToast(message, options = {}) {
    const { keepSearchOpen = false } = options;
    const shouldKeepMobileSearchOpen = keepSearchOpen && isMobileSearchOpen;
    toastMessage = message;
    isMobileSearchOpen = shouldKeepMobileSearchOpen || isMobileSearchOpen;
    isSuggestionOpen = keepSearchOpen || isSuggestionOpen;
    render({ shouldFocusSearchInput: shouldKeepMobileSearchOpen, shouldFocusInput: keepSearchOpen && !shouldKeepMobileSearchOpen });
    scheduleToastDismiss();
  }

  function scheduleToastDismiss() {
    window.clearTimeout(toastDismissTimer);
    toastDismissTimer = window.setTimeout(() => {
      toastMessage = "";
      render({ shouldFocusSearchInput: isMobileSearchOpen, shouldFocusInput: !isMobileSearchOpen });
    }, TOAST_AUTO_DISMISS_MS);
  }

  function removeTag(memberTagName) {
    selectedTags = selectedTags.filter((selectedTagName) => {
      return normalizeMemberTagName(selectedTagName) !== normalizeMemberTagName(memberTagName);
    });
    render();
    notifyChange();
  }

  function clearTags(options = {}) {
    const { keepSearchOpen = false } = options;
    selectedTags = [];
    query = "";
    isMobileSearchOpen = keepSearchOpen;
    isSuggestionOpen = keepSearchOpen;
    render({ shouldFocusSearchInput: keepSearchOpen });
    notifyChange();
  }

  function toggleTag(memberTagName, options = {}) {
    const { keepSearchOpen = false } = options;
    const shouldKeepMobileSearchOpen = keepSearchOpen && isMobileSearchOpen;
    const isSelected = selectedTags.some((selectedTagName) => {
      return normalizeMemberTagName(selectedTagName) === normalizeMemberTagName(memberTagName);
    });

    if (isSelected) {
      selectedTags = selectedTags.filter((selectedTagName) => {
        return normalizeMemberTagName(selectedTagName) !== normalizeMemberTagName(memberTagName);
      });
      isMobileSearchOpen = shouldKeepMobileSearchOpen;
      isSuggestionOpen = keepSearchOpen;
      render({ shouldFocusSearchInput: shouldKeepMobileSearchOpen, shouldFocusInput: keepSearchOpen && !shouldKeepMobileSearchOpen });
      notifyChange();
      return;
    }

    addTag(memberTagName, { keepSearchOpen });
  }

  function focusInputAtEnd(selector = ".member-tag-input-field") {
    const input = container.querySelector(selector);
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function openMobileTagSearch() {
    if (!isMobileSearchOpen) {
      mobileSearchInitialTagCount = selectedTags.length;
    }
    isMobileSearchOpen = true;
    isSuggestionOpen = true;
  }

  function closeMobileTagSearch() {
    isMobileSearchOpen = false;
    isSuggestionOpen = false;
  }

  function render(options = {}) {
    const { shouldFocusInput = false, shouldFocusSearchInput = false } = options;
    container.innerHTML = "";
    container.className = "member-tag-input";
    container.dataset.area = "memberTagInput";

    if (selectedTags.length || useSelectedListTrigger) {
      const selectedListDataset = {
        area: "selectedMemberTags",
        state: selectedTags.length ? "list" : "empty",
        presentation: showRemoveControls ? "editable" : "readView",
      };
      if (useSelectedListTrigger) {
        selectedListDataset.action = "openMemberTagSearch";
      }
      const selectedList = createElement(useSelectedListTrigger ? "button" : "div", {
        className: getSelectedListClassName(),
        type: useSelectedListTrigger ? "button" : undefined,
        dataset: selectedListDataset,
      });
      if (selectedTags.length) {
        appendSelectedTagChips(selectedList, { showRemove: showRemoveControls && !useSelectedListTrigger });
      } else if (useSelectedListTrigger) {
        selectedList.append(createElement("span", { className: "member-tag-selected-placeholder", textContent: "태그" }));
      }
      if (useSelectedListTrigger) {
        selectedList.append(createElement("img", {
          className: "member-tag-selected-chevron",
          src: CHEVRON_RIGHT_ICON_PATH,
          alt: "",
        }));
        selectedList.addEventListener("click", () => {
          openMobileTagSearch();
          render({ shouldFocusSearchInput: true });
        });
      }
      container.append(selectedList);
    }

    if (useSelectedListTrigger) {
      if (isMobileSearchOpen) {
        container.append(createMobileTagSearchScreen());
      }
      if (toastMessage) {
        container.append(createToast(toastMessage));
      }
      if (shouldFocusSearchInput) {
        focusInputAtEnd(".member-tag-search-input");
      }
      return;
    }

    const chips = createElement("div", { className: "member-tag-input-chips", dataset: { state: "input" } });

    const input = createElement("input", {
      className: "member-tag-input-field",
      type: "text",
      value: query,
      placeholder: "태그 입력",
      dataset: { field: "memberTag" },
    });
    input.id = inputId;
    input.name = "memberTag";
    bindTagInputEvents(input, { searchInputSelector: ".member-tag-input-field" });
    chips.append(input);
    container.append(chips);

    if (!isMobileSearchOpen) {
      appendSuggestionMenu(container);
    }

    if (isMobileSearchOpen) {
      container.append(createMobileTagSearchScreen());
    }

    if (toastMessage) {
      container.append(createToast(toastMessage));
    }

    if (shouldFocusInput) {
      focusInputAtEnd(".member-tag-input-field");
    }

    if (shouldFocusSearchInput) {
      focusInputAtEnd(".member-tag-search-input");
    }
  }

  function getSelectedListClassName() {
    const classNames = ["member-tag-selected-list"];
    if (!showRemoveControls || useSelectedListTrigger) {
      classNames.push("is-read-view");
    }
    if (useSelectedListTrigger) {
      classNames.push("is-trigger");
    }
    return classNames.join(" ");
  }

  function bindTagInputEvents(input, options = {}) {
    const searchInputSelector = options.searchInputSelector || ".member-tag-input-field";

    input.addEventListener("compositionstart", () => {
      isComposing = true;
    });
    input.addEventListener("compositionend", (event) => {
      isComposing = false;
      window.setTimeout(() => {
        query = event.target.value;
        isSuggestionOpen = true;
        render({ [searchInputSelector === ".member-tag-search-input" ? "shouldFocusSearchInput" : "shouldFocusInput"]: true });
      }, 0);
    });
    input.addEventListener("input", (event) => {
      query = event.target.value;
      isSuggestionOpen = true;
      if (isComposing) {
        if (searchInputSelector === ".member-tag-search-input") {
          syncMobileTagDataList();
        }
        return;
      }

      render({ [searchInputSelector === ".member-tag-search-input" ? "shouldFocusSearchInput" : "shouldFocusInput"]: true });
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || isComposing) {
        return;
      }
      event.preventDefault();
      const suggestion = getSuggestions()[0];
      addTag(suggestion || query, { keepSearchOpen: searchInputSelector === ".member-tag-search-input" });
    });
    input.addEventListener("focus", () => {
      if (isMobileLayout() && !isMobileSearchOpen) {
        openMobileTagSearch();
        render({ shouldFocusSearchInput: true });
        return;
      }

      if (isSuggestionOpen) {
        return;
      }

      isSuggestionOpen = true;
      render({ [searchInputSelector === ".member-tag-search-input" ? "shouldFocusSearchInput" : "shouldFocusInput"]: true });
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (container.contains(document.activeElement) || isMobileSearchOpen) {
          return;
        }

        isSuggestionOpen = false;
        render();
      }, 120);
    });
  }

  function appendSuggestionMenu(parent) {
    const suggestions = getSuggestions();
    if (isSuggestionOpen && (suggestions.length || query.trim())) {
      const menu = createElement("div", {
        className: "member-tag-suggestion-menu",
        dataset: { state: suggestions.length ? "list" : "empty" },
      });

      suggestions.forEach((memberTagName) => {
        const option = createElement("button", {
          className: "member-tag-suggestion-option",
          type: "button",
          textContent: memberTagName,
          dataset: { action: "selectMemberTagSuggestion", entityId: memberTagName },
        });
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          addTag(memberTagName, { keepSearchOpen: true });
        });
        menu.append(option);
      });

      if (query.trim() && !suggestions.some((memberTagName) => normalizeMemberTagName(memberTagName) === normalizeMemberTagName(query))) {
        const createButton = createElement("button", {
          className: "member-tag-suggestion-option",
          type: "button",
          textContent: `"${query.trim()}" 추가`,
          dataset: { action: "createMemberTag" },
        });
        createButton.addEventListener("mousedown", (event) => {
          event.preventDefault();
          addTag(query, { keepSearchOpen: true });
        });
        menu.append(createButton);
      }

      if (!menu.childElementCount) {
        menu.append(createElement("span", { className: "empty-inline", textContent: "추천 태그가 없습니다" }));
      }

      parent.append(menu);
    }
  }

  function createMobileTagSearchScreen() {
    const overlay = createModalOverlay({
      className: "member-tag-search-screen tag-bottom-sheet-overlay member-tag-input-sheet-overlay",
      dataset: { area: "memberTagSearch", modal: "memberTagSearch", state: "open" },
    });
    const sheet = createElement("div", { className: "tag-bottom-sheet member-tag-input-sheet" });
    const header = createElement("header", { className: "tag-bottom-sheet-header member-tag-search-header" });
    const closeButton = createHeaderIconButton({
      className: "button button--icon",
      icon: "close",
      ariaLabel: "태그 선택 닫기",
      dataset: { action: "closeMemberTagSearch" },
    });
    closeButton.addEventListener("click", () => {
      closeMobileTagSearch();
      render();
    });
    header.append(closeButton);
    header.append(createElement("h3", { textContent: "태그" }));
    header.append(createElement("span", { className: "tag-bottom-sheet-header-spacer member-tag-search-header-spacer" }));

    sheet.append(header);
    sheet.append(createMobileTagSearchControl());
    sheet.append(createMobileTagDataList());
    sheet.append(createMobileTagSearchFooter());
    overlay.append(sheet);
    return overlay;
  }

  function createMobileTagSearchFooter() {
    const isSelectionChanged = selectedTags.length !== mobileSearchInitialTagCount;
    const footer = createElement("div", {
      className: "member-tag-search-footer",
      dataset: { area: "memberTagSearchFooter" },
    });
    const selectButton = createElement("button", {
      className: "button button--action member-tag-select-button",
      type: "button",
      textContent: `선택 (${selectedTags.length}/${MAX_MEMBER_TAGS_PER_MEMBER})`,
      dataset: { action: "confirmMemberTagSelection", state: isSelectionChanged ? "enabled" : "disabled" },
    });
    selectButton.disabled = !isSelectionChanged;
    selectButton.addEventListener("click", () => {
      if (!isSelectionChanged) {
        return;
      }
      closeMobileTagSearch();
      render();
    });
    footer.append(selectButton);
    return footer;
  }

  function createMobileTagSearchControl() {
    const wrapper = createElement("div", {
      className: "member-tag-search-stack",
      dataset: { area: "memberTagSearchControl", state: selectedTags.length ? "selected" : "empty" },
    });

    const control = createElement("div", {
      className: "member-tag-search-control member-tag-search-filter-control",
      dataset: { state: "input" },
    });

    const searchInput = createElement("input", {
      className: "member-tag-search-input",
      type: "text",
      value: query,
      placeholder: "태그 입력 또는 조회",
      dataset: { field: "memberTag" },
    });
    bindTagInputEvents(searchInput, { searchInputSelector: ".member-tag-search-input" });
    control.append(searchInput);
    wrapper.append(control);
    return wrapper;
  }
  /*
      textContent: "×",
      ariaLabel: "",

  */
  function appendSelectedTagChips(parent, options = {}) {
    const shouldShowRemove = options.showRemove !== false;
    const chipClassName = options.chipClassName || (shouldShowRemove ? "member-tag-removable-chip" : "member-tag-input-chip");
    selectedTags.forEach((memberTagName) => {
      const chip = createElement("span", { className: chipClassName, dataset: { entity: "memberTag", entityId: memberTagName } });
      chip.append(createElement("span", { textContent: memberTagName }));
      if (!shouldShowRemove) {
        parent.append(chip);
        return;
      }
      const removeButton = createElement("button", {
        className: "member-tag-chip-remove",
        type: "button",
        textContent: "×",
        ariaLabel: `${memberTagName} 태그 삭제`,
        dataset: { action: "removeMemberTag" },
      });
      removeButton.addEventListener("click", () => {
        removeTag(memberTagName);
      });
      chip.append(removeButton);
      parent.append(chip);
    });
  }

  function appendSelectedTagSummaryChips(parent) {
    selectedTags.forEach((memberTagName) => {
      const chip = createElement("span", {
        className: showRemoveControls ? "member-tag-removable-chip" : "member-tag-input-chip",
        dataset: { entity: "memberTag", entityId: memberTagName },
      });
      chip.append(createElement("span", { textContent: memberTagName }));
      if (!showRemoveControls) {
        parent.append(chip);
        return;
      }
      const removeButton = createElement("button", {
        className: "member-tag-chip-remove",
        type: "button",
        textContent: "×",
        ariaLabel: `${memberTagName} 태그 삭제`,
        dataset: { action: "removeMemberTagSummary" },
      });
      removeButton.addEventListener("click", () => {
        removeTag(memberTagName);
      });
      chip.append(removeButton);
      parent.append(chip);
    });
  }

  function createMobileTagDataList() {
    const list = createElement("div", {
      className: "member-tag-data-list",
    });
    populateMobileTagDataList(list);
    return list;
  }

  function syncMobileTagDataList() {
    const list = container.querySelector(".member-tag-data-list");
    if (!list) {
      return;
    }

    populateMobileTagDataList(list);
  }

  function populateMobileTagDataList(list) {
    const searchResults = getTagSearchResults();
    const hasQuery = Boolean(query.trim());

    list.innerHTML = "";
    list.dataset.state = searchResults.length ? "list" : hasQuery ? "searchEmpty" : "empty";
    list.dataset.query = query.trim();

    searchResults.forEach((memberTagName) => {
      list.append(createTagOption(memberTagName, {
        isSelected: isSelectedTag(memberTagName),
        action: "toggleMemberTag",
        onChange: () => {
          toggleTag(memberTagName, { keepSearchOpen: true });
        },
      }));
    });

    if (hasQuery && !isSelectedTag(query) && !searchResults.some((memberTagName) => normalizeMemberTagName(memberTagName) === normalizeMemberTagName(query))) {
      list.append(createTagOption(`"${query.trim()}" 추가`, {
        isSelected: false,
        action: "createMemberTag",
        entityId: query.trim(),
        onChange: () => {
          addTag(query, { keepSearchOpen: true });
        },
      }));
    }

    if (!list.childElementCount) {
      list.append(createTagEmptyState(hasQuery ? "검색 결과가 없습니다" : "등록된 태그가 없습니다"));
    }
  }

  function createTagEmptyState(title) {
    const emptyState = createEmptyStateElement({ title });
    emptyState.className = "empty-state member-tag-empty-state";
    return emptyState;
  }

  function getSuggestions() {
    return buildTagSuggestions(getCatalog ? getCatalog() : [], query, selectedTags, MAX_MEMBER_TAG_CATALOG_SIZE);
  }

  function getTagSearchResults() {
    const catalog = sortMemberTagNames(getCatalog ? getCatalog() : []);
    const normalizedQuery = normalizeMemberTagName(query);
    if (!normalizedQuery) {
      return catalog;
    }

    return catalog.filter((memberTagName) => {
      return normalizeMemberTagName(memberTagName).includes(normalizedQuery);
    });
  }

  function isSelectedTag(memberTagName) {
    return selectedTags.some((selectedTagName) => {
      return normalizeMemberTagName(selectedTagName) === normalizeMemberTagName(memberTagName);
    });
  }

  function createTagOption(labelText, options) {
    const entityId = options.entityId || labelText;
    const option = createElement("label", {
      className: "member-tag-option",
      dataset: {
        action: options.action,
        entityId,
        state: options.isSelected ? "selected" : "idle",
      },
    });
    const checkbox = createElement("input", {
      type: "checkbox",
      dataset: { field: "memberTagOption" },
    });
    checkbox.checked = options.isSelected;
    checkbox.addEventListener("change", options.onChange);
    option.append(checkbox);
    option.append(createElement("span", { textContent: labelText }));
    return option;
  }

  function isMobileLayout() {
    return window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  }

  render();

  return {
    getTags,
  };
}
