import { createElement } from "../utils/dom.js";

export const TOAST_AUTO_DISMISS_MS = 1500;

export function createToast(message) {
  return createElement("aside", {
    className: "toast-popup",
    textContent: message,
    dataset: { role: "toast", state: "visible" },
  });
}

let operationToastTimer;
window.addEventListener("prototype:operation-failed", () => {
  document.querySelector('[data-area="operationFeedback"]')?.remove();
  const toast = createToast("네트워크 혹은 일시적인 오류가 발생했습니다. 다시 시도해 주세요.");
  toast.dataset.area = "operationFeedback";
  toast.setAttribute("role", "status");
  document.body.append(toast);
  window.clearTimeout(operationToastTimer);
  operationToastTimer = window.setTimeout(() => toast.remove(), TOAST_AUTO_DISMISS_MS);
});
window.addEventListener("error", (event) => {
  if (event.error?.isPrototypeOperationError) event.preventDefault();
});
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.isPrototypeOperationError) event.preventDefault();
});
