import { Controller } from "@hotwired/stimulus";

export class ModalStackLinkController extends Controller {
  open(event) {
    const stack = document.querySelector('[data-controller~="modal-stack"]');
    if (!stack) return;

    const controller = this.application.getControllerForElementAndIdentifier(
      stack,
      "modal-stack",
    );
    if (!controller) return;

    event.preventDefault();
    const ds = this.element.dataset;
    controller.push({
      id: generateLayerId(),
      url: this.element.href,
      variant: ds.modalStackLinkVariant || "modal",
      side: ds.modalStackLinkSide,
      size: ds.modalStackLinkSize,
      dismissible: ds.modalStackLinkDismissible !== "false",
    });
  }
}

function generateLayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
