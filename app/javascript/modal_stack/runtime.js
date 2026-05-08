export const SNAPSHOT_KEY = "modalStackSnapshot";
export const FRAGMENT_HEADER = "X-Modal-Stack-Request";
// Server response header that flags the just-rendered frame as stale —
// the runtime will refetch instead of restoring from the in-memory cache
// when the user steps back to it.
export const STALE_HEADER = "X-Modal-Stack-Stale";
export const SCROLLBAR_WIDTH_VAR = "--modal-stack-scrollbar-width";

const LAYER_SELECTOR = '[data-modal-stack-target="layer"]';
const FRAME_SELECTOR = "[data-modal-stack-frame]";
// CSS variable host stylesheets set to declare their leave-transition
// duration (e.g. "220ms"). When present, the runtime sizes its safety
// timeout from this value; otherwise it falls back to a conservative cap.
const DURATION_CSS_VAR = "--modal-stack-duration";
// Floor for the safety timeout — even very short CSS transitions need
// enough headroom for transitionend to fire on slow devices.
const LEAVE_TIMEOUT_FLOOR_MS = 300;
// Used when no CSS variable is exposed (host CSS missing, JSDOM tests).
const LEAVE_TIMEOUT_FALLBACK_MS = 600;

/**
 * The only file that touches `<dialog>`, `history`, `fetch`, and
 * `sessionStorage`. Implements one method per command type emitted by the
 * reducer in `state.js`.
 *
 * Tests can swap in any object that implements the same surface (see
 * `orchestrator.test.js` for an in-memory fake).
 */
export class BrowserRuntime {
  /**
   * @param {Object} options
   * @param {HTMLDialogElement} options.dialog
   * @param {HTMLElement} [options.body]
   * @param {History} [options.history]
   * @param {typeof fetch} [options.fetcher]
   * @param {Storage} [options.store]
   * @param {Document} [options.documentRef]
   */
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
    // Cached DocumentFragments for path frames, keyed by `${layerId}#${frameIndex}`.
    // Populated by mountFrame on the way forward, drained by unmountFrame on
    // the way back, purged on layer teardown via clearFrameCache.
    this._frameCache = new Map();
  }

  showDialog() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  closeDialog() {
    if (this.dialog.open) this.dialog.close();
  }

  lockScroll() {
    if (!this.body) return;
    // Compensate for the scrollbar that disappears once <body> stops
    // overflowing — without this, fixed elements jump rightward by the
    // scrollbar width on lock. Host CSS reads the variable via
    // `padding-right: var(--modal-stack-scrollbar-width, 0)`.
    const root = this.document?.documentElement;
    if (root) {
      const scrollbarWidth = Math.max(
        0,
        (globalThis.innerWidth ?? root.clientWidth) - root.clientWidth,
      );
      root.style.setProperty(SCROLLBAR_WIDTH_VAR, `${scrollbarWidth}px`);
    }
    this.body.dataset.modalStackLocked = "";
  }

  unlockScroll() {
    if (!this.body) return;
    delete this.body.dataset.modalStackLocked;
    const root = this.document?.documentElement;
    if (root) root.style.removeProperty(SCROLLBAR_WIDTH_VAR);
  }

  inertLayer({ layerId, value }) {
    const layer = this.#findLayer(layerId);
    if (!layer) return;
    if (value) layer.setAttribute("inert", "");
    else layer.removeAttribute("inert");
  }

  async mountLayer({ layerId, url, depth, variant, dismissible, size, side, width, height, html, fragment }) {
    const frag = await this.#resolveFragment({ url, html, fragment });
    const layer = this.document.createElement("div");
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible, size, side, width, height });
    this.#applyFrameDepth(layer, 0);
    const wrapper = this.#createFrameWrapper({ frameIndex: 0 });
    wrapper.append(...frag.childNodes);
    layer.appendChild(wrapper);
    this.dialog.appendChild(layer);
  }

  async morphTopLayer({ layerId, url, depth, variant, dismissible, size, side, width, height, html, fragment }) {
    const frag = await this.#resolveFragment({ url, html, fragment });
    const layer = this.#topLayer();
    if (!layer) return;
    this.#applyLayerAttrs(layer, { layerId, depth, variant, dismissible, size, side, width, height });
    this.#applyFrameDepth(layer, 0);
    const wrapper = this.#createFrameWrapper({ frameIndex: 0 });
    wrapper.append(...frag.childNodes);
    layer.replaceChildren(wrapper);
  }

  async mountFrame({ layerId, fromFrameIndex, toFrameIndex, url, html, fragment, transition }) {
    const layer = this.#findLayer(layerId);
    if (!layer) return;
    const frag = await this.#resolveFragment({ url, html, fragment });

    // Snapshot the outgoing frame's children for back navigation. We cache
    // the original nodes (not clones) and detach them from the DOM — the
    // animateOut below operates on the wrapper, which we'll throw away.
    const oldFrame = this.#findFrame(layer, fromFrameIndex);
    if (oldFrame) {
      const cached = this.document.createDocumentFragment();
      cached.append(...oldFrame.childNodes);
      this._frameCache.set(this.#frameKey(layerId, fromFrameIndex), cached);
    }

    const newFrame = this.#createFrameWrapper({ frameIndex: toFrameIndex, transition, direction: "forward" });
    newFrame.append(...frag.childNodes);
    layer.appendChild(newFrame);
    this.#applyFrameDepth(layer, toFrameIndex);

    if (oldFrame) {
      if (transition) oldFrame.dataset.transition = transition;
      oldFrame.dataset.direction = "forward";
      await animateOut(oldFrame, this.#leaveTimeoutMs());
    }
  }

  async unmountFrame({ layerId, fromFrameIndex, toFrameIndex, url, stale, transition }) {
    const layer = this.#findLayer(layerId);
    if (!layer) return;

    const cacheKey = this.#frameKey(layerId, toFrameIndex);
    let restored = stale ? null : this._frameCache.get(cacheKey) ?? null;
    if (!restored) {
      const result = await this.fetchFragment(url);
      restored = result.fragment;
      this._frameCache.set(cacheKey, cloneFragment(restored, this.document));
    } else {
      // Clone so the cache entry remains usable if we step back here again
      // after another forward.
      restored = cloneFragment(restored, this.document);
    }

    const newFrame = this.#createFrameWrapper({ frameIndex: toFrameIndex, transition, direction: "back" });
    newFrame.append(...restored.childNodes);
    layer.appendChild(newFrame);
    this.#applyFrameDepth(layer, toFrameIndex);

    // Drop cache entries for frames that are now gone (anything past the
    // restored index — we only keep entries for frames still tracked in
    // state).
    this.#purgeFrameCacheAbove(layerId, toFrameIndex);

    const oldFrame = this.#findFrame(layer, fromFrameIndex);
    if (oldFrame) {
      if (transition) oldFrame.dataset.transition = transition;
      oldFrame.dataset.direction = "back";
      await animateOut(oldFrame, this.#leaveTimeoutMs());
    }
  }

  clearFrameCache({ layerId }) {
    const prefix = `${layerId}#`;
    for (const key of [...this._frameCache.keys()]) {
      if (key.startsWith(prefix)) this._frameCache.delete(key);
    }
  }

  async unmountTopLayer() {
    const layer = this.#topLayer();
    if (!layer) return;
    await animateOut(layer, this.#leaveTimeoutMs());
  }

  async unmountAllLayers() {
    const layers = [...this.dialog.querySelectorAll(LAYER_SELECTOR)];
    const timeout = this.#leaveTimeoutMs();
    await Promise.all(layers.map((l) => animateOut(l, timeout)));
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

  // Reads --modal-stack-duration from the dialog's computed style and
  // returns 1.5× that as the safety timeout (in ms). Cached after the
  // first successful read since the variable is host-CSS-defined and
  // shouldn't change at runtime. Returns LEAVE_TIMEOUT_FALLBACK_MS when
  // getComputedStyle is unavailable (tests) or the variable is missing.
  #leaveTimeoutMs() {
    if (this._cachedLeaveTimeoutMs != null) return this._cachedLeaveTimeoutMs;

    const get = globalThis.getComputedStyle;
    if (typeof get !== "function" || !this.dialog?.ownerDocument) {
      return LEAVE_TIMEOUT_FALLBACK_MS;
    }

    let parsed = NaN;
    try {
      const raw = get(this.dialog).getPropertyValue(DURATION_CSS_VAR);
      parsed = parseDurationMs(raw);
    } catch {
      // getComputedStyle can throw in detached/foreign documents.
    }

    const ms = Number.isFinite(parsed)
      ? Math.max(Math.ceil(parsed * 1.5), LEAVE_TIMEOUT_FLOOR_MS)
      : LEAVE_TIMEOUT_FALLBACK_MS;
    this._cachedLeaveTimeoutMs = ms;
    return ms;
  }

  #findLayer(layerId) {
    return this.dialog.querySelector(
      `${LAYER_SELECTOR}[data-layer-id="${escapeAttr(layerId)}"]`,
    );
  }

  #findFrame(layer, frameIndex) {
    return layer.querySelector(
      `${FRAME_SELECTOR}[data-frame-index="${escapeAttr(String(frameIndex))}"]`,
    );
  }

  #frameKey(layerId, frameIndex) {
    return `${layerId}#${frameIndex}`;
  }

  #purgeFrameCacheAbove(layerId, frameIndex) {
    const prefix = `${layerId}#`;
    for (const key of [...this._frameCache.keys()]) {
      if (!key.startsWith(prefix)) continue;
      const idx = Number(key.slice(prefix.length));
      if (Number.isFinite(idx) && idx > frameIndex) {
        this._frameCache.delete(key);
      }
    }
  }

  #createFrameWrapper({ frameIndex, transition = null, direction = null }) {
    const el = this.document.createElement("div");
    el.dataset.modalStackFrame = "";
    el.dataset.frameIndex = String(frameIndex);
    if (transition) el.dataset.transition = transition;
    if (direction) el.dataset.direction = direction;
    return el;
  }

  #applyFrameDepth(layer, topFrameIndex) {
    layer.dataset.frameIndex = String(topFrameIndex);
    layer.dataset.frameDepth = String(topFrameIndex + 1);
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
    if (size) layer.dataset.modalStackSize = size;
    else delete layer.dataset.modalStackSize;
    if (side) layer.dataset.side = side;
    else delete layer.dataset.side;
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

  async fetchFragment(url, { signal } = {}) {
    const resp = await this.fetcher(url, {
      headers: {
        Accept: "text/html, text/vnd.turbo-stream.html",
        [FRAGMENT_HEADER]: "1",
      },
      credentials: "same-origin",
      signal,
    });
    if (!resp.ok) {
      throw new Error(`modal_stack: fetch ${url} → ${resp.status}`);
    }
    const html = await resp.text();
    const stale = parseStaleHeader(resp);
    return { fragment: parseFragment(html, this.document), stale };
  }

  async #resolveFragment({ url, html, fragment }) {
    if (fragment) return fragment;
    if (html != null) return parseFragment(html, this.document);
    const result = await this.fetchFragment(url);
    return result.fragment;
  }
}

function parseFragment(html, doc) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = doc.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}

function parseStaleHeader(resp) {
  const headers = resp?.headers;
  const value =
    typeof headers?.get === "function"
      ? headers.get(STALE_HEADER) ?? headers.get(STALE_HEADER.toLowerCase())
      : null;
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function cloneFragment(fragment, doc) {
  if (typeof fragment?.cloneNode === "function") {
    return fragment.cloneNode(true);
  }
  const clone = doc.createDocumentFragment();
  if (fragment?.childNodes) {
    for (const node of fragment.childNodes) clone.appendChild(node.cloneNode(true));
  }
  return clone;
}

// Marks the layer with [data-leaving] so the host CSS can transition it
// out, then awaits transitionend (with a hard timeout) before removing
// the element from the DOM.  If the host CSS doesn't define an exit
// transition, the timeout still fires and the layer is removed cleanly.
function animateOut(layer, timeoutMs = LEAVE_TIMEOUT_FALLBACK_MS) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      layer.removeEventListener("transitionend", finish);
      layer.remove();
      resolve();
    };
    layer.addEventListener("transitionend", finish, { once: true });
    layer.dataset.leaving = "";
    setTimeout(finish, timeoutMs);
  });
}

// Parses a CSS time token ("220ms", "0.22s", "  220 ms ") to milliseconds.
// Returns NaN when the input is empty or unparseable so callers can fall back.
function parseDurationMs(raw) {
  if (typeof raw !== "string") return NaN;
  const value = raw.trim();
  if (!value) return NaN;
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return NaN;
  return /m?s$/i.test(value) && !/ms$/i.test(value) ? num * 1000 : num;
}

function escapeAttr(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}
