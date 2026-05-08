import { Controller } from "@hotwired/stimulus";
import { Orchestrator } from "../orchestrator.js";
import { BrowserRuntime } from "../runtime.js";

export class ModalStackController extends Controller {
  static values = {
    stackId: String,
    baseUrl: String,
    maxDepth: { type: Number, default: 0 },
    maxDepthStrategy: { type: String, default: "warn" },
  };

  connect() {
    const stackId = this.stackIdValue || generateLayerId();
    const baseUrl = this.baseUrlValue || window.location.href;

    this.runtime = new BrowserRuntime({ dialog: this.element });
    const snapshot = this.runtime.readSnapshot();

    this.orchestrator = new Orchestrator({
      runtime: this.runtime,
      stackId,
      baseUrl,
      restoreFrom: snapshot,
      // Stimulus Number values default to 0, but state.js treats null as
      // "no cap" — so map 0/missing to null here.
      maxDepth: this.maxDepthValue > 0 ? this.maxDepthValue : null,
      maxDepthStrategy: this.maxDepthStrategyValue || "warn",
    });

    this._onPopstate = (event) =>
      this.orchestrator.onPopstate({
        historyState: event.state,
        locationHref: window.location.href,
      });
    window.addEventListener("popstate", this._onPopstate);

    this._onCancel = (event) => {
      event.preventDefault();
      const top = this.#topLayer();
      if (!top || top.dismissible === false) return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("cancel", this._onCancel);

    this._onBackdropClick = (event) => {
      if (event.target !== this.element) return;
      const top = this.#topLayer();
      if (!top || top.dismissible === false) return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("click", this._onBackdropClick);

    this.#registerStreamActions();
    this.element.dispatchEvent(
      new CustomEvent("modal_stack:ready", { bubbles: true, detail: { stackId } }),
    );
  }

  disconnect() {
    window.removeEventListener("popstate", this._onPopstate);
    this.element.removeEventListener("cancel", this._onCancel);
    this.element.removeEventListener("click", this._onBackdropClick);
  }

  push(layer, opts) {
    return this.orchestrator.push(layer, opts);
  }

  pop() {
    return this.orchestrator.pop();
  }

  replaceTop(patch, opts) {
    return this.orchestrator.replaceTop(patch, opts);
  }

  closeAll() {
    return this.orchestrator.closeAll();
  }

  prefetch(url) {
    return this.orchestrator.prefetch(url);
  }

  #topLayer() {
    const layers = this.orchestrator.layers;
    return layers[layers.length - 1] ?? null;
  }

  #registerStreamActions() {
    const Turbo = globalThis.Turbo;
    if (!Turbo) {
      console.warn(
        "[modal_stack] Turbo is not loaded; modal_push/pop/replace stream actions are disabled. " +
          "Ensure turbo-rails (or @hotwired/turbo) loads before modal_stack.",
      );
      return;
    }
    const StreamActions = Turbo.StreamActions || (Turbo.StreamActions = {});
    const orchestrator = this.orchestrator;
    const dialog = this.element;

    // Wraps a stream-action body so a malformed payload (bad data-*, fetch
    // 500, etc.) doesn't bubble up and break the page. The error is logged
    // and re-emitted as `modal_stack:error` so apps can surface UI feedback.
    const guarded = (action, fn) =>
      function guardedStreamAction() {
        try {
          const result = fn.call(this, orchestrator);
          if (result && typeof result.catch === "function") {
            result.catch((err) => emitStreamError(dialog, action, err));
          }
        } catch (err) {
          emitStreamError(dialog, action, err);
        }
      };

    StreamActions.modal_push = guarded("modal_push", function (orch) {
      return orch.push(layerFromStreamElement(this), {
        fragment: this.templateContent.cloneNode(true),
      });
    });

    StreamActions.modal_pop = guarded("modal_pop", function (orch) {
      return orch.pop();
    });

    StreamActions.modal_replace = guarded("modal_replace", function (orch) {
      return orch.replaceTop(layerPatchFromStreamElement(this), {
        fragment: this.templateContent.cloneNode(true),
        historyMode: this.dataset.historyMode || "replace",
      });
    });

    StreamActions.modal_close_all = guarded("modal_close_all", function (orch) {
      return orch.closeAll();
    });
  }
}

function emitStreamError(dialog, action, error) {
  if (typeof console !== "undefined" && console.error) {
    console.error(`[modal_stack] stream action "${action}" failed:`, error);
  }
  dialog.dispatchEvent(
    new CustomEvent("modal_stack:error", {
      bubbles: true,
      cancelable: false,
      detail: { action, error },
    }),
  );
}

function layerFromStreamElement(el) {
  return {
    id: el.dataset.layerId || generateLayerId(),
    url: el.dataset.url || window.location.href,
    variant: el.dataset.variant || "modal",
    side: el.dataset.side,
    size: el.dataset.size,
    width: el.dataset.width,
    height: el.dataset.height,
    dismissible: el.dataset.dismissible !== "false",
  };
}

function layerPatchFromStreamElement(el) {
  const patch = {};
  if (el.dataset.layerId) patch.id = el.dataset.layerId;
  if (el.dataset.url) patch.url = el.dataset.url;
  if (el.dataset.variant) patch.variant = el.dataset.variant;
  if (el.dataset.side) patch.side = el.dataset.side;
  if (el.dataset.size) patch.size = el.dataset.size;
  if (el.dataset.width) patch.width = el.dataset.width;
  if (el.dataset.height) patch.height = el.dataset.height;
  if (el.dataset.dismissible != null) {
    patch.dismissible = el.dataset.dismissible !== "false";
  }
  return patch;
}

function generateLayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
