import { createElement } from "../utils/dom.js";

export const TOAST_AUTO_DISMISS_MS = 1500;

export function createToast(message) {
  return createElement("aside", {
    className: "toast-popup",
    textContent: message,
    dataset: { role: "toast", state: "visible" },
  });
}
