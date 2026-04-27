import { ModalStackController } from "./controllers/modal_stack_controller.js";
import { ModalStackLinkController } from "./controllers/modal_stack_link_controller.js";

export function install(application) {
  if (!application || typeof application.register !== "function") {
    throw new Error(
      "modal_stack: install(application) requires a Stimulus Application instance",
    );
  }
  application.register("modal-stack", ModalStackController);
  application.register("modal-stack-link", ModalStackLinkController);
  return application;
}

export { ModalStackController, ModalStackLinkController };
