import { createElement } from "../utils/dom.js";

const MODAL_SELECTOR = '[data-modal-root="true"]';
const CONTROL_SELECTOR = 'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]';
const settings = new WeakMap();
let activeModals = [];
let observer;
let savedOverflow;
let lastFocus = null;

// Capture the opener before a feature replaces the screen DOM.
document.addEventListener("focusin", rememberFocus);

// Features retain their content and state. This module owns only modal UI behavior.
export function createModalOverlay(options = {}, behavior = {}) {
  return prepareModalOverlay(createElement("section", options), behavior);
}

// Also supports overlays defined in HTML templates. Escape remains opt-in.
export function prepareModalOverlay(overlay, { onEscape, returnFocusTo } = {}) {
  if (settings.has(overlay)) return overlay;
  overlay.dataset.modalRoot = "true";
  settings.set(overlay, {
    onEscape,
    returnFocus: describeFocus(returnFocusTo || document.activeElement) || lastFocus,
  });
  for (const type of ["pointerdown", "click"]) {
    overlay.addEventListener(type, (event) => {
      if (event.target !== overlay) return;
      event.preventDefault();
      event.stopPropagation();
    });
  }
  if (!observer) {
    // Observe mounting/removal because state-driven screens replace their DOM.
    observer = new MutationObserver(syncModals);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", syncModals);
  }
  return overlay;
}

function isVisible(element) {
  return element.isConnected && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== "hidden";
}

function describeFocus(element) {
  if (!(element instanceof HTMLElement) || element === document.body) return null;
  const selector = ["id", "data-action", "data-field", "data-entity-id", "name", "value"]
    .filter((attribute) => element.hasAttribute(attribute))
    .map((attribute) => `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`).join("");
  return { element, selector };
}

function resolveFocus(target, root = document) {
  if (!target) return null;
  if (root.contains(target.element) && isVisible(target.element) && !target.element.disabled) return target.element;
  return target.selector ? [...root.querySelectorAll(target.selector)]
    .find((element) => isVisible(element) && !element.disabled) : null;
}

function controlsIn(overlay) {
  return [...overlay.querySelectorAll(CONTROL_SELECTOR)].filter((element) => {
    if (element.closest(MODAL_SELECTOR) !== overlay || element.matches(":disabled") || element.tabIndex < 0 || !isVisible(element)) return false;
    if (element.type !== "radio" || !element.name) return true;
    const group = [...overlay.querySelectorAll('input[type="radio"]')]
      .filter((radio) => radio.name === element.name && radio.form === element.form && !radio.matches(":disabled") && radio.tabIndex >= 0 && isVisible(radio));
    return element === (group.find((radio) => radio.checked) || group[0]);
  });
}

function focusModal(record, preferred) {
  const dialog = record.overlay.firstElementChild;
  const target = resolveFocus(preferred, record.overlay) || controlsIn(record.overlay)[0] || dialog;
  if (target) {
    if (target === dialog && !target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
}

function syncModals() {
  const previous = activeModals;
  activeModals = [...document.querySelectorAll(MODAL_SELECTOR)].filter(isVisible).map((overlay) => {
    const key = overlay.dataset.modal || overlay.dataset.area;
    const existing = previous.find((record) => record.overlay === overlay)
      || previous.find((record) => !record.overlay.isConnected && key && record.key === key);
    const config = settings.get(overlay);
    const replaced = previous.find((record) => !record.overlay.isConnected
      && config.returnFocus && record.overlay.contains(config.returnFocus.element));
    const dialog = overlay.firstElementChild;
    if (dialog) {
      if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
    }
    return {
      ...existing,
      ...config,
      returnFocus: existing?.returnFocus || replaced?.returnFocus || config.returnFocus,
      overlay,
      key,
    };
  });

  if (activeModals.length && !savedOverflow) {
    savedOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  } else if (!activeModals.length && savedOverflow) {
    [document.documentElement.style.overflow, document.body.style.overflow] = savedOverflow;
    savedOverflow = null;
  }

  const top = activeModals.at(-1);
  const previousTop = previous.at(-1);
  const removedTop = previousTop && !activeModals.some((record) => record.overlay === previousTop.overlay || (record.key && record.key === previousTop.key));
  const returnTarget = removedTop && resolveFocus(previousTop.returnFocus);
  if (returnTarget && (!top || returnTarget.closest(MODAL_SELECTOR) === top.overlay)) {
    returnTarget.focus({ preventScroll: true });
  } else if (top && document.activeElement.closest(MODAL_SELECTOR) !== top.overlay) {
    focusModal(top, top.lastFocus);
  }
}

function rememberFocus(event) {
  lastFocus = describeFocus(event.target);
  const top = activeModals.at(-1);
  if (top && event.target.closest(MODAL_SELECTOR) === top.overlay) {
    top.lastFocus = describeFocus(event.target);
  }
}

function handleKeydown(event) {
  const top = activeModals.at(-1);
  if (!top || event.defaultPrevented) return;
  if (event.key === "Escape") {
    event.stopPropagation();
    if (top.onEscape) {
      event.preventDefault();
      top.onEscape();
    }
  }
  if (event.key !== "Tab") return;
  const controls = controlsIn(top.overlay);
  const first = controls[0], last = controls.at(-1);
  if (!first) {
    event.preventDefault();
    focusModal(top);
  } else if (!controls.includes(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
