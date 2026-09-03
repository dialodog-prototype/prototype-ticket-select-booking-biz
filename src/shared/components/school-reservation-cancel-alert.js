import { createAlertDialog } from "./alert.js";

export function createSchoolReservationCancelAlert({ onClose, onConfirm } = {}) {
  let overlay;
  const close = () => {
    overlay?.remove();
    onClose?.();
  };
  const confirm = () => {
    close();
    onConfirm?.();
  };

  overlay = createAlertDialog({
    className: "school-reservation-cancel-alert",
    area: "schoolReservationCancelAlert",
    modal: "schoolReservationCancelAlert",
    message: "선택한 회원의 예약을 취소하시겠습니까?\n한 번 취소된 예약은 복원할 수 없습니다.",
    actions: [
      { label: "닫기", variant: "secondary", onClick: close },
      { label: "예약 취소", variant: "danger", onClick: confirm },
    ],
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  return overlay;
}
