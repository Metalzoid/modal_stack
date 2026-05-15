/**
 * @typedef {"modal" | "drawer" | "bottom_sheet" | "confirmation"} Variant
 * @typedef {"left" | "right" | "top" | "bottom"} DrawerSide
 * @typedef {"sm" | "md" | "lg" | "xl"} Size
 * @typedef {"slide" | "fade" | "none"} Transition
 *
 * @typedef {Object} Frame
 * @property {string} url     Frame URL — written to history when this frame is on top
 * @property {boolean} stale  When true, runtime refetches before restoring on back
 *
 * @typedef {Object} Layer
 * @property {string} id        Stable layer identifier (used for inertness + DOM lookup)
 * @property {string} url       Top frame URL — kept for back-compat with the existing API
 * @property {Variant} variant
 * @property {boolean} dismissible
 * @property {Size|null} size
 * @property {DrawerSide|null} side  Required for drawers; null otherwise
 * @property {string|null} width    Free-form CSS width (e.g. "42rem")
 * @property {string|null} height
 * @property {readonly Frame[]} frames  Path frames; layer.url === frames[last].url
 *
 * @typedef {Object} Stack
 * @property {string} stackId
 * @property {string} baseUrl
 * @property {readonly Layer[]} layers
 *
 * @typedef {{ type: string } & Record<string, unknown>} Command
 * @typedef {{ state: Stack, commands: readonly Command[] }} Transition
 */

export const VARIANTS = Object.freeze([
  "modal",
  "drawer",
  "bottom_sheet",
  "confirmation",
]);

export const TRANSITIONS = Object.freeze(["slide", "fade", "none"]);

// v2 introduced `frames` per layer (modal path feature). v1 snapshots are
// rehydrated by synthesising a single-frame array — see restore().
const SNAPSHOT_VERSION = 2;
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;
const DRAWER_SIDES = Object.freeze(["left", "right", "top", "bottom"]);
const MAX_DEPTH_STRATEGIES = Object.freeze(["raise", "warn", "silent"]);

/**
 * Thrown by `push()` when `maxDepth` is exceeded under the `"raise"` strategy.
 * Caught upstream by the orchestrator's stream-action error boundary so the
 * page doesn't blow up — but applications can also catch it directly when
 * calling `orchestrator.push()` programmatically.
 */
export class ModalStackDepthError extends Error {
  constructor({ maxDepth, attemptedDepth }) {
    super(
      `modal_stack: cannot push past max_depth=${maxDepth} ` +
        `(attempted depth=${attemptedDepth})`,
    );
    this.name = "ModalStackDepthError";
    this.maxDepth = maxDepth;
    this.attemptedDepth = attemptedDepth;
  }
}

function normalizeLayerOptions({ variant, size, side, width, height }) {
  // A drawer must always carry a side so CSS can position it.
  const normalizedSide = variant === "drawer" ? (side ?? "right") : (side ?? null);
  if (variant === "drawer" && !DRAWER_SIDES.includes(normalizedSide)) {
    throw new Error(`unknown drawer side: ${normalizedSide}`);
  }
  return {
    size: size ?? null,
    side: normalizedSide,
    width: width ?? null,
    height: height ?? null,
  };
}

function freezeFrame({ url, stale = false }) {
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("frame.url required");
  }
  return Object.freeze({ url, stale: !!stale });
}

function freezeFrames(frames) {
  return Object.freeze(frames.map(freezeFrame));
}

function freezeLayer({ id, url, variant, dismissible, size, side, width, height, frames }) {
  const normalized = normalizeLayerOptions({ variant, size, side, width, height });
  // The layer's url is always the top frame's url; if frames isn't supplied
  // (e.g. fresh push or restoring a v1 snapshot) we synthesize a single frame.
  const framesArray = Array.isArray(frames) && frames.length > 0
    ? frames
    : [{ url, stale: false }];
  const frozenFrames = freezeFrames(framesArray);
  const topUrl = frozenFrames[frozenFrames.length - 1].url;
  return Object.freeze({
    id,
    url: topUrl,
    variant,
    dismissible: !!dismissible,
    size: normalized.size,
    side: normalized.side,
    width: normalized.width,
    height: normalized.height,
    frames: frozenFrames,
  });
}

/**
 * Build an empty, frozen stack.
 * @param {{ stackId: string, baseUrl: string }} options
 * @returns {Stack}
 */
export function createStack({ stackId, baseUrl }) {
  if (!stackId) throw new Error("stackId required");
  if (!baseUrl) throw new Error("baseUrl required");
  return Object.freeze({ stackId, baseUrl, layers: Object.freeze([]) });
}

/**
 * @param {Stack} state
 * @returns {Layer|null}
 */
export function topLayer(state) {
  return state.layers[state.layers.length - 1] ?? null;
}

function totalFrameCount(layers) {
  let n = 0;
  for (const l of layers) n += l.frames.length;
  return n;
}

function validateTransition(value) {
  if (value == null) return null;
  if (!TRANSITIONS.includes(value)) {
    throw new Error(`unknown transition: ${value}`);
  }
  return value;
}

/**
 * Push a new layer on top of the stack.
 *
 * @param {Stack} state
 * @param {Partial<Layer> & { id: string, url: string }} layer
 * @param {{ maxDepth?: number|null, maxDepthStrategy?: "raise"|"warn"|"silent" }} [options]
 * @returns {Transition}
 */
export function push(state, layer, options = {}) {
  if (!layer?.id) throw new Error("layer.id required");
  if (!layer?.url) throw new Error("layer.url required");
  const variant = layer.variant ?? "modal";
  if (!VARIANTS.includes(variant)) {
    throw new Error(`unknown variant: ${variant}`);
  }

  const { maxDepth = null, maxDepthStrategy = "warn" } = options;
  if (maxDepth != null && state.layers.length >= maxDepth) {
    if (!MAX_DEPTH_STRATEGIES.includes(maxDepthStrategy)) {
      throw new Error(
        `unknown maxDepthStrategy: ${maxDepthStrategy} (expected one of ${MAX_DEPTH_STRATEGIES.join(", ")})`,
      );
    }
    if (maxDepthStrategy === "raise") {
      throw new ModalStackDepthError({
        maxDepth,
        attemptedDepth: state.layers.length + 1,
      });
    }
    if (maxDepthStrategy === "warn" && typeof console !== "undefined") {
      console.warn(
        `[modal_stack] push ignored: stack is at max_depth=${maxDepth}. ` +
          `Set ModalStack.configuration.max_depth higher, or use ` +
          `max_depth_strategy = :silent to suppress this warning.`,
      );
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
    height: layer.height,
  });
  const previousTop = topLayer(state);
  const layers = Object.freeze([...state.layers, newLayer]);
  const depth = layers.length;

  // mountLayer runs first so the dialog (or the previous layer) doesn't
  // flash an empty / interactive intermediate state while we're still
  // loading the new content.  When the orchestrator has pre-fetched the
  // fragment, mountLayer is a sync DOM append.
  const commands = [];
  commands.push({
    type: "mountLayer",
    layerId: newLayer.id,
    url: newLayer.url,
    depth,
    variant: newLayer.variant,
    dismissible: newLayer.dismissible,
    ...(newLayer.size ? { size: newLayer.size } : {}),
    ...(newLayer.side ? { side: newLayer.side } : {}),
    ...(newLayer.width ? { width: newLayer.width } : {}),
    ...(newLayer.height ? { height: newLayer.height } : {}),
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
    historyState: {
      stackId: state.stackId,
      layerId: newLayer.id,
      depth,
      frameIndex: 0,
    },
  });
  commands.push({ type: "persistSnapshot" });

  return { state: { ...state, layers }, commands };
}

/**
 * Append a frame to the top layer's path. Forward navigation in a wizard
 * that retains a back-history.
 *
 * @param {Stack} state
 * @param {{ url: string, stale?: boolean }} frame
 * @param {{ transition?: Transition|null }} [options]
 * @returns {Transition}
 */
export function pathTo(state, frame, options = {}) {
  if (state.layers.length === 0) {
    throw new Error("pathTo requires at least one layer");
  }
  if (typeof frame?.url !== "string" || frame.url.length === 0) {
    throw new Error("pathTo requires a frame.url");
  }
  const transition = validateTransition(options.transition ?? null);

  const top = topLayer(state);
  const previousFrameIndex = top.frames.length - 1;
  const newFrame = freezeFrame({ url: frame.url, stale: !!frame.stale });
  const newFrames = [...top.frames, newFrame];
  const newTop = freezeLayer({
    id: top.id,
    url: newFrame.url,
    variant: top.variant,
    dismissible: top.dismissible,
    size: top.size,
    side: top.side,
    width: top.width,
    height: top.height,
    frames: newFrames,
  });
  const newLayers = Object.freeze([...state.layers.slice(0, -1), newTop]);
  const depth = newLayers.length;
  const newFrameIndex = newFrames.length - 1;

  return {
    state: { ...state, layers: newLayers },
    commands: [
      {
        type: "mountFrame",
        layerId: newTop.id,
        fromFrameIndex: previousFrameIndex,
        toFrameIndex: newFrameIndex,
        url: newFrame.url,
        stale: newFrame.stale,
        ...(transition ? { transition } : {}),
      },
      {
        type: "pushHistory",
        url: newFrame.url,
        historyState: {
          stackId: state.stackId,
          layerId: newTop.id,
          depth,
          frameIndex: newFrameIndex,
        },
      },
      { type: "persistSnapshot" },
    ],
  };
}

/**
 * Step back through frames in the top layer's path. Clamps at the first
 * frame: the layer is never closed by pathBack — use pop() / closeAll()
 * for that.
 *
 * @param {Stack} state
 * @param {{ steps?: number, transition?: Transition|null }} [options]
 * @returns {Transition}
 */
export function pathBack(state, options = {}) {
  if (state.layers.length === 0) {
    throw new Error("pathBack requires at least one layer");
  }
  const requestedSteps = options.steps == null ? 1 : Math.floor(options.steps);
  if (!Number.isFinite(requestedSteps) || requestedSteps < 1) {
    throw new Error("pathBack: steps must be a positive integer");
  }
  const transition = validateTransition(options.transition ?? null);

  const top = topLayer(state);
  const fromFrameIndex = top.frames.length - 1;
  const maxSteps = top.frames.length - 1;
  const effectiveSteps = Math.min(requestedSteps, maxSteps);
  if (effectiveSteps === 0) return { state, commands: [] };

  const toFrameIndex = fromFrameIndex - effectiveSteps;
  const newFrames = top.frames.slice(0, toFrameIndex + 1);
  const targetFrame = newFrames[newFrames.length - 1];
  const newTop = freezeLayer({
    id: top.id,
    url: targetFrame.url,
    variant: top.variant,
    dismissible: top.dismissible,
    size: top.size,
    side: top.side,
    width: top.width,
    height: top.height,
    frames: newFrames,
  });
  const newLayers = Object.freeze([...state.layers.slice(0, -1), newTop]);

  return {
    state: { ...state, layers: newLayers },
    commands: [
      {
        type: "unmountFrame",
        layerId: newTop.id,
        fromFrameIndex,
        toFrameIndex,
        url: targetFrame.url,
        stale: targetFrame.stale,
        ...(transition ? { transition } : {}),
      },
      { type: "historyBack", n: effectiveSteps },
      { type: "persistSnapshot" },
    ],
  };
}

/**
 * Pop the top layer (and all of its path frames). No-op when the stack
 * is empty.
 * @param {Stack} state
 * @returns {Transition}
 */
export function pop(state) {
  if (state.layers.length === 0) return { state, commands: [] };

  const popped = topLayer(state);
  const framesToWalkBack = popped.frames.length;
  const newLayers = Object.freeze(state.layers.slice(0, -1));
  const newTop = newLayers[newLayers.length - 1] ?? null;
  const commands = [];
  if (newTop) {
    // Persist early so a page reload during the animation restores the
    // correct (already-popped) stack rather than the stale one.
    commands.push({ type: "persistSnapshot" });
    commands.push({ type: "unmountTopLayer" });
    commands.push({ type: "clearFrameCache", layerId: popped.id });
    commands.push({ type: "historyBack", n: framesToWalkBack });
    commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
  } else {
    // closeDialog first so the dialog's exit transition (opacity +
    // backdrop background + display/overlay allow-discrete) starts
    // immediately and runs in parallel with the layer's [data-leaving]
    // transition. Without this order, the orchestrator awaits 220ms
    // on unmountTopLayer before closing the dialog, then the backdrop
    // fade kicks in for *another* 220ms — visually the backdrop fades
    // after the modal is gone.
    commands.push({ type: "closeDialog" });
    // Clear early so a page reload during the animation does not restore
    // the modal that is already being dismissed.
    commands.push({ type: "clearSnapshot" });
    commands.push({ type: "unmountTopLayer" });
    commands.push({ type: "clearFrameCache", layerId: popped.id });
    commands.push({ type: "historyBack", n: framesToWalkBack });
    commands.push({ type: "unlockScroll" });
  }
  return { state: { ...state, layers: newLayers }, commands };
}

/**
 * Replace (morph) the top layer in-place.
 * @param {Stack} state
 * @param {Partial<Layer>} patch
 * @param {{ historyMode?: "push"|"replace" }} [options]
 * @returns {Transition}
 */
export function replaceTop(state, patch, { historyMode = "replace" } = {}) {
  if (state.layers.length === 0) {
    throw new Error("replaceTop requires at least one layer");
  }
  if (historyMode !== "push" && historyMode !== "replace") {
    throw new Error(`unknown historyMode: ${historyMode}`);
  }

  const top = topLayer(state);
  // replaceTop collapses the top layer's path back to a single frame
  // — the existing path is forgotten. Walk history back one step per
  // dropped frame so the browser's back button doesn't land on stale
  // frame entries.
  const framesToCollapse = top.frames.length - 1;
  const next = freezeLayer({
    id: patch.id ?? top.id,
    url: patch.url ?? top.url,
    variant: patch.variant ?? top.variant,
    dismissible: patch.dismissible ?? top.dismissible,
    size: patch.size ?? top.size,
    side: patch.side ?? top.side,
    width: patch.width ?? top.width,
    height: patch.height ?? top.height,
    // single-frame layer — drop any path that was on the previous layer
    frames: undefined,
  });
  const newLayers = Object.freeze([...state.layers.slice(0, -1), next]);
  const depth = newLayers.length;

  const historyCmd = {
    type: historyMode === "push" ? "pushHistory" : "replaceHistory",
    url: next.url,
    historyState: {
      stackId: state.stackId,
      layerId: next.id,
      depth,
      frameIndex: 0,
    },
  };

  const commands = [];
  if (framesToCollapse > 0) {
    commands.push({ type: "clearFrameCache", layerId: top.id });
    commands.push({ type: "historyBack", n: framesToCollapse });
  }
  commands.push({
    type: "morphTopLayer",
    layerId: next.id,
    url: next.url,
    depth,
    variant: next.variant,
    dismissible: next.dismissible,
    ...(next.size ? { size: next.size } : {}),
    ...(next.side ? { side: next.side } : {}),
    ...(next.width ? { width: next.width } : {}),
    ...(next.height ? { height: next.height } : {}),
  });
  commands.push(historyCmd);
  commands.push({ type: "persistSnapshot" });

  return { state: { ...state, layers: newLayers }, commands };
}

/**
 * Close every layer at once.
 * @param {Stack} state
 * @returns {Transition}
 */
export function closeAll(state) {
  if (state.layers.length === 0) return { state, commands: [] };
  const n = totalFrameCount(state.layers);
  const cacheClears = state.layers.map((l) => ({
    type: "clearFrameCache",
    layerId: l.id,
  }));
  return {
    state: { ...state, layers: Object.freeze([]) },
    // closeDialog first so the dialog's exit transition runs in
    // parallel with the layers' [data-leaving] transitions.
    // clearSnapshot comes before unmountAllLayers so a reload during
    // the animation does not restore a stack that is already closing.
    commands: [
      { type: "closeDialog" },
      { type: "clearSnapshot" },
      { type: "unmountAllLayers" },
      ...cacheClears,
      { type: "unlockScroll" },
      { type: "historyBack", n },
    ],
  };
}

/**
 * Reduce a browser `popstate` into a transition: pop layers, step back
 * through frames, morph the top, or request a rebuild from snapshot for
 * forward navigation.
 * @param {Stack} state
 * @param {{ historyState: any, locationHref: string }} options
 * @returns {Transition}
 */
export function handlePopstate(state, { historyState, locationHref }) {
  const isOurs =
    historyState && historyState.stackId === state.stackId;

  if (!isOurs) {
    if (state.layers.length === 0) return { state, commands: [] };
    const cacheClears = state.layers.map((l) => ({
      type: "clearFrameCache",
      layerId: l.id,
    }));
    return {
      state: { ...state, layers: Object.freeze([]) },
      // closeDialog and clearSnapshot first — see closeAll() for rationale.
      commands: [
        { type: "closeDialog" },
        { type: "clearSnapshot" },
        { type: "unmountAllLayers" },
        ...cacheClears,
        { type: "unlockScroll" },
      ],
    };
  }

  const targetDepth = historyState.depth ?? 0;
  const currentDepth = state.layers.length;
  const targetLayerId = historyState.layerId ?? null;
  const targetFrameIndex = historyState.frameIndex ?? 0;

  if (targetDepth < currentDepth) {
    const droppedLayers = state.layers.slice(targetDepth);
    const newLayers = Object.freeze(state.layers.slice(0, targetDepth));
    const newTop = newLayers[newLayers.length - 1] ?? null;
    const commands = [];
    if (newTop) {
      // Persist before animation so a reload during the transition
      // restores the correct remaining stack.
      commands.push({ type: "persistSnapshot" });
    } else {
      // When popping back to the root via popstate, fire closeDialog
      // first so the dialog's exit transition runs alongside the
      // sequential unmountTopLayer cascade.
      commands.push({ type: "closeDialog" });
      // Clear before animation so a reload during the transition does
      // not restore the stack that is already being dismissed.
      commands.push({ type: "clearSnapshot" });
    }
    for (let i = 0; i < droppedLayers.length; i++) {
      commands.push({ type: "unmountTopLayer" });
    }
    for (const dropped of droppedLayers) {
      commands.push({ type: "clearFrameCache", layerId: dropped.id });
    }
    if (newTop) {
      commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
    } else {
      commands.push({ type: "unlockScroll" });
    }
    return { state: { ...state, layers: newLayers }, commands };
  }

  if (targetDepth > currentDepth) {
    return {
      state,
      commands: [
        { type: "rebuildFromSnapshot", targetDepth, targetLayerId },
      ],
    };
  }

  const top = topLayer(state);
  if (top && targetLayerId && top.id === targetLayerId) {
    const currentFrameIndex = top.frames.length - 1;
    if (targetFrameIndex === currentFrameIndex) {
      return { state, commands: [] };
    }
    if (targetFrameIndex < currentFrameIndex) {
      const newFrames = top.frames.slice(0, targetFrameIndex + 1);
      const targetFrame = newFrames[newFrames.length - 1];
      const updatedTop = freezeLayer({
        id: top.id,
        url: targetFrame.url,
        variant: top.variant,
        dismissible: top.dismissible,
        size: top.size,
        side: top.side,
        width: top.width,
        height: top.height,
        frames: newFrames,
      });
      const newLayers = Object.freeze([
        ...state.layers.slice(0, -1),
        updatedTop,
      ]);
      return {
        state: { ...state, layers: newLayers },
        commands: [
          {
            type: "unmountFrame",
            layerId: top.id,
            fromFrameIndex: currentFrameIndex,
            toFrameIndex: targetFrameIndex,
            url: targetFrame.url,
            stale: targetFrame.stale,
          },
          { type: "persistSnapshot" },
        ],
      };
    }
    // Forward popstate to a frame we no longer track — happens when the
    // user pressed back, then forward, after the path frames were dropped
    // from state. Defer to the controller (snapshot rebuild / fetch).
    return {
      state,
      commands: [
        { type: "rebuildFromSnapshot", targetDepth, targetLayerId },
      ],
    };
  }

  if (top && targetLayerId && top.id !== targetLayerId) {
    const updatedTop = freezeLayer({
      id: targetLayerId,
      url: locationHref ?? top.url,
      variant: top.variant,
      dismissible: top.dismissible,
      size: top.size,
      side: top.side,
      width: top.width,
      height: top.height,
    });
    const newLayers = Object.freeze([
      ...state.layers.slice(0, -1),
      updatedTop,
    ]);
    return {
      state: { ...state, layers: newLayers },
      commands: [
        { type: "clearFrameCache", layerId: top.id },
        {
          type: "morphTopLayer",
          layerId: targetLayerId,
          url: updatedTop.url,
          depth: currentDepth,
          variant: updatedTop.variant,
          dismissible: updatedTop.dismissible,
          ...(updatedTop.size ? { size: updatedTop.size } : {}),
          ...(updatedTop.side ? { side: updatedTop.side } : {}),
          ...(updatedTop.width ? { width: updatedTop.width } : {}),
          ...(updatedTop.height ? { height: updatedTop.height } : {}),
        },
        { type: "persistSnapshot" },
      ],
    };
  }

  return { state, commands: [] };
}

/**
 * Serialize the stack for sessionStorage. Versioned + timestamped.
 *
 * Frames are serialized as `{ url, stale }` only — the cached HTML lives
 * in the runtime, not the snapshot, so a refresh refetches the top frame
 * and lazily refetches earlier frames if/when the user steps back.
 *
 * @param {Stack} state
 * @param {{ now?: () => number }} [options]
 * @returns {string}
 */
export function snapshot(state, { now = Date.now } = {}) {
  return JSON.stringify({
    v: SNAPSHOT_VERSION,
    stackId: state.stackId,
    baseUrl: state.baseUrl,
    layers: state.layers.map(serializeLayer),
    savedAt: now(),
  });
}

function serializeLayer(layer) {
  return {
    id: layer.id,
    url: layer.url,
    variant: layer.variant,
    dismissible: layer.dismissible,
    size: layer.size,
    side: layer.side,
    width: layer.width,
    height: layer.height,
    frames: layer.frames.map((f) => ({ url: f.url, stale: f.stale })),
  };
}

/**
 * Restore a stack from a serialized snapshot. Returns null on any validation
 * failure (wrong stackId, expired, malformed JSON, etc.).
 *
 * Accepts both v1 (pre-frames) and v2 snapshots: v1 layers are rehydrated
 * with a synthetic single-frame array so existing tabs survive an upgrade.
 *
 * @param {string} serialized
 * @param {{ stackId?: string, maxAgeMs?: number, now?: () => number }} [options]
 * @returns {Stack|null}
 */
export function restore(
  serialized,
  { stackId, maxAgeMs = DEFAULT_MAX_AGE_MS, now = Date.now } = {},
) {
  if (typeof serialized !== "string" || serialized.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (parsed?.v !== 1 && parsed?.v !== SNAPSHOT_VERSION) return null;
  if (typeof parsed.stackId !== "string") return null;
  if (typeof parsed.baseUrl !== "string") return null;
  if (!Array.isArray(parsed.layers)) return null;
  if (typeof parsed.savedAt !== "number") return null;
  if (stackId && parsed.stackId !== stackId) return null;
  if (now() - parsed.savedAt > maxAgeMs) return null;

  for (const l of parsed.layers) {
    if (!l || typeof l.id !== "string" || typeof l.url !== "string") return null;
    if (!VARIANTS.includes(l.variant)) return null;
    if (l.frames !== undefined) {
      if (!Array.isArray(l.frames) || l.frames.length === 0) return null;
      for (const f of l.frames) {
        if (!f || typeof f.url !== "string") return null;
      }
    }
  }

  return Object.freeze({
    stackId: parsed.stackId,
    baseUrl: parsed.baseUrl,
    layers: Object.freeze(parsed.layers.map(freezeLayer)),
  });
}
