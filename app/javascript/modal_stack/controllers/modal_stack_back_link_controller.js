import { Controller } from "@hotwired/stimulus";

// Backed by `<%= modal_back_link %>`. Triggers orchestrator.pathBack on
// click; falls back to a no-op when no modal-stack controller is on the
// page (e.g. server-side rendered link viewed outside a modal).
export class ModalStackBackLinkController extends Controller {
  static values = {
    steps: { type: Number, default: 1 },
  };

  trigger(event) {
    const stackController = this.#stackController();
    if (!stackController) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    stackController.orchestrator.pathBack({
      steps: this.stepsValue > 0 ? this.stepsValue : 1,
    });
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
