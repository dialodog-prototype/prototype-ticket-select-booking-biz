import { createAppTicketDetailScreen } from "../member-detail/member-detail-renderer.js";

export function renderMemberTicketUsage(rootElement, state) {
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
}

function createMemberDetailUrl(state) {
  const params = new URLSearchParams({
    memberId: state.selectedMember?.id || "",
    petId: state.selectedPet?.id || "",
  });
  return `./member-detail.html?${params.toString()}`;
}
