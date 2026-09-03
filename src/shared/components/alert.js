import { createElement } from "../utils/dom.js";

export function createAlertDialog(options = {}) {
  const overlay = createElement("section", {
    className: options.overlayClassName || "alert-overlay",
    dataset: {
      area: options.area || "alertDialog",
      modal: options.modal || "alertDialog",
      state: options.state || "open",
      ...(options.dataset || {}),
    },
  });

  const dialog = createElement("div", {
    className: options.className || "alert-dialog",
    dataset: { area: "alertDialogContent" },
  });

  const content = createElement("div", {
    className: options.contentClassName || "alert-dialog-content",
  });

  if (options.title) {
    content.append(createElement("strong", {
      className: "alert-dialog-title",
      textContent: options.title,
    }));
  }

  if (options.message) {
    content.append(createElement("p", {
      className: "alert-dialog-message",
      textContent: options.message,
    }));
  }

  if (options.contentNode) {
    content.append(options.contentNode);
  }

  const actions = createElement("div", {
    className: `${options.actionsClassName || "alert-dialog-actions"} modal-footer-actions`,
  });

  (options.actions || []).forEach((action) => {
    const button = createElement("button", {
      className: getAlertActionClassName(action),
      type: "button",
      textContent: action.label,
      dataset: {
        action: action.action || "closeAlert",
        variant: action.variant || "primary",
        ...(action.dataset || {}),
      },
    });
    button.addEventListener("click", (event) => {
      action.onClick?.(event);
    });
    actions.append(button);
  });

  dialog.append(content);
  if (actions.childElementCount) {
    dialog.append(actions);
  }
  overlay.append(dialog);
  return overlay;
}

export function createConfirmAlert(options = {}) {
  return createAlertDialog({
    ...options,
    actions: [
      {
        label: options.confirmLabel || "확인",
        variant: "primary",
        action: options.confirmAction || "confirmAlert",
        onClick: options.onConfirm,
      },
    ],
  });
}

function getAlertActionClassName(action) {
  if (action.className) {
    return action.className;
  }

  const variant = action.variant || "primary";
  const variantClassName = {
    danger: "button--danger",
    secondary: "button--alert-secondary",
    primary: "button--primary",
  }[variant] || "button--primary";
  return `button ${variantClassName} alert-dialog__button`;
}
