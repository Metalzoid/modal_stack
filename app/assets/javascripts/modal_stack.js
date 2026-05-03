// app/javascript/modal_stack/controllers/modal_stack_controller.js
import { Controller } from "@hotwired/stimulus";

// app/javascript/modal_stack/state.js
var VARIANTS = Object.freeze([
  "modal",
  "drawer",
  "bottom_sheet",
  "confirmation"
]);
var SNAPSHOT_VERSION = 1;
var DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;
var DRAWER_SIDES = Object.freeze(["left", "right", "top", "bottom"]);
var MAX_DEPTH_STRATEGIES = Object.freeze(["raise", "warn", "silent"]);

class ModalStackDepthError extends Error {
  constructor({ maxDepth, attemptedDepth }) {
    super(`modal_stack: cannot push past max_depth=${maxDepth} ` + `(attempted depth=${attemptedDepth})`);
    this.name = "ModalStackDepthError";
    this.maxDepth = maxDepth;
    this.attemptedDepth = attemptedDepth;
  }
}
function normalizeLayerOptions({ variant, size, side, width, height }) {
  const normalizedSide = variant === "drawer" ? side ?? "right" : side ?? null;
  if (variant === "drawer" && !DRAWER_SIDES.includes(normalizedSide)) {
    throw new Error(`unknown drawer side: ${normalizedSide}`);
  }
  return {
    size: size ?? null,
    side: normalizedSide,
    width: width ?? null,
    height: height ?? null
  };
}
function freezeLayer({ id, url, variant, dismissible, size, side, width, height }) {
  const normalized = normalizeLayerOptions({ variant, size, side, width, height });
  return Object.freeze({
    id,
    url,
    variant,
    dismissible: !!dismissible,
    size: normalized.size,
    side: normalized.side,
    width: normalized.width,
    height: normalized.height
  });
}
function createStack({ stackId, baseUrl }) {
  if (!stackId)
    throw new Error("stackId required");
  if (!baseUrl)
    throw new Error("baseUrl required");
  return Object.freeze({ stackId, baseUrl, layers: Object.freeze([]) });
}
function topLayer(state) {
  return state.layers[state.layers.length - 1] ?? null;
}
function push(state, layer, options = {}) {
  if (!layer?.id)
    throw new Error("layer.id required");
  if (!layer?.url)
    throw new Error("layer.url required");
  const variant = layer.variant ?? "modal";
  if (!VARIANTS.includes(variant)) {
    throw new Error(`unknown variant: ${variant}`);
  }
  const { maxDepth = null, maxDepthStrategy = "warn" } = options;
  if (maxDepth != null && state.layers.length >= maxDepth) {
    if (!MAX_DEPTH_STRATEGIES.includes(maxDepthStrategy)) {
      throw new Error(`unknown maxDepthStrategy: ${maxDepthStrategy} (expected one of ${MAX_DEPTH_STRATEGIES.join(", ")})`);
    }
    if (maxDepthStrategy === "raise") {
      throw new ModalStackDepthError({
        maxDepth,
        attemptedDepth: state.layers.length + 1
      });
    }
    if (maxDepthStrategy === "warn" && typeof console !== "undefined") {
      console.warn(`[modal_stack] push ignored: stack is at max_depth=${maxDepth}. ` + `Set ModalStack.configuration.max_depth higher, or use ` + `max_depth_strategy = :silent to suppress this warning.`);
    }
    return { state, commands: [] };
  }
  const newLayer = freezeLayer({
    id: layer.id,
    url: layer.url,
    variant,
    dismissible: layer.dismissible ?? true,
    size: layer.size,
    side: layer.side,
    width: layer.width,
    height: layer.height
  });
  const previousTop = topLayer(state);
  const layers = Object.freeze([...state.layers, newLayer]);
  const depth = layers.length;
  const commands = [];
  commands.push({
    type: "mountLayer",
    layerId: newLayer.id,
    url: newLayer.url,
    depth,
    variant: newLayer.variant,
    dismissible: newLayer.dismissible,
    ...newLayer.size ? { size: newLayer.size } : {},
    ...newLayer.side ? { side: newLayer.side } : {},
    ...newLayer.width ? { width: newLayer.width } : {},
    ...newLayer.height ? { height: newLayer.height } : {}
  });
  if (depth === 1) {
    commands.push({ type: "showDialog" });
    commands.push({ type: "lockScroll" });
  } else {
    commands.push({ type: "inertLayer", layerId: previousTop.id, value: true });
  }
  commands.push({
    type: "pushHistory",
    url: newLayer.url,
    historyState: { stackId: state.stackId, layerId: newLayer.id, depth }
  });
  commands.push({ type: "persistSnapshot" });
  return { state: { ...state, layers }, commands };
}
function pop(state) {
  if (state.layers.length === 0)
    return { state, commands: [] };
  const newLayers = Object.freeze(state.layers.slice(0, -1));
  const newTop = newLayers[newLayers.length - 1] ?? null;
  const commands = [
    { type: "unmountTopLayer" },
    { type: "historyBack", n: 1 }
  ];
  if (newTop) {
    commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
    commands.push({ type: "persistSnapshot" });
  } else {
    commands.push({ type: "closeDialog" });
    commands.push({ type: "unlockScroll" });
    commands.push({ type: "clearSnapshot" });
  }
  return { state: { ...state, layers: newLayers }, commands };
}
function replaceTop(state, patch, { historyMode = "replace" } = {}) {
  if (state.layers.length === 0) {
    throw new Error("replaceTop requires at least one layer");
  }
  if (historyMode !== "push" && historyMode !== "replace") {
    throw new Error(`unknown historyMode: ${historyMode}`);
  }
  const top = topLayer(state);
  const next = freezeLayer({
    id: patch.id ?? top.id,
    url: patch.url ?? top.url,
    variant: patch.variant ?? top.variant,
    dismissible: patch.dismissible ?? top.dismissible,
    size: patch.size ?? top.size,
    side: patch.side ?? top.side,
    width: patch.width ?? top.width,
    height: patch.height ?? top.height
  });
  const newLayers = Object.freeze([...state.layers.slice(0, -1), next]);
  const depth = newLayers.length;
  const historyCmd = {
    type: historyMode === "push" ? "pushHistory" : "replaceHistory",
    url: next.url,
    historyState: { stackId: state.stackId, layerId: next.id, depth }
  };
  return {
    state: { ...state, layers: newLayers },
    commands: [
      {
        type: "morphTopLayer",
        layerId: next.id,
        url: next.url,
        depth,
        variant: next.variant,
        dismissible: next.dismissible,
        ...next.size ? { size: next.size } : {},
        ...next.side ? { side: next.side } : {},
        ...next.width ? { width: next.width } : {},
        ...next.height ? { height: next.height } : {}
      },
      historyCmd,
      { type: "persistSnapshot" }
    ]
  };
}
function closeAll(state) {
  if (state.layers.length === 0)
    return { state, commands: [] };
  const n = state.layers.length;
  return {
    state: { ...state, layers: Object.freeze([]) },
    commands: [
      { type: "unmountAllLayers" },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "historyBack", n },
      { type: "clearSnapshot" }
    ]
  };
}
function handlePopstate(state, { historyState, locationHref }) {
  const isOurs = historyState && historyState.stackId === state.stackId;
  if (!isOurs) {
    if (state.layers.length === 0)
      return { state, commands: [] };
    return {
      state: { ...state, layers: Object.freeze([]) },
      commands: [
        { type: "unmountAllLayers" },
        { type: "closeDialog" },
        { type: "unlockScroll" },
        { type: "clearSnapshot" }
      ]
    };
  }
  const targetDepth = historyState.depth ?? 0;
  const currentDepth = state.layers.length;
  const targetLayerId = historyState.layerId ?? null;
  if (targetDepth < currentDepth) {
    const newLayers = Object.freeze(state.layers.slice(0, targetDepth));
    const newTop = newLayers[newLayers.length - 1] ?? null;
    const commands = [];
    for (let i = 0;i < currentDepth - targetDepth; i++) {
      commands.push({ type: "unmountTopLayer" });
    }
    if (newTop) {
      commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
      commands.push({ type: "persistSnapshot" });
    } else {
      commands.push({ type: "closeDialog" });
      commands.push({ type: "unlockScroll" });
      commands.push({ type: "clearSnapshot" });
    }
    return { state: { ...state, layers: newLayers }, commands };
  }
  if (targetDepth > currentDepth) {
    return {
      state,
      commands: [
        { type: "rebuildFromSnapshot", targetDepth, targetLayerId }
      ]
    };
  }
  const top = topLayer(state);
  if (top && targetLayerId && top.id !== targetLayerId) {
    const updatedTop = freezeLayer({
      id: targetLayerId,
      url: locationHref ?? top.url,
      variant: top.variant,
      dismissible: top.dismissible,
      size: top.size,
      side: top.side,
      width: top.width,
      height: top.height
    });
    const newLayers = Object.freeze([
      ...state.layers.slice(0, -1),
      updatedTop
    ]);
    return {
      state: { ...state, layers: newLayers },
      commands: [
        {
          type: "morphTopLayer",
          layerId: targetLayerId,
          url: updatedTop.url,
          depth: currentDepth,
          variant: updatedTop.variant,
          dismissible: updatedTop.dismissible,
          ...updatedTop.size ? { size: updatedTop.size } : {},
          ...updatedTop.side ? { side: updatedTop.side } : {},
          ...updatedTop.width ? { width: updatedTop.width } : {},
          ...updatedTop.height ? { height: updatedTop.height } : {}
        },
        { type: "persistSnapshot" }
      ]
    };
  }
  return { state, commands: [] };
}
function snapshot(state, { now = Date.now } = {}) {
  return JSON.stringify({
    v: SNAPSHOT_VERSION,
    stackId: state.stackId,
    baseUrl: state.baseUrl,
    layers: state.layers,
    savedAt: now()
  });
}
function restore(serialized, { stackId, maxAgeMs = DEFAULT_MAX_AGE_MS, now = Date.now } = {}) {
  if (typeof serialized !== "string" || serialized.length === 0)
    return null;
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (parsed?.v !== SNAPSHOT_VERSION)
    return null;
  if (typeof parsed.stackId !== "string")
    return null;
  if (typeof parsed.baseUrl !== "string")
    return null;
  if (!Array.isArray(parsed.layers))
    return null;
  if (typeof parsed.savedAt !== "number")
    return null;
  if (stackId && parsed.stackId !== stackId)
    return null;
  if (now() - parsed.savedAt > maxAgeMs)
    return null;
  for (const l of parsed.layers) {
    if (!l || typeof l.id !== "string" || typeof l.url !== "string")
      return null;
    if (!VARIANTS.includes(l.variant))
      return null;
  }
  return Object.freeze({
    stackId: parsed.stackId,
    baseUrl: parsed.baseUrl,
    layers: Object.freeze(parsed.layers.map(freezeLayer))
  });
}

// app/javascript/modal_stack/orchestrator.js
class Orchestrator {
  #expectedPopstates = 0;
  constructor({
    runtime,
    stackId,
    baseUrl,
    restoreFrom = null,
    maxDepth = null,
    maxDepthStrategy = "warn"
  }) {
    if (!runtime)
      throw new Error("runtime required");
    this.runtime = runtime;
    this.maxDepth = maxDepth;
    this.maxDepthStrategy = maxDepthStrategy;
    this.state = createStack({ stackId, baseUrl });
    if (restoreFrom) {
      const restored = restore(restoreFrom, { stackId });
      if (restored)
        this.state = restored;
    }
  }
  get layers() {
    return this.state.layers;
  }
  get depth() {
    return this.state.layers.length;
  }
  async push(layer, { html = null, fragment = null } = {}) {
    const transition = push(this.state, layer, {
      maxDepth: this.maxDepth,
      maxDepthStrategy: this.maxDepthStrategy
    });
    if (transition.commands.length === 0)
      return;
    if (fragment == null && html == null && layer?.url) {
      fragment = await this.#prefetch(layer.url);
    }
    return this.#dispatch(transition, { html, fragment });
  }
  pop() {
    return this.#dispatch(pop(this.state));
  }
  async replaceTop(patch, { html = null, fragment = null, ...opts } = {}) {
    if (fragment == null && html == null && patch?.url) {
      fragment = await this.#prefetch(patch.url);
    }
    return this.#dispatch(replaceTop(this.state, patch, opts), { html, fragment });
  }
  async#prefetch(url) {
    if (typeof this.runtime.fetchFragment !== "function")
      return null;
    return this.runtime.fetchFragment(url);
  }
  closeAll() {
    return this.#dispatch(closeAll(this.state));
  }
  onPopstate({ historyState, locationHref }) {
    if (this.#expectedPopstates > 0) {
      this.#expectedPopstates -= 1;
      return Promise.resolve();
    }
    return this.#dispatch(handlePopstate(this.state, { historyState, locationHref }));
  }
  async#dispatch({ state, commands }, payload = {}) {
    this.state = state;
    for (const cmd of commands) {
      if (cmd.type === "mountLayer" || cmd.type === "morphTopLayer") {
        if (payload.html != null)
          cmd.html = payload.html;
        if (payload.fragment != null)
          cmd.fragment = payload.fragment;
      }
      await this.#execute(cmd);
    }
  }
  async#execute(cmd) {
    if (cmd.type === "historyBack") {
      this.#expectedPopstates += 1;
    }
    if (cmd.type === "persistSnapshot") {
      await this.runtime.persistSnapshot?.(snapshot(this.state));
      return;
    }
    const handler = this.runtime[cmd.type];
    if (typeof handler !== "function") {
      const known = Object.getOwnPropertyNames(Object.getPrototypeOf(this.runtime)).filter((name) => name !== "constructor" && typeof this.runtime[name] === "function").sort().join(", ");
      throw new Error(`[modal_stack] runtime missing handler for "${cmd.type}" ` + `(stack depth=${this.depth}). ` + `Known handlers: ${known || "<none>"}.`);
    }
    await handler.call(this.runtime, cmd);
  }
}

// app/javascript/modal_stack/runtime.js
var SNAPSHOT_KEY = "modalStackSnapshot";
var FRAGMENT_HEADER = "X-Modal-Stack-Request";
var SCROLLBAR_WIDTH_VAR = "--modal-stack-scrollbar-width";
var LAYER_SELECTOR = '[data-modal-stack-target="layer"]';
var LEAVE_TIMEOUT_MS = 600;

class BrowserRuntime {
  constructor({
    dialog,
    body = globalThis.document?.body,
    history = globalThis.history,
    fetcher = globalThis.fetch?.bind(globalThis),
    store = globalThis.sessionStorage,
    documentRef = globalThis.document
  } = {}) {
    if (!dialog)
      throw new Error("BrowserRuntime: dialog element required");
    if (!fetcher)
      throw new Error("BrowserRuntime: fetch implementation required");
    if (!documentRef)
      throw new Error("BrowserRuntime: document reference required");
    this.dialog = dialog;
    this.body = body;
    this.history = history;
    this.fetcher = fetcher;
    this.store = store;
    this.document = documentRef;
  }
  showDialog() {
    if (!this.dialog.open)
      this.dialog.showModal();
  }
  closeDialog() {
    if (this.dialog.open)
      this.dialog.close();
  }
  lockScroll() {
    if (!this.body)
      return;
    const root = this.document?.documentElement;
    if (root) {
      const scrollbarWidth = Math.max(0, (globalThis.innerWidth ?? root.clientWidth) - root.clientWidth);
      root.style.setProperty(SCROLLBAR_WIDTH_VAR, `${scrollbarWidth}px`);
    }
    this.body.dataset.modalStackLocked = "";
  }
  unlockScroll() {
    if (!this.body)
      return;
    delete this.body.dataset.modalStackLocked;
    const root = this.document?.documentElement;
    if (root)
      root.style.removeProperty(SCROLLBAR_WIDTH_VAR);
  }
  inertLayer({ layerId, value }) {
    const layer = this.#findLayer(layerId);
    if (!layer)
      return;
    if (value)
      layer.setAttribute("inert", "");
    else
      layer.removeAttribute("inert");
  }
  async mountLayer({ layerId, url, depth, variant, dismissible, size, side, width, height, html, fragment }) {
    const frag = await this.#resolveFragment({ url, html, fragment });
    const layer = this.document.createElement("div");
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible, size, side, width, height });
    layer.append(...frag.childNodes);
    this.dialog.appendChild(layer);
  }
  async morphTopLayer({ layerId, url, depth, variant, dismissible, size, side, width, height, html, fragment }) {
    const frag = await this.#resolveFragment({ url, html, fragment });
    const layer = this.#topLayer();
    if (!layer)
      return;
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible, size, side, width, height });
    layer.replaceChildren(...frag.childNodes);
  }
  async unmountTopLayer() {
    const layer = this.#topLayer();
    if (!layer)
      return;
    await animateOut(layer);
  }
  async unmountAllLayers() {
    const layers = [...this.dialog.querySelectorAll(LAYER_SELECTOR)];
    await Promise.all(layers.map(animateOut));
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
    this.dialog.dispatchEvent(new CustomEvent("modal_stack:rebuild-requested", { bubbles: true }));
  }
  persistSnapshot(json) {
    if (!this.store)
      return;
    try {
      this.store.setItem(SNAPSHOT_KEY, json);
    } catch {}
  }
  clearSnapshot() {
    if (!this.store)
      return;
    try {
      this.store.removeItem(SNAPSHOT_KEY);
    } catch {}
  }
  readSnapshot() {
    if (!this.store)
      return null;
    try {
      return this.store.getItem(SNAPSHOT_KEY);
    } catch {
      return null;
    }
  }
  #findLayer(layerId) {
    return this.dialog.querySelector(`${LAYER_SELECTOR}[data-layer-id="${escapeAttr(layerId)}"]`);
  }
  #topLayer() {
    const layers = this.dialog.querySelectorAll(LAYER_SELECTOR);
    return layers[layers.length - 1] ?? null;
  }
  #applyLayerAttrs(layer, { layerId, depth, variant, dismissible, size, side, width, height }) {
    layer.dataset.modalStackTarget = "layer";
    layer.dataset.layerId = layerId;
    layer.dataset.depth = String(depth);
    layer.dataset.variant = variant;
    layer.dataset.dismissible = String(dismissible);
    if (size)
      layer.dataset.modalStackSize = size;
    else
      delete layer.dataset.modalStackSize;
    if (side)
      layer.dataset.side = side;
    else
      delete layer.dataset.side;
    if (width) {
      layer.dataset.modalStackWidth = width;
      layer.style.width = width;
    } else {
      delete layer.dataset.modalStackWidth;
      layer.style.removeProperty("width");
    }
    if (height) {
      layer.dataset.modalStackHeight = height;
      layer.style.height = height;
    } else {
      delete layer.dataset.modalStackHeight;
      layer.style.removeProperty("height");
    }
  }
  async fetchFragment(url) {
    const resp = await this.fetcher(url, {
      headers: {
        Accept: "text/html, text/vnd.turbo-stream.html",
        [FRAGMENT_HEADER]: "1"
      },
      credentials: "same-origin"
    });
    if (!resp.ok) {
      throw new Error(`modal_stack: fetch ${url} → ${resp.status}`);
    }
    const html = await resp.text();
    return parseFragment(html, this.document);
  }
  async#resolveFragment({ url, html, fragment }) {
    if (fragment)
      return fragment;
    if (html != null)
      return parseFragment(html, this.document);
    return this.fetchFragment(url);
  }
}
function parseFragment(html, doc) {
  const parser = new DOMParser;
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = doc.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}
function animateOut(layer) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done)
        return;
      done = true;
      layer.removeEventListener("transitionend", finish);
      layer.remove();
      resolve();
    };
    layer.addEventListener("transitionend", finish, { once: true });
    layer.dataset.leaving = "";
    setTimeout(finish, LEAVE_TIMEOUT_MS);
  });
}
function escapeAttr(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

// app/javascript/modal_stack/controllers/modal_stack_controller.js
class ModalStackController extends Controller {
  static values = {
    stackId: String,
    baseUrl: String,
    maxDepth: { type: Number, default: 0 },
    maxDepthStrategy: { type: String, default: "warn" }
  };
  connect() {
    const stackId = this.stackIdValue || generateLayerId();
    const baseUrl = this.baseUrlValue || window.location.href;
    this.runtime = new BrowserRuntime({ dialog: this.element });
    const snapshot2 = this.runtime.readSnapshot();
    this.orchestrator = new Orchestrator({
      runtime: this.runtime,
      stackId,
      baseUrl,
      restoreFrom: snapshot2,
      maxDepth: this.maxDepthValue > 0 ? this.maxDepthValue : null,
      maxDepthStrategy: this.maxDepthStrategyValue || "warn"
    });
    this._onPopstate = (event) => this.orchestrator.onPopstate({
      historyState: event.state,
      locationHref: window.location.href
    });
    window.addEventListener("popstate", this._onPopstate);
    this._onCancel = (event) => {
      event.preventDefault();
      const top = this.#topLayer();
      if (!top || top.dismissible === false)
        return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("cancel", this._onCancel);
    this._onBackdropClick = (event) => {
      if (event.target !== this.element)
        return;
      const top = this.#topLayer();
      if (!top || top.dismissible === false)
        return;
      this.orchestrator.pop();
    };
    this.element.addEventListener("click", this._onBackdropClick);
    this.#registerStreamActions();
    this.element.dispatchEvent(new CustomEvent("modal_stack:ready", { bubbles: true, detail: { stackId } }));
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
  #topLayer() {
    const layers = this.orchestrator.layers;
    return layers[layers.length - 1] ?? null;
  }
  #registerStreamActions() {
    const Turbo = globalThis.Turbo;
    if (!Turbo) {
      console.warn("[modal_stack] Turbo is not loaded; modal_push/pop/replace stream actions are disabled. " + "Ensure turbo-rails (or @hotwired/turbo) loads before modal_stack.");
      return;
    }
    const StreamActions = Turbo.StreamActions || (Turbo.StreamActions = {});
    const orchestrator = this.orchestrator;
    const dialog = this.element;
    const guarded = (action, fn) => function guardedStreamAction() {
      try {
        const result = fn.call(this, orchestrator);
        if (result && typeof result.catch === "function") {
          result.catch((err) => emitStreamError(dialog, action, err));
        }
      } catch (err) {
        emitStreamError(dialog, action, err);
      }
    };
    StreamActions.modal_push = guarded("modal_push", function(orch) {
      return orch.push(layerFromStreamElement(this), {
        fragment: this.templateContent.cloneNode(true)
      });
    });
    StreamActions.modal_pop = guarded("modal_pop", function(orch) {
      return orch.pop();
    });
    StreamActions.modal_replace = guarded("modal_replace", function(orch) {
      return orch.replaceTop(layerPatchFromStreamElement(this), {
        fragment: this.templateContent.cloneNode(true),
        historyMode: this.dataset.historyMode || "replace"
      });
    });
    StreamActions.modal_close_all = guarded("modal_close_all", function(orch) {
      return orch.closeAll();
    });
  }
}
function emitStreamError(dialog, action, error) {
  if (typeof console !== "undefined" && console.error) {
    console.error(`[modal_stack] stream action "${action}" failed:`, error);
  }
  dialog.dispatchEvent(new CustomEvent("modal_stack:error", {
    bubbles: true,
    cancelable: false,
    detail: { action, error }
  }));
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
    dismissible: el.dataset.dismissible !== "false"
  };
}
function layerPatchFromStreamElement(el) {
  const patch = {};
  if (el.dataset.layerId)
    patch.id = el.dataset.layerId;
  if (el.dataset.url)
    patch.url = el.dataset.url;
  if (el.dataset.variant)
    patch.variant = el.dataset.variant;
  if (el.dataset.side)
    patch.side = el.dataset.side;
  if (el.dataset.size)
    patch.size = el.dataset.size;
  if (el.dataset.width)
    patch.width = el.dataset.width;
  if (el.dataset.height)
    patch.height = el.dataset.height;
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

// app/javascript/modal_stack/controllers/modal_stack_link_controller.js
import { Controller as Controller2 } from "@hotwired/stimulus";

class ModalStackLinkController extends Controller2 {
  open(event) {
    const stack = document.querySelector('[data-controller~="modal-stack"]');
    if (!stack)
      return;
    const controller = this.application.getControllerForElementAndIdentifier(stack, "modal-stack");
    if (!controller)
      return;
    event.preventDefault();
    const ds = this.element.dataset;
    controller.push({
      id: generateLayerId2(),
      url: this.element.href,
      variant: ds.modalStackLinkVariant || "modal",
      side: ds.modalStackLinkSide,
      size: ds.modalStackLinkSize,
      width: ds.modalStackLinkWidth,
      height: ds.modalStackLinkHeight,
      dismissible: ds.modalStackLinkDismissible !== "false"
    });
  }
}
function generateLayerId2() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// app/javascript/modal_stack/install.js
function install(application) {
  if (!application || typeof application.register !== "function") {
    throw new Error("modal_stack: install(application) requires a Stimulus Application instance");
  }
  application.register("modal-stack", ModalStackController);
  application.register("modal-stack-link", ModalStackLinkController);
  return application;
}
export {
  install,
  ModalStackLinkController,
  ModalStackController
};
