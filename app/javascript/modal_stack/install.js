import { ModalStackBackLinkController } from "./controllers/modal_stack_back_link_controller.js";
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
  application.register("modal-stack-back-link", ModalStackBackLinkController);
  return application;
}

export {
  ModalStackBackLinkController,
  ModalStackController,
  ModalStackLinkController,
};
