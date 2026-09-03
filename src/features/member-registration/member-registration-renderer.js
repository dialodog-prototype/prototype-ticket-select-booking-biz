import { ACTION_BUTTON_STATE } from "../../shared/constants/ui-state.js";
import { renderMemberTagChips } from "../../shared/components/member-tag-chips.js";
import { initTagInput } from "../../shared/components/member-tag-input.js";
import { createBusinessNavigation } from "../../shared/components/navigation.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";
import { createHeaderIconButton } from "../../shared/components/header-icon-button.js";
import { getStoredMembers, mergeMemberTagCatalog, saveRegisteredMembers } from "../../shared/storage/member-storage.js";
import { sanitizeTagList } from "../../shared/services/member-tag-service.js";
import { createElement } from "../../shared/utils/dom.js";
import { formatText } from "../../shared/utils/format.js";
import { getAgeOutputText, normalizeBirthDateParts } from "../../shared/utils/member-date.js";
import { formatPhoneNumber, normalizePhoneNumber } from "../../shared/utils/phone.js";

const DEFAULT_DOG_PROFILE_IMAGE = "../assets/defaultProfile_dog.svg";
let toastDismissTimer = null;

export function renderMemberRegistration(rootElement, memberRegistrationState) {
  rootElement.innerHTML = "";

  if (memberRegistrationState.activeScreen === "guardianEdit") {
    rootElement.append(createGuardianEditPage(memberRegistrationState));
    scheduleToastDismiss(memberRegistrationState);
    return;
  }

  rootElement.append(createMemberRegistrationShell(memberRegistrationState));
  scheduleToastDismiss(memberRegistrationState);
}

function rerender(memberRegistrationState) {
  renderMemberRegistration(document.querySelector("#app"), memberRegistrationState);
}

function scheduleToastDismiss(memberRegistrationState) {
  window.clearTimeout(toastDismissTimer);

  if (!memberRegistrationState.toastMessage) {
    return;
  }

  toastDismissTimer = window.setTimeout(() => {
    memberRegistrationState.toastMessage = "";
    rerender(memberRegistrationState);
  }, TOAST_AUTO_DISMISS_MS);
}

function createMemberRegistrationShell(memberRegistrationState) {
  const shell = createElement("main", {
    className: "member-registration-shell",
    dataset: { screen: "memberRegistration" },
  });

  shell.append(createHeader("회원 등록", () => {
    window.location.href = "./member-home.html";
  }));
  shell.append(createSideNavigation());
  shell.append(createContent(memberRegistrationState));
  shell.append(createMobilePrimaryButton("등록", isMemberRegistrationReady(memberRegistrationState), memberRegistrationState));

  if (memberRegistrationState.isGuardianEditModalOpen) {
    shell.append(createGuardianEditModal(memberRegistrationState));
  }

  if (memberRegistrationState.isAddPetBottomSheetOpen) {
    shell.append(createAddPetBottomSheet(memberRegistrationState));
  }

  if (memberRegistrationState.activeAlert) {
    shell.append(createRegistrationAlert(memberRegistrationState));
  }

  if (memberRegistrationState.toastMessage) {
    shell.append(createToast(memberRegistrationState.toastMessage));
  }

  return shell;
}

function createHeader(title, onClose, closeText = "✕") {
  const header = createElement("header", {
    className: "registration-header",
    dataset: { area: "header" },
  });
  header.append(createCloseButton(onClose, closeText, `${title} 닫기`));
  header.append(createElement("strong", { className: "brand-name", textContent: "다이얼독 비즈" }));
  header.append(createElement("h1", { textContent: title }));
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

function createCloseButton(onClick, textContent, ariaLabel) {
  const actionClassName = "button button--icon";
  const button = createHeaderIconButton({
    className: `page-close-button ${actionClassName}`,
    icon: textContent === "←" ? "back" : "close",
    ariaLabel,
    dataset: { action: textContent === "←" ? "backFromMemberRegistration" : "closeMemberRegistration" },
  });

  button.addEventListener("click", onClick);
  return button;
}

function createSideNavigation() {
  return createBusinessNavigation({
    className: "business-navigation registration-navigation",
    dataset: { area: "navigation" },
    profile: {
      imageSrc: DEFAULT_DOG_PROFILE_IMAGE,
      title: "다이얼독",
      subtitle: "애견유치원",
    },
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
}
function createContent(memberRegistrationState) {
  const content = createElement("section", {
    className: "registration-content",
    dataset: { area: "content" },
  });

  const titleBar = createElement("div", { className: "registration-title-bar", dataset: { area: "title" } });
  titleBar.append(createElement("h1", { textContent: "회원 등록" }));
  titleBar.append(createWebActionButtons(memberRegistrationState));

  content.append(titleBar);
  content.append(createGuardianSummary(memberRegistrationState));
  content.append(createPetRegistrationPanel(memberRegistrationState));
  return content;
}

function createGuardianSummary(memberRegistrationState) {
  const member = memberRegistrationState.member;
  const section = createElement("section", {
    className: "card card--section registration-card guardian-summary-section",
    dataset: { area: "guardianInfo" },
  });

  const header = createElement("div", { className: "registration-section-header" });
  const titleGroup = createElement("div", { className: "registration-section-title" });
  titleGroup.append(createElement("h2", { textContent: "보호자 정보" }));
  titleGroup.append(createElement("p", { className: "section-description web-only", textContent: "보호자의 성함과 연락처는 다이얼독 아이디로 사용됩니다." }));
  header.append(titleGroup);
  header.append(createEditGuardianButton(memberRegistrationState));

  const summaryList = createElement("ul", { className: "guardian-summary-list" });
  summaryList.append(createSummaryLine("보호자 이름", formatText(member.guardianName)));
  summaryList.append(createSummaryLine("전화번호", formatText(formatPhoneNumber(member.phoneNumber))));
  summaryList.append(createSummaryLine("주소", formatText(formatGuardianAddress(member))));

  section.append(header);
  section.append(summaryList);
  return section;
}

function createEditGuardianButton(memberRegistrationState) {
  const button = createElement("button", {
    className: "button button--soft",
    type: "button",
    textContent: "수정",
    dataset: { action: "editGuardianInfo" },
  });

  button.addEventListener("click", () => {
    if (isMobileLayout()) {
      memberRegistrationState.activeScreen = "guardianEdit";
    } else {
      memberRegistrationState.isGuardianEditModalOpen = true;
    }

    rerender(memberRegistrationState);
  });

  return button;
}

function createPetRegistrationPanel(memberRegistrationState) {
  const section = createElement("section", {
    className: "card card--section registration-card pet-registration-card",
    dataset: { area: "petRegistration" },
  });

  const header = createElement("div", { className: "registration-section-header" });
  const titleGroup = createElement("div", { className: "registration-section-title" });
  titleGroup.append(createElement("h2", { textContent: "반려견 정보" }));
  titleGroup.append(createElement("p", { className: "section-description web-only", textContent: "이미 등록된 회원이라면 연결할 반려견을 불러오거나 새로 등록할 수 있습니다." }));
  header.append(titleGroup);
  section.append(header);
  section.append(createMobileAddPetButton(memberRegistrationState));
  section.append(createMobilePetList(memberRegistrationState));
  section.append(createPetTabs(memberRegistrationState));

  const activePet = getActivePet(memberRegistrationState);
  section.append(createPetForm(activePet, "web", memberRegistrationState));

  return section;
}

function createPetTabs(memberRegistrationState) {
  const tabs = createElement("div", { className: "pet-tabs web-only", dataset: { area: "petTabs" } });

  memberRegistrationState.petForms.forEach((petForm, index) => {
    const tab = createElement("div", {
      className: index === memberRegistrationState.activePetIndex ? "pet-tab is-selected" : "pet-tab",
      dataset: {
        action: "selectPetForm",
        fallbackLabel: `반려견 ${index + 1}`,
        state: index === memberRegistrationState.activePetIndex ? "selected" : "idle",
      },
    });
    tab.append(createElement("button", {
      className: "pet-tab-label",
      type: "button",
      textContent: petForm.petName ? petForm.petName : `반려견 ${index + 1}`,
    }));

    if (memberRegistrationState.petForms.length >= 2) {
      const deleteButton = createElement("button", {
        className: "pet-tab-delete-button",
        type: "button",
        textContent: "✕",
        ariaLabel: "반려견 삭제",
        dataset: { action: "deletePetForm" },
      });
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deletePetForm(memberRegistrationState, index);
      });
      tab.append(deleteButton);
    }

    tab.addEventListener("click", () => {
      memberRegistrationState.activePetIndex = index;
      rerender(memberRegistrationState);
    });
    tabs.append(tab);
  });

  const addTab = createElement("button", { className: "pet-tab", type: "button", textContent: "+", dataset: { action: "addPetForm" } });
  addTab.addEventListener("click", () => {
    memberRegistrationState.petForms.push(createEmptyPetForm());
    memberRegistrationState.activePetIndex = memberRegistrationState.petForms.length - 1;
    rerender(memberRegistrationState);
  });
  tabs.append(addTab);

  return tabs;
}

function createMobilePetList(memberRegistrationState) {
  const list = createElement("section", {
    className: "mobile-pet-list",
    dataset: { area: "mobilePetList", state: memberRegistrationState.petForms.length ? "list" : "empty" },
  });

  memberRegistrationState.petForms.filter(isPetFormReady).forEach((petForm, index) => {
    const item = createElement("button", {
      className: "mobile-pet-list-item",
      type: "button",
      dataset: { action: "selectPetForm", entity: "pet", entityId: petForm.id || String(index) },
    });
    item.append(createElement("img", { className: "mobile-pet-list-image", src: DEFAULT_DOG_PROFILE_IMAGE, alt: "" }));
    const text = createElement("span", { className: "mobile-pet-list-text" });
    text.append(createElement("strong", { textContent: formatText(petForm.petName) }));
    text.append(createElement("span", { textContent: formatText(petForm.breed) }));
    item.append(text);
    item.append(createElement("span", { className: "mobile-pet-list-arrow", textContent: "›" }));
    list.append(item);
  });

  return list;
}

function deletePetForm(memberRegistrationState, index) {
  if (memberRegistrationState.petForms.length <= 1) {
    return;
  }

  memberRegistrationState.petForms.splice(index, 1);

  if (memberRegistrationState.activePetIndex >= memberRegistrationState.petForms.length) {
    memberRegistrationState.activePetIndex = memberRegistrationState.petForms.length - 1;
  }

  if (memberRegistrationState.activePetIndex < 0) {
    memberRegistrationState.activePetIndex = 0;
  }

  rerender(memberRegistrationState);
}

function createPetForm(petForm, layoutMode, memberRegistrationState) {
  const section = createElement("section", {
    className: layoutMode === "mobile" ? "pet-form-section mobile-pet-form-section" : "pet-form-section web-only",
    dataset: { area: "petForm" },
  });

  const formBody = createElement("div", { className: "pet-form-body" });
  const leftColumn = createElement("div", { className: "pet-form-column pet-form-left" });
  const rightColumn = createElement("div", { className: "pet-form-column pet-form-right" });

  leftColumn.append(createPetPhotoArea());
  leftColumn.append(createPetTextField("반려견 이름", "한글, 영문, 숫자 입력 가능 (12자 이내)", true, petForm, "petName", layoutMode, memberRegistrationState));
  leftColumn.append(createPetTextField("견종", "견종을 검색해 주세요.", true, petForm, "breed", layoutMode, memberRegistrationState, "input", "search"));
  leftColumn.append(createPetTextField("메모", "성격, 알러지 등 필요한 내용을 입력해 주세요. (최대 500자)", false, petForm, "memo", layoutMode, memberRegistrationState, "textarea", "text", "mobile-main-only"));

  if (layoutMode === "mobile") {
    rightColumn.append(createOptionalInfoDivider());
    rightColumn.append(createWeightField(petForm.weight));
  } else {
    leftColumn.append(createWeightField(petForm.weight));
  }
  rightColumn.append(createPetTextField("동물등록번호", "410XXXXXXXXXXXX", false, petForm, "animalRegistrationNumber", layoutMode, memberRegistrationState));
  rightColumn.append(createPetTextField("모색", "20자 이내 입력", false, petForm, "coatColor", layoutMode, memberRegistrationState));
  rightColumn.append(createBirthDateField(petForm));
  rightColumn.append(createChoiceField("성별", ["선택 안함", "남아", "여아"], petForm.gender, (value) => {
    petForm.gender = value;
  }));
  rightColumn.append(createChoiceField("중성화 여부", ["선택안함", "완료", "미완료"], petForm.neuteredStatus, (value) => {
    petForm.neuteredStatus = value;
  }));
  rightColumn.append(createPetTagField(petForm, memberRegistrationState));

  formBody.append(leftColumn);
  formBody.append(rightColumn);
  section.append(formBody);
  section.append(createPetTextField("메모", "성격, 알러지 등 필요한 내용을 입력해 주세요. (최대 500자)", false, petForm, "memo", layoutMode, memberRegistrationState, "textarea", "text", "web-memo-field"));
  return section;
}

function createOptionalInfoDivider() {
  return createElement("div", {
    className: "pet-optional-info-divider",
    textContent: "선택 정보",
    dataset: { area: "optionalPetInfoDivider" },
  });
}

function createPetTagField(petForm, memberRegistrationState) {
  const field = createElement("section", { className: "field registration-field", dataset: { field: "petTags" } });
  field.append(createElement("span", { className: "field__label registration-label", textContent: "태그" }));
  const container = createElement("div", { dataset: { area: "petTagInput" } });
  initTagInput({
    container,
    initialTags: petForm.petTags,
    getCatalog: () => memberRegistrationState.memberTagCatalog || [],
    onChange: (nextTags) => {
      petForm.petTags = nextTags;
    },
  });
  field.append(container);
  return field;
}

function createPetTextField(labelText, placeholder, isRequired, petForm, fieldName, layoutMode, memberRegistrationState, tagName = "input", inputType = "text", extraClassName = "") {
  return createFormField(labelText, placeholder, isRequired, petForm[fieldName], tagName, inputType, extraClassName, {
    onInput: (value) => {
      petForm[fieldName] = value;

      if (fieldName === "petName" && layoutMode === "web") {
        syncActivePetTabLabel(value);
      }

      syncMemberRegistrationButtonState(memberRegistrationState);
      syncAddPetButtonState(petForm);
    },
  });
}

function createPetPhotoArea() {
  const photoArea = createElement("div", { className: "pet-photo-area", dataset: { area: "petProfileImage" } });
  photoArea.append(createElement("img", { className: "pet-photo-image", src: DEFAULT_DOG_PROFILE_IMAGE, alt: "반려견 기본 프로필" }));
  photoArea.append(createElement("button", { className: "pet-photo-button", type: "button", textContent: "+", ariaLabel: "반려견 사진 등록", dataset: { action: "addPetPhoto" } }));
  return photoArea;
}

function createWeightField(value) {
  const field = createFormField("몸무게", "0~999 사이 숫자만 입력", false, value);
  field.className = `${field.className} has-unit`;
  field.append(createElement("span", { className: "input-unit", textContent: "kg" }));
  return field;
}

function createBirthDateField(petForm) {
  const field = createElement("fieldset", { className: "field registration-field birth-date-field", dataset: { field: "생년월일" } });
  field.append(createElement("legend", { className: "field__label registration-label", textContent: "생년월일" }));
  const birthDateParts = String(petForm.birthDate || "").split("-");

  const birthInputs = createElement("div", { className: "birth-date-inputs" });
  const ageOutput = createElement("output", { className: "age-output", textContent: getAgeOutputText(petForm.birthDate) });

  ["연도", "월", "일"].forEach((placeholder, index) => {
    const input = createElement("input", { className: "field__control registration-input birth-date-input", type: "text", placeholder, value: birthDateParts[index] || "" });
    input.addEventListener("input", () => {
      const dateParts = Array.from(birthInputs.querySelectorAll(".birth-date-input")).map((dateInput) => dateInput.value);
      const nextBirthDate = normalizeBirthDateParts(dateParts);
      petForm.birthDate = nextBirthDate;
      ageOutput.textContent = getAgeOutputText(nextBirthDate);
    });
    birthInputs.append(input);
  });
  birthInputs.append(ageOutput);

  field.append(birthInputs);
  field.append(createElement("p", { className: "field-guide-message", textContent: "정확한 생년월일을 모르면 연도만 적어 주세요." }));
  return field;
}

function createChoiceField(labelText, options, selectedValue, onSelect) {
  const field = createElement("fieldset", { className: "field registration-field choice-field", dataset: { field: labelText } });
  field.append(createElement("legend", { className: "field__label registration-label", textContent: labelText }));

  const optionsRow = createElement("div", { className: "choice-options" });
  const groupName = `single-${labelText}-${Math.random().toString(36).slice(2)}`;
  options.forEach((optionText, optionIndex) => {
    const optionValue = ["선택안함", "선택 안함"].includes(optionText) ? "" : optionText;
    const isSelected = selectedValue === optionValue || selectedValue === optionText || (!selectedValue && optionIndex === 0);
    const input = createElement("input", { type: "radio", value: optionValue });
    input.checked = isSelected;
    input.name = groupName;

    const label = createElement("label", { className: "choice-option", dataset: { state: isSelected ? "selected" : "idle" } });
    label.addEventListener("click", () => {
      optionsRow.querySelectorAll(".choice-option").forEach((optionElement) => {
        optionElement.dataset.state = "idle";
        const optionInput = optionElement.querySelector("input");
        if (optionInput) {
          optionInput.checked = false;
        }
      });
      label.dataset.state = "selected";
      input.checked = true;

      if (onSelect) {
        onSelect(optionValue);
      }
    });
    label.append(input);
    label.append(createElement("span", { textContent: optionText }));
    optionsRow.append(label);
  });

  field.append(optionsRow);
  return field;
}

function createFormField(labelText, placeholder, isRequired, value, tagName = "input", inputType = "text", extraClassName = "", options = {}) {
  const field = createElement("label", {
    className: `${tagName === "textarea" ? "field registration-field is-wide" : "field registration-field"} ${extraClassName}`.trim(),
    dataset: { field: labelText },
  });
  const label = createElement("span", { className: "field__label registration-label", textContent: labelText });

  if (isRequired) {
    label.append(createElement("span", { className: "field__required", textContent: " *" }));
  }

  const input = createElement(tagName, {
    className: tagName === "textarea" ? "field__control registration-input registration-textarea" : "field__control registration-input",
    type: tagName === "input" ? inputType : undefined,
    placeholder,
    value: value || "",
  });

  input.addEventListener("input", (event) => {
    if (options.onInput) {
      options.onInput(event.target.value);
    }
  });

  field.append(label);
  field.append(input);

  return field;
}

function createPhoneFormField(labelText, value, options = {}) {
  const field = createFormField(labelText, "010-0000-0000", Boolean(options.required), formatPhoneNumber(value));
  const input = field.querySelector("input");
  input.addEventListener("input", (event) => {
    event.target.value = formatPhoneNumber(event.target.value);
    if (options.onInput) {
      options.onInput(event.target.value);
    }
  });
  return field;
}

function createReadonlyFormField(labelText, value, isRequired) {
  const field = createFormField(labelText, "", isRequired, value);
  const input = field.querySelector("input");
  input.readOnly = true;
  field.className = `${field.className} is-readonly`;
  return field;
}

function createAddressFields(value, detailValue = "", options = {}) {
  const wrapper = createElement("div", { className: "address-fields" });
  const searchRow = createElement("div", { className: "address-search-row" });
  const baseAddressInput = createElement("input", {
    className: "field__control registration-input address-search-input",
    type: "text",
    placeholder: "주소를 검색해 주세요.",
    value: value || "",
    dataset: { field: "baseAddress" },
  });
  baseAddressInput.addEventListener("input", (event) => {
    options.onBaseAddressInput?.(event.target.value);
  });
  searchRow.append(baseAddressInput);
  searchRow.append(createElement("button", { className: "address-search-button", type: "button", textContent: "주소 검색", dataset: { action: "searchAddress" } }));
  wrapper.append(searchRow);
  const detailAddressInput = createElement("input", {
    className: "field__control registration-input address-detail-input",
    type: "text",
    placeholder: "직접 입력",
    value: detailValue || "",
    dataset: { field: "detailAddress" },
  });
  detailAddressInput.addEventListener("input", (event) => {
    options.onDetailAddressInput?.(event.target.value);
  });
  wrapper.append(detailAddressInput);
  return wrapper;
}

function createSummaryLine(label, value) {
  const line = createElement("li", { className: "summary-line" });
  line.append(createElement("span", { textContent: `${label} : ` }));
  line.append(createElement("strong", { textContent: value }));
  return line;
}

function formatGuardianAddress(member) {
  return [member.address, member.addressDetail].filter(Boolean).join(" ");
}

function createRegistrationTagDisplay(title, tags) {
  const memberTags = sanitizeTagList(tags);
  if (memberTags.length === 0) {
    return null;
  }

  const section = createElement("section", { className: "member-tag-section", dataset: { area: "memberTagDisplay" } });
  section.append(createElement("strong", { className: "member-tag-section-title", textContent: title }));
  const chipList = createElement("div", { className: "member-tag-chip-list" });
  renderMemberTagChips(chipList, memberTags);
  section.append(chipList);
  return section;
}

function createWebActionButtons(memberRegistrationState) {
  const isReady = isMemberRegistrationReady(memberRegistrationState);
  const actions = createElement("div", { className: "registration-title-actions web-only", dataset: { area: "titleActions" } });
  const cancelButton = createElement("button", { className: "button button--danger button--title-action", type: "button", textContent: "취소", dataset: { action: "cancelMemberRegistration" } });
  cancelButton.addEventListener("click", () => {
    memberRegistrationState.activeAlert = "cancel";
    rerender(memberRegistrationState);
  });
  actions.append(cancelButton);
  const submitButton = createElement("button", {
    className: "button button--primary button--title-action",
    type: "button",
    textContent: "등록",
    dataset: { action: "submitMemberRegistration", state: isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled },
  });
  submitButton.disabled = !isReady;
  submitButton.addEventListener("click", () => {
    if (!isMemberRegistrationReady(memberRegistrationState)) {
      return;
    }

    memberRegistrationState.activeAlert = "notify";
    rerender(memberRegistrationState);
  });
  actions.append(submitButton);
  return actions;
}

function createMobileAddPetButton(memberRegistrationState) {
  const button = createElement("button", {
    className: "mobile-add-pet-button",
    type: "button",
    textContent: "+ 반려견 추가",
    dataset: { action: "addPet" },
  });
  button.addEventListener("click", () => {
    memberRegistrationState.addPetDraft = createEmptyPetForm();
    memberRegistrationState.isAddPetBottomSheetOpen = true;
    rerender(memberRegistrationState);
  });
  return button;
}

function createMobilePrimaryButton(textContent, isEnabled = false, memberRegistrationState = null) {
  const button = createElement("button", {
    className: "button button--action mobile-registration-primary-button",
    type: "button",
    textContent,
    dataset: {
      action: textContent === "수정" ? "submitGuardianEdit" : "submitMemberRegistration",
      state: isEnabled ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled,
    },
  });
  button.disabled = !isEnabled;
  button.addEventListener("click", () => {
    if (!isEnabled || !memberRegistrationState || textContent !== "등록") {
      return;
    }

    memberRegistrationState.activeAlert = "notify";
    rerender(memberRegistrationState);
  });
  return button;
}

function createGuardianEditModal(memberRegistrationState) {
  const overlay = createElement("section", { className: "guardian-edit-modal-overlay", dataset: { area: "guardianEditModal", modal: "guardianEdit", state: "open" } });
  const modal = createElement("div", { className: "guardian-edit-modal" });

  const header = createElement("div", { className: "modal-title-row" });
  header.append(createElement("h2", { textContent: "보호자 수정" }));
  header.append(createCloseModalButton(memberRegistrationState));

  modal.append(header);
  modal.append(createGuardianEditNotice());
  modal.append(createGuardianEditForm(memberRegistrationState, "web"));
  overlay.append(modal);
  return overlay;
}

function createCloseModalButton(memberRegistrationState) {
  const button = createHeaderIconButton({
    className: "button button--icon modal__close-button",
    icon: "close",
    ariaLabel: "보호자 수정 닫기",
    dataset: { action: "closeGuardianEdit" },
  });
  button.addEventListener("click", () => {
    memberRegistrationState.isGuardianEditModalOpen = false;
    rerender(memberRegistrationState);
  });
  return button;
}

function createGuardianEditNotice() {
  return createElement("section", {
    className: "guardian-edit-notice",
    textContent: "회원의 성함과 전화번호는 수정할 수 없습니다.\n수정이 필요하시면 문의해 주세요.",
  });
}

function createGuardianEditForm(memberRegistrationState, layoutMode) {
  const draft = memberRegistrationState.guardianDraft;
  const form = createElement("section", {
    className: layoutMode === "mobile" ? "guardian-edit-form mobile-guardian-edit-form" : "guardian-edit-form",
    dataset: { area: "guardianEditForm" },
  });

  form.append(createReadonlyFormField("보호자 성함", formatText(draft.guardianName), true));
  form.append(createReadonlyFormField("전화번호", formatPhoneNumber(draft.phoneNumber), true));

  const addressField = createElement("section", { className: "field registration-field address-field", dataset: { field: "address" } });
  addressField.append(createElement("span", { className: "field__label registration-label", textContent: "주소" }));
  addressField.append(createAddressFields(draft.address, draft.addressDetail, {
    onBaseAddressInput: (value) => {
      draft.address = value;
    },
    onDetailAddressInput: (value) => {
      draft.addressDetail = value;
    },
  }));
  form.append(addressField);
  const submitButton = createElement("button", { className: "button button--action guardian-edit-submit-button", type: "button", textContent: "수정", dataset: { action: "submitGuardianEdit", state: ACTION_BUTTON_STATE.enabled } });
  submitButton.addEventListener("click", () => {
    submitGuardianEdit(memberRegistrationState);
  });
  form.append(submitButton);
  return form;
}

function submitGuardianEdit(memberRegistrationState) {
  memberRegistrationState.member.address = memberRegistrationState.guardianDraft.address || "";
  memberRegistrationState.member.addressDetail = memberRegistrationState.guardianDraft.addressDetail || "";
  memberRegistrationState.member.ownerTags = sanitizeTagList(memberRegistrationState.guardianDraft.ownerTags);
  memberRegistrationState.isGuardianEditModalOpen = false;
  memberRegistrationState.activeScreen = "memberRegistration";
  rerender(memberRegistrationState);
}

function createGuardianEditPage(memberRegistrationState) {
  const page = createElement("main", { className: "guardian-edit-page", dataset: { screen: "guardianEdit" } });
  page.append(createHeader("보호자 정보", () => {
    memberRegistrationState.activeScreen = "memberRegistration";
    rerender(memberRegistrationState);
  }, "←"));

  const content = createElement("section", { className: "guardian-edit-page-content", dataset: { area: "content" } });
  content.append(createGuardianEditForm(memberRegistrationState, "mobile"));
  page.append(content);
  page.append(createMobilePrimaryButton("수정", false));
  return page;
}

function createAddPetBottomSheet(memberRegistrationState) {
  const overlay = createElement("section", { className: "pet-bottom-sheet-overlay", dataset: { area: "addPetBottomSheet", modal: "addPetBottomSheet", state: "open" } });
  const sheet = createElement("div", { className: "pet-bottom-sheet" });
  const draftPet = memberRegistrationState.addPetDraft || createEmptyPetForm();

  const header = createElement("header", { className: "bottom-sheet-header" });
  const closeButton = createHeaderIconButton({
    className: "button button--icon bottom-sheet-close-button",
    icon: "close",
    ariaLabel: "반려견 추가 닫기",
    dataset: { action: "closeAddPet" },
  });
  closeButton.addEventListener("click", () => {
    memberRegistrationState.isAddPetBottomSheetOpen = false;
    rerender(memberRegistrationState);
  });
  header.append(closeButton);
  header.append(createElement("h2", { textContent: "반려견 추가" }));
  header.append(createElement("span", { className: "header-spacer" }));

  const body = createElement("section", { className: "bottom-sheet-body" });
  body.append(createPetForm(draftPet, "mobile", memberRegistrationState));

  sheet.append(header);
  sheet.append(body);
  const submitButton = createElement("button", {
    className: "button button--action button--full bottom-sheet-submit-button",
    type: "button",
    textContent: "추가",
    dataset: { action: "submitAddPet", state: isPetFormReady(draftPet) ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled },
  });
  submitButton.disabled = !isPetFormReady(draftPet);
  submitButton.addEventListener("click", () => {
    if (!isPetFormReady(draftPet)) {
      return;
    }

    memberRegistrationState.petForms.push({ ...draftPet });
    memberRegistrationState.activePetIndex = memberRegistrationState.petForms.length - 1;
    memberRegistrationState.isAddPetBottomSheetOpen = false;
    memberRegistrationState.addPetDraft = createEmptyPetForm();
    rerender(memberRegistrationState);
  });
  sheet.append(submitButton);
  overlay.append(sheet);
  return overlay;
}

function createRegistrationAlert(memberRegistrationState) {
  const isCancelAlert = memberRegistrationState.activeAlert === "cancel";
  const overlay = createElement("section", {
    className: "registration-alert-overlay",
    dataset: { area: "registrationAlert", modal: "registrationAlert", state: memberRegistrationState.activeAlert },
  });
  const alert = createElement("div", { className: "registration-alert" });
  const content = createElement("div", { className: "registration-alert-content" });

  if (isCancelAlert) {
    content.append(createElement("p", { textContent: "회원 등록을 취소하시겠습니까?\n작성한 내용은 저장되지 않습니다." }));
  } else {
    content.append(createElement("p", { textContent: "회원 등록 후 회원에게 등록 안내 알림톡을 보내시겠습니까?" }));
    const option = createElement("label", { className: "alert-notify-option" });
    option.append(createElement("input", { type: "checkbox" }));
    option.append(createElement("span", { textContent: "회원 등록 안내 알림톡을 전송할게요. (미리보기)" }));
    content.append(option);
  }

  const actions = createElement("div", { className: "registration-alert-actions modal-footer-actions" });
  const closeButton = createElement("button", { className: "button button--alert-secondary alert-dialog__button", type: "button", textContent: "닫기", dataset: { action: "closeAlert" } });
  closeButton.addEventListener("click", () => {
    memberRegistrationState.activeAlert = "";
    rerender(memberRegistrationState);
  });

  const confirmButton = createElement("button", {
    className: isCancelAlert ? "button button--danger alert-dialog__button" : "button button--primary alert-dialog__button",
    type: "button",
    textContent: isCancelAlert ? "등록 취소" : "등록",
    dataset: { action: isCancelAlert ? "confirmCancelRegistration" : "confirmSubmitRegistration" },
  });
  confirmButton.addEventListener("click", () => {
    if (!isCancelAlert) {
      const memberToRegister = createMemberForRegistration(memberRegistrationState);
      const existingMember = findExistingMemberByGuardian(memberToRegister);
      const savedMembers = saveRegisteredMembers([memberToRegister]);

      if (existingMember) {
        const savedMember = savedMembers.find((member) => member.id === existingMember.id) || existingMember;
        const firstPet = savedMember.pets?.[0];
        if (savedMember.id && firstPet?.id) {
          const params = new URLSearchParams({
            memberId: savedMember.id,
            petId: firstPet.id,
            toast: "existingMember",
          });
          window.location.href = `./member-detail.html?${params.toString()}`;
          return;
        }
      }
    }

    window.location.href = isCancelAlert ? "./member-home.html" : "./member-home.html?toast=memberRegistered";
  });

  actions.append(closeButton);
  actions.append(confirmButton);
  alert.append(content);
  alert.append(actions);
  overlay.append(alert);
  return overlay;
}

function findExistingMemberByGuardian(member) {
  const guardianName = normalizeGuardianName(member?.guardianName);
  const phoneNumber = normalizePhoneNumber(member?.phoneNumber);
  if (!guardianName || !phoneNumber) {
    return null;
  }

  return getStoredMembers().find((storedMember) => {
    return normalizeGuardianName(storedMember.guardianName) === guardianName
      && normalizePhoneNumber(storedMember.phoneNumber) === phoneNumber;
  }) || null;
}

function normalizeGuardianName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function syncActivePetTabLabel(petName) {
  const activeTab = document.querySelector(".pet-tab.is-selected");

  if (!activeTab) {
    return;
  }

  const label = activeTab.querySelector(".pet-tab-label");

  if (!label) {
    return;
  }

  label.textContent = petName.trim() || activeTab.dataset.fallbackLabel || label.textContent;
}

function syncMemberRegistrationButtonState(memberRegistrationState) {
  if (!memberRegistrationState) {
    return;
  }

  const isReady = isMemberRegistrationReady(memberRegistrationState);
  document.querySelectorAll("[data-action='submitMemberRegistration']").forEach((button) => {
    button.disabled = !isReady;
    button.dataset.state = isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled;
  });
}

function syncAddPetButtonState(petForm) {
  const addPetButton = document.querySelector("[data-action='submitAddPet']");

  if (!addPetButton) {
    return;
  }

  const isReady = isPetFormReady(petForm);
  addPetButton.disabled = !isReady;
  addPetButton.dataset.state = isReady ? ACTION_BUTTON_STATE.enabled : ACTION_BUTTON_STATE.disabled;
}

function isMemberRegistrationReady(memberRegistrationState) {
  return memberRegistrationState.petForms.some(isPetFormReady);
}

function createMemberForRegistration(memberRegistrationState) {
  const guardian = memberRegistrationState.member;
  return {
    id: guardian.id,
    guardianName: guardian.guardianName,
    phoneNumber: guardian.phoneNumber,
    address: guardian.address,
    addressDetail: guardian.addressDetail || "",
    ownerTags: sanitizeTagList(guardian.ownerTags),
    isRegistered: true,
    pets: memberRegistrationState.petForms.filter(isPetFormReady).map((petForm) => ({
      ...petForm,
      id: petForm.id,
      petName: petForm.petName,
      dogName: petForm.petName,
      breed: petForm.breed,
      petTags: sanitizeTagList(petForm.petTags),
    })),
  };
}

function isPetFormReady(petForm) {
  return Boolean(String(petForm.petName || "").trim() && String(petForm.breed || "").trim());
}

function getActivePet(memberRegistrationState) {
  return memberRegistrationState.petForms[memberRegistrationState.activePetIndex] || memberRegistrationState.petForms[0] || createEmptyPetForm();
}

function createEmptyPetForm() {
  return {
    id: "",
    petName: "",
    breed: "",
    birthDate: "",
    animalRegistrationNumber: "",
    coatColor: "",
    weight: "",
    gender: "",
    neuteredStatus: "",
    memo: "",
  };
}

function isMobileLayout() {
  return window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
}

