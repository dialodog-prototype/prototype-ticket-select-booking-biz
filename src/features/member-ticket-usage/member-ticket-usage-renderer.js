import { createAppTicketDetailScreen } from "../member-detail/member-detail-renderer.js";
import { createToast, TOAST_AUTO_DISMISS_MS } from "../../shared/components/toast.js";

let toastDismissTimer;

export function renderMemberTicketUsage(rootElement, state) {
  window.clearTimeout(toastDismissTimer);
  rootElement.innerHTML = "";
  rootElement.append(createAppTicketDetailScreen(state, {
    layout: "stacked",
    onBack: () => {
      window.location.href = createMemberDetailUrl(state);
    },
    onChange: () => {
      renderMemberTicketUsage(rootElement, state);
    },
  }));
  if (state.toastMessage) {
    const toast = createToast(state.toastMessage);
    rootElement.append(toast);
    toastDismissTimer = window.setTimeout(() => {
      state.toastMessage = "";
      toast.remove();
    }, TOAST_AUTO_DISMISS_MS);
  }
}

function createMemberDetailUrl(state) {
  const params = new URLSearchParams({
    memberId: state.selectedMember?.id || "",
    petId: state.selectedPet?.id || "",
  });
  return `./member-detail.html?${params.toString()}`;
}
