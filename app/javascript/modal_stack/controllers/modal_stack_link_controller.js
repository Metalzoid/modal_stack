import { Controller } from "@hotwired/stimulus";

export class ModalStackLinkController extends Controller {
  connect() {
    if (this.element.dataset.modalStackLinkPrefetch === "false") return;
    this._onIntent = () => this.#warm();
    this.element.addEventListener("pointerenter", this._onIntent);
    this.element.addEventListener("focus", this._onIntent);
  }

  disconnect() {
    if (!this._onIntent) return;
    this.element.removeEventListener("pointerenter", this._onIntent);
    this.element.removeEventListener("focus", this._onIntent);
  }

  open(event) {
    const controller = this.#stackController();
    if (!controller) return;

    event.preventDefault();
    const ds = this.element.dataset;
    controller.push({
      id: generateLayerId(),
      url: this.element.href,
      variant: ds.modalStackLinkVariant || "modal",
      side: ds.modalStackLinkSide,
      size: ds.modalStackLinkSize,
      width: ds.modalStackLinkWidth,
      height: ds.modalStackLinkHeight,
      dismissible: ds.modalStackLinkDismissible !== "false",
    });
  }

  #warm() {
    const controller = this.#stackController();
    if (!controller || typeof controller.prefetch !== "function") return;
    controller.prefetch(this.element.href);
  }

  #stackController() {
    const stack = document.querySelector('[data-controller~="modal-stack"]');
    if (!stack) return null;
    return this.application.getControllerForElementAndIdentifier(
      stack,
      "modal-stack",
    );
  }
}

function generateLayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
