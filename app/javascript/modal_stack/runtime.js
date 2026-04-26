export const SNAPSHOT_KEY = "modalStackSnapshot";
export const FRAGMENT_HEADER = "X-Modal-Stack-Request";

const LAYER_SELECTOR = '[data-modal-stack-target="layer"]';

export class BrowserRuntime {
  constructor({
    dialog,
    body = globalThis.document?.body,
    history = globalThis.history,
    fetcher = globalThis.fetch?.bind(globalThis),
    store = globalThis.sessionStorage,
    documentRef = globalThis.document,
  } = {}) {
    if (!dialog) throw new Error("BrowserRuntime: dialog element required");
    if (!fetcher) throw new Error("BrowserRuntime: fetch implementation required");
    if (!documentRef) throw new Error("BrowserRuntime: document reference required");
    this.dialog = dialog;
    this.body = body;
    this.history = history;
    this.fetcher = fetcher;
    this.store = store;
    this.document = documentRef;
  }

  showDialog() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  closeDialog() {
    if (this.dialog.open) this.dialog.close();
  }

  lockScroll() {
    if (this.body) this.body.dataset.modalStackLocked = "";
  }

  unlockScroll() {
    if (this.body) delete this.body.dataset.modalStackLocked;
  }

  inertLayer({ layerId, value }) {
    const layer = this.#findLayer(layerId);
    if (!layer) return;
    if (value) layer.setAttribute("inert", "");
    else layer.removeAttribute("inert");
  }

  async mountLayer({ layerId, url, depth, variant, dismissible }) {
    const fragment = await this.#fetchFragment(url);
    const layer = this.document.createElement("div");
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible });
    layer.append(...fragment.childNodes);
    this.dialog.appendChild(layer);
  }

  async morphTopLayer({ layerId, url, depth, variant, dismissible }) {
    const fragment = await this.#fetchFragment(url);
    const layer = this.#topLayer();
    if (!layer) return;
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible });
    layer.replaceChildren(...fragment.childNodes);
  }

  unmountTopLayer() {
    this.#topLayer()?.remove();
  }

  unmountAllLayers() {
    for (const layer of this.dialog.querySelectorAll(LAYER_SELECTOR)) {
      layer.remove();
    }
  }

  pushHistory({ url, historyState }) {
    this.history.pushState(historyState, "", url);
  }

  replaceHistory({ url, historyState }) {
    this.history.replaceState(historyState, "", url);
  }

  historyBack({ n }) {
    this.history.go(-n);
  }

  rebuildFromSnapshot() {
    // Forward navigation reconstruction is M2 territory (nested deep-linking).
    this.dialog.dispatchEvent(
      new CustomEvent("modal_stack:rebuild-requested", { bubbles: true }),
    );
  }

  persistSnapshot(json) {
    if (!this.store) return;
    try {
      this.store.setItem(SNAPSHOT_KEY, json);
    } catch {
      // sessionStorage may be full or unavailable (private mode, quota) — best effort.
    }
  }

  clearSnapshot() {
    if (!this.store) return;
    try {
      this.store.removeItem(SNAPSHOT_KEY);
    } catch {
      // ignore
    }
  }

  readSnapshot() {
    if (!this.store) return null;
    try {
      return this.store.getItem(SNAPSHOT_KEY);
    } catch {
      return null;
    }
  }

  #findLayer(layerId) {
    return this.dialog.querySelector(
      `${LAYER_SELECTOR}[data-layer-id="${escapeAttr(layerId)}"]`,
    );
  }

  #topLayer() {
    const layers = this.dialog.querySelectorAll(LAYER_SELECTOR);
    return layers[layers.length - 1] ?? null;
  }

  #applyLayerAttrs(layer, { layerId, depth, variant, dismissible }) {
    layer.dataset.modalStackTarget = "layer";
    layer.dataset.layerId = layerId;
    layer.dataset.depth = String(depth);
    layer.dataset.variant = variant;
    layer.dataset.dismissible = String(dismissible);
  }

  async #fetchFragment(url) {
    const resp = await this.fetcher(url, {
      headers: {
        Accept: "text/html, text/vnd.turbo-stream.html",
        [FRAGMENT_HEADER]: "1",
      },
      credentials: "same-origin",
    });
    if (!resp.ok) {
      throw new Error(`modal_stack: fetch ${url} → ${resp.status}`);
    }
    const html = await resp.text();
    return parseFragment(html, this.document);
  }
}

function parseFragment(html, doc) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = doc.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}

function escapeAttr(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}
