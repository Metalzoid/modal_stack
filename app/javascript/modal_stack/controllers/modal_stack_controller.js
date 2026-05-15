import { Controller } from "@hotwired/stimulus";
import { Orchestrator } from "../orchestrator.js";
import { BrowserRuntime } from "../runtime.js";
import { restore } from "../state.js";

export class ModalStackController extends Controller {
  static values = {
    stackId: String,
    baseUrl: String,
    maxDepth: { type: Number, default: 0 },
    maxDepthStrategy: { type: String, default: "warn" },
  };

  #restoring = false;

  connect() {
    const baseUrl = this.baseUrlValue || window.location.href;

    this.runtime = new BrowserRuntime({ dialog: this.element });
    // Restore frame HTML cache before reading snapshot so wizard frames
    // saved in sessionStorage are available during #restoreSnapshot.
    this.runtime.restoreFrameCacheFromStorage();
    const savedSnapshot = this.runtime.readSnapshot();

    // Peek at the snapshot (without stackId filter) to reuse the saved
    // stackId across page reloads — otherwise a randomly generated stackId
    // would never match the one saved in sessionStorage.
    const snapshotState = savedSnapshot ? restore(savedSnapshot) : null;
    const stackId =
      this.stackIdValue || snapshotState?.stackId || generateLayerId();

    this.orchestrator = new Orchestrator({
      runtime: this.runtime,
      stackId,
      baseUrl,
      // Restoration is handled below via push() so each layer gets a
      // phantom history entry and the back button closes them one by one.
      restoreFrom: null,
      // Stimulus Number values default to 0, but state.js treats null as
      // "no cap" — so map 0/missing to null here.
      maxDepth: this.maxDepthValue > 0 ? this.maxDepthValue : null,
      maxDepthStrategy: this.maxDepthStrategyValue || "warn",
    });

    this._onPopstate = (event) => {
      // Run in capture phase so we fire before Turbo's bubble-phase popstate
      // handler. When the popstate was triggered by our own historyBack
      // (expectedPopstates > 0), stop propagation immediately after processing
      // so Turbo never sees the event and cannot start a restoration visit
      // (which shows the loading bar and replaces the body).
      const isOwn = this.orchestrator.expectedPopstates > 0;
      this.orchestrator.onPopstate({
        historyState: event.state,
        locationHref: window.location.href,
      });
      if (isOwn) event.stopImmediatePropagation();
    };
    window.addEventListener("popstate", this._onPopstate, true);

    this._onCancel = (event) => {
      event.preventDefault();
      if (!this.element.open) return;
      if (this.#restoring) return;
      const top = this.#topLayer();
      if (!top || top.dismissible === false) return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("cancel", this._onCancel);

    this._onBackdropClick = (event) => {
      if (event.target !== this.element) return;
      if (!this.element.open) return;
      if (this.#restoring) return;
      const top = this.#topLayer();
      if (!top || top.dismissible === false) return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("click", this._onBackdropClick);

    // After any Turbo render (restoration, morph, stream-driven page update),
    // re-check scroll lock. A snapshot cached while a modal was open can
    // restore data-modal-stack-locked on body even after the modal has closed.
    // turbo:before-cache strips the attribute before caching; this is the
    // safety net for renders that fire from an already-stale cache.
    this._onTurboRender = () => {
      if (this.orchestrator.depth === 0) this.runtime.unlockScroll();
    };
    document.addEventListener("turbo:render", this._onTurboRender);

    this.#registerStreamActions();

    if (snapshotState?.layers?.length > 0) {
      this.#restoring = true;
      this.#restoreSnapshot(snapshotState.layers)
        .catch((err) =>
          console.warn("[modal_stack] snapshot restore failed:", err),
        )
        .finally(() => {
          this.#restoring = false;
        });
    }

    this.element.dispatchEvent(
      new CustomEvent("modal_stack:ready", {
        bubbles: true,
        detail: { stackId },
      }),
    );
  }

  async #restoreSnapshot(layers) {
    // Always open each layer from its first frame URL (accessible via GET).
    const baseUrls = layers.map((l) => l.frames?.[0]?.url ?? l.url);

    // Pre-fetch base frames in parallel so the push loop runs without any
    // network await between iterations, eliminating the race window where
    // Escape fires while this.state lags behind (only partial stack).
    const baseFragments = await Promise.all(
      baseUrls.map((url) => this.orchestrator.prefetch(url).catch(() => null)),
    );

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      await this.orchestrator.push(
        {
          id: layer.id,
          url: baseUrls[i],
          variant: layer.variant,
          dismissible: layer.dismissible,
          size: layer.size,
          side: layer.side,
          width: layer.width,
          height: layer.height,
        },
        { fragment: baseFragments[i] },
      );

      // Restore additional wizard frames using HTML saved to sessionStorage
      // on the previous visit. Each frame may be a POST-only step that 404s
      // on a direct GET — we use the cached HTML instead of re-fetching.
      const extraFrames = (layer.frames ?? []).slice(1);
      for (let fi = 0; fi < extraFrames.length; fi++) {
        const frame = extraFrames[fi];
        const frameIndex = fi + 1;
        const cached = this.runtime.getFrameFragment(layer.id, frameIndex);
        if (!cached) break; // Can't restore beyond this frame — stop here
        // Warm the orchestrator's fragment cache so forward re-navigation
        // after a back doesn't attempt a failing GET for this URL.
        this.orchestrator.setFragmentCache(frame.url, cached.cloneNode(true));
        await this.orchestrator.pathTo(
          { url: frame.url, stale: frame.stale },
          { fragment: cached.cloneNode(true) },
        );
      }
    }
  }

  disconnect() {
    window.removeEventListener("popstate", this._onPopstate, true);
    this.element.removeEventListener("cancel", this._onCancel);
    this.element.removeEventListener("click", this._onBackdropClick);
    document.removeEventListener("turbo:render", this._onTurboRender);
    this.runtime.destroy?.();
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

  // Stimulus action — wire up via data-action="click->modal-stack#pathBack"
  // on any button/link inside a modal panel.
  pathBack(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const steps = readSteps(event);
    return this.orchestrator.pathBack({ steps });
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

    StreamActions.modal_path_to = guarded("modal_path_to", function (orch) {
      return orch.pathTo(frameFromStreamElement(this), {
        fragment: this.templateContent.cloneNode(true),
        transition: this.dataset.transition || null,
      });
    });

    StreamActions.modal_path_back = guarded("modal_path_back", function (orch) {
      const steps = parsePositiveInt(this.dataset.steps, 1);
      return orch.pathBack({
        steps,
        transition: this.dataset.transition || null,
      });
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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function frameFromStreamElement(el) {
  return {
    url: el.dataset.url || window.location.href,
    stale: el.dataset.stale === "true" || el.dataset.stale === "1",
  };
}

function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Steps for pathBack come from either Stimulus action params
// (data-modal-stack-steps-param) or a plain data-steps attribute on
// the action target, e.g. <button data-modal-stack-steps-param="2">.
function readSteps(event) {
  const params = event?.params;
  if (params && Number.isFinite(params.steps) && params.steps > 0) {
    return params.steps;
  }
  const target = event?.currentTarget ?? event?.target;
  return parsePositiveInt(target?.dataset?.steps, 1);
}
